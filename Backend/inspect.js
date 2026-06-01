const mongoose = require('mongoose');
const Document = require('./models/Document');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const docs = await Document.find();
  for (const doc of docs) {
    console.log(`\n=== Document: ${doc.originalName} ===`);
    console.log(`Total chunks: ${doc.chunks.length}`);
    for (let i = 0; i < Math.min(5, doc.chunks.length); i++) {
      console.log(`\n--- Chunk ${i+1} ---`);
      console.log(doc.chunks[i].text.substring(0, 500));
    }
  }
  mongoose.disconnect();
});