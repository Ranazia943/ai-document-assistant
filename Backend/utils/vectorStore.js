const { OpenAI } = require('openai');
const dotenv = require('dotenv');
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function getEmbedding(text) {
  const truncatedText = text.length > 32000 ? text.substring(0, 32000) : text;
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: truncatedText,
  });
  return response.data[0].embedding;
}

function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0, magA = 0, magB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magA += vecA[i] * vecA[i];
    magB += vecB[i] * vecB[i];
  }
  magA = Math.sqrt(magA);
  magB = Math.sqrt(magB);
  if (magA === 0 || magB === 0) return 0;
  return dotProduct / (magA * magB);
}

function findSimilarChunks(questionEmbedding, chunks, topK = 5) {
  const scored = chunks.map((chunk, index) => ({
    text: chunk.text,
    score: cosineSimilarity(questionEmbedding, chunk.embedding),
    index: index
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map(item => item.text);
}

function keywordSearch(question, chunks, topK = 3) {
  const keywords = question.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(kw => kw.length > 3);
  
  const scored = chunks.map(chunk => {
    const lowerText = chunk.text.toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      if (lowerText.includes(kw)) score++;
    }
    return { text: chunk.text, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map(item => item.text);
}

module.exports = { getEmbedding, findSimilarChunks, keywordSearch, cosineSimilarity };