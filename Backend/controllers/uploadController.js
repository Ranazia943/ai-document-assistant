const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const Document = require('../models/Document');
const { getEmbedding } = require('../utils/vectorStore');

// Ensure uploads/docs directory exists
const uploadDir = './uploads/docs';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Enhanced PDF text extraction with multiple methods
async function extractPdfText(filePath) {
  const pdfBuffer = fs.readFileSync(filePath);
  
  // Method 1: Standard extraction
  let pdfData = await pdfParse(pdfBuffer);
  let fullText = pdfData.text;
  
  // Method 2: If standard extraction returns little text, try raw extraction
  if (!fullText || fullText.trim().length < 100) {
    console.log("Standard extraction returned little text, trying alternative method...");
    
    // Try to extract raw text with different options
    pdfData = await pdfParse(pdfBuffer, {
      pagerender: function(pageData) {
        return pageData.getTextContent().then(function(textContent) {
          let lastY, text = '';
          for (let item of textContent.items) {
            if (lastY !== item.transform[5] && text) {
              text += '\n';
            }
            text += item.str;
            lastY = item.transform[5];
          }
          return text;
        });
      }
    });
    fullText = pdfData.text;
  }
  
  // Method 3: If still no text, try to extract any readable content
  if (!fullText || fullText.trim().length < 100) {
    console.log("Still no text, attempting fallback extraction...");
    // Look for any printable characters
    const rawBuffer = pdfBuffer.toString('utf8');
    const printable = rawBuffer.match(/[\x20-\x7E\n\r]{10,}/g);
    if (printable) {
      fullText = printable.join('\n');
    }
  }
  
  return { text: fullText, numPages: pdfData.numpages || 1 };
}

// Advanced chunking that preserves clause structure
function chunkText(text, chunkSize = 1000, overlap = 200) {
  const chunks = [];
  
  // First, try to split by clause numbers or section headers
  const clauseRegex = /(Clause|Section|Article)\s+\d+[\.\d]*\s+[^\n]+/gi;
  const clauses = [];
  
  let match;
  let lastIndex = 0;
  while ((match = clauseRegex.exec(text)) !== null) {
    if (lastIndex < match.index) {
      clauses.push(text.substring(lastIndex, match.index));
    }
    lastIndex = match.index;
  }
  if (lastIndex < text.length) {
    clauses.push(text.substring(lastIndex));
  }
  
  // If we found clauses, chunk by clause boundaries
  if (clauses.length > 1) {
    let currentChunk = '';
    for (const clause of clauses) {
      if ((currentChunk + clause).length <= chunkSize) {
        currentChunk += clause;
      } else {
        if (currentChunk.trim()) chunks.push(currentChunk);
        currentChunk = clause;
      }
    }
    if (currentChunk.trim()) chunks.push(currentChunk);
  } else {
    // Fallback to sentence-based chunking
    const sentences = text.split(/(?<=[.!?])\s+/);
    let currentChunk = '';
    for (const sentence of sentences) {
      if ((currentChunk + sentence).length <= chunkSize) {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      } else {
        if (currentChunk.trim()) chunks.push(currentChunk);
        currentChunk = sentence;
      }
    }
    if (currentChunk.trim()) chunks.push(currentChunk);
  }
  
  return chunks.filter(c => c.trim().length > 50);
}

exports.uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`Processing file: ${req.file.originalname}`);
    console.log(`File size: ${req.file.size} bytes`);
    
    // Extract text from PDF using enhanced method
    const { text: fullText, numPages } = await extractPdfText(req.file.path);
    
    console.log(`Extracted text length: ${fullText.length} characters`);
    console.log(`Text preview: ${fullText.substring(0, 200)}`);
    
    if (!fullText || fullText.trim().length === 0) {
      return res.status(400).json({ error: 'PDF contains no readable text. The file may be scanned or image-based.' });
    }
    
    if (fullText.length < 100) {
      return res.status(400).json({ error: 'PDF contains very little extractable text. Please ensure the PDF has selectable text.' });
    }

    // Split into chunks
    const textChunks = chunkText(fullText);
    console.log(`Created ${textChunks.length} chunks`);
    
    // Generate embeddings for each chunk (limit to 30 for performance)
    const chunksToProcess = textChunks.slice(0, 30);
    const chunksWithEmbeddings = [];
    
    for (let i = 0; i < chunksToProcess.length; i++) {
      try {
        console.log(`Processing chunk ${i + 1}/${chunksToProcess.length}`);
        const embedding = await getEmbedding(chunksToProcess[i]);
        chunksWithEmbeddings.push({
          text: chunksToProcess[i],
          embedding: embedding,
          pageNumber: Math.floor((i / chunksToProcess.length) * numPages) + 1
        });
      } catch (err) {
        console.error(`Failed to embed chunk ${i}:`, err.message);
      }
    }
    
    if (chunksWithEmbeddings.length === 0) {
      return res.status(500).json({ error: 'Failed to process document. Could not generate embeddings.' });
    }

    // Save to MongoDB
    const newDocument = new Document({
      filename: req.file.filename,
      originalName: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size,
      numPages: numPages,
      chunks: chunksWithEmbeddings,
      totalChunks: chunksWithEmbeddings.length,
      extractedTextLength: fullText.length
    });
    
    await newDocument.save();

    res.json({ 
      success: true,
      message: 'Document uploaded and processed successfully',
      docId: newDocument._id,
      fileName: req.file.originalname,
      pages: numPages,
      chunksProcessed: chunksWithEmbeddings.length,
      textExtracted: fullText.length
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Failed to process document: ' + error.message });
  }
};

exports.getAllDocuments = async (req, res) => {
  try {
    const documents = await Document.find().select('originalName filename fileSize numPages createdAt totalChunks extractedTextLength');
    res.json(documents);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
};

exports.deleteDocument = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    if (fs.existsSync(doc.filePath)) {
      fs.unlinkSync(doc.filePath);
    }
    
    await doc.deleteOne();
    
    res.json({ success: true, message: 'Document deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete document' });
  }
};

exports.uploadMiddleware = upload.single('file');