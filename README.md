# 🤖 AI Document Assistant - Greatodeal

<div align="center">

![GitHub stars](https://img.shields.io/github/stars/Ranazia943/ai-document-assistant?style=social)
![MIT License](https://img.shields.io/badge/license-MIT-blue)
![Node.js](https://img.shields.io/badge/node-%3E%3D18-green)
![MongoDB](https://img.shields.io/badge/MongoDB-5.0-green)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT4-blue)

**Upload any PDF. Ask any question. Get instant, accurate answers.**

Built by **Greatodeal**

</div>

---

## 📖 About

AI Document Assistant uses **RAG (Retrieval-Augmented Generation)** to let you chat with any PDF. Upload a lease, contract, or research paper - ask questions in plain English - get accurate answers with source citations.

**What it solves:**
- ⏱️ Hours of manual document review → Seconds
- 🎯 Hidden clauses missed → Automatically flagged
- 📄 Complex legal language → Simple answers

---

## ⚙️ How RAG Works
PDF Upload → Text Extraction → Chunking → OpenAI Embeddings → MongoDB
↓
User Question → Embedding → Similarity Search → Context → GPT-4 → Answer


**Why RAG?** No hallucination. Every answer includes exact source from your document.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React, Tailwind CSS, Framer Motion |
| Backend | Node.js, Express |
| Database | MongoDB |
| AI | OpenAI GPT-4, OpenAI Embeddings |
| PDF | pdf-parse |

---

## 🚀 Quick Start

```bash
# Clone
git clone https://github.com/Ranazia943/ai-document-assistant.git
cd ai-document-assistant

# Backend
cd backend
npm install
npm start

# Frontend (new terminal)
cd frontend
npm install
npm run dev


Environment Variables
backend/.env
PORT=5000
MONGO_URI=mongodb://localhost:27017/ai_doc_assistant
OPENAI_API_KEY=your_key_here

frontend/.env

VITE_API_URL=http://localhost:5000/api

💼 Business Use Cases
Industry	Document	Value
Real Estate	Lease	Find hidden repair costs
Legal	Contract	Identify unlimited liability
Finance	Term Sheet	Extract key terms
Education	Research Paper	Summarize findings

📧 Contact
Greatodeal - sales@greatodeal.com
Website : www.greatodeal.com
