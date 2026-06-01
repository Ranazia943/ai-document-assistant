// backend/test-api.js
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const testAPI = async () => {
  try {
    console.log("Testing Gemini API...");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const result = await model.generateContent("Say 'API works!'");
    console.log("✅ Success:", result.response.text());
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
};

testAPI();