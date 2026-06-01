const Document = require('../models/Document');
const Conversation = require('../models/Conversation');
const { getEmbedding, findSimilarChunks, keywordSearch } = require('../utils/vectorStore');
const { OpenAI } = require('openai');
const dotenv = require('dotenv');
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Helper: get AI answer from context
async function getAIAnswer(question, context) {
  const systemPrompt = `You are an expert legal and business AI assistant. Use the following context from a commercial lease agreement to answer the user's question.

CONTEXT:
${context}

RULES:
1. Answer directly based ONLY on the context.
2. If the context doesn't contain the answer, say "Based on the document, I cannot find information about that specific point."
3. For questions about risks or obligations, quote the exact relevant clause.
4. Be specific and cite the wording from the lease.

User question: ${question}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question }
    ],
    temperature: 0.2,
    max_tokens: 800,
  });

  return response.choices[0].message.content;
}

exports.askQuestion = async (req, res) => {
  try {
    const { question, sessionId, documentId } = req.body;
    
    if (!question) {
      return res.status(400).json({ error: 'Question required' });
    }

    // 1. Get documents (specific or all)
    let docs;
    if (documentId) {
      docs = await Document.find({ _id: documentId });
    } else {
      docs = await Document.find();
    }
    
    let allChunks = [];
    docs.forEach(doc => {
      allChunks = allChunks.concat(doc.chunks);
    });
    
    if (allChunks.length === 0) {
      return res.json({ 
        answer: 'No documents uploaded yet. Please upload a PDF first.',
        contextUsed: []
      });
    }

    // 2. Generate embedding for the question
    let questionEmbedding;
    let relevantTexts = [];
    
    try {
      questionEmbedding = await getEmbedding(question);
      // Try vector similarity search
      relevantTexts = findSimilarChunks(questionEmbedding, allChunks, 5);
    } catch (err) {
      console.error('Embedding failed:', err);
    }
    
    // 3. If vector search gave poor results, fallback to keyword search
    if (relevantTexts.length === 0 || relevantTexts.every(t => t.length < 50)) {
      console.log('Vector search returned poor results, using keyword fallback');
      relevantTexts = keywordSearch(question, allChunks, 5);
    }
    
    // 4. FORCED KEYWORD SEARCH for repair-related questions (if still no good results)
    if (relevantTexts.length === 0 || relevantTexts[0].length < 100) {
      console.log("Using forced keyword search for repair obligations");
      const repairKeywords = ['repair', 'maintain', 'tenant', 'obligation', 'keep', 'condition', 'yield', 'dilapidation', 'repairing', 'maintenance'];
      const keywordMatches = allChunks.filter(chunk => {
        const lower = chunk.text.toLowerCase();
        return repairKeywords.some(kw => lower.includes(kw));
      });
      if (keywordMatches.length > 0) {
        relevantTexts = keywordMatches.slice(0, 5).map(c => c.text);
        console.log(`Forced keyword search found ${keywordMatches.length} matches, using top 5`);
      }
    }
    
    if (relevantTexts.length === 0) {
      return res.json({ 
        answer: 'I couldn\'t find relevant information in the document. Please try a different question or re-upload the document.',
        contextUsed: []
      });
    }
    
    const context = relevantTexts.join('\n\n---\n\n');
    
    // Debug log to see what context is being sent
    console.log("Context preview:", context.substring(0, 200));
    
    // 5. Get AI answer
    const answer = await getAIAnswer(question, context);
    
    // 6. Save conversation
    if (sessionId) {
      let conversation = await Conversation.findOne({ sessionId });
      if (!conversation) {
        conversation = new Conversation({ sessionId, messages: [] });
      }
      conversation.messages.push({ role: 'user', content: question });
      conversation.messages.push({ role: 'assistant', content: answer });
      await conversation.save();
    }

    res.json({ 
      answer, 
      contextUsed: relevantTexts,
    });
    
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to process question: ' + error.message });
  }
};

exports.getConversation = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const conversation = await Conversation.findOne({ sessionId });
    res.json(conversation?.messages || []);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
};

exports.clearConversation = async (req, res) => {
  try {
    const { sessionId } = req.params;
    await Conversation.deleteOne({ sessionId });
    res.json({ success: true, message: 'Conversation cleared' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear conversation' });
  }
};