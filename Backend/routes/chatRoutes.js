const express = require('express');
const { 
  askQuestion, 
  getConversation, 
  clearConversation 
} = require('../controllers/chatController');
const router = express.Router();

router.post('/', askQuestion);
router.get('/:sessionId', getConversation);
router.delete('/:sessionId', clearConversation);

module.exports = router;