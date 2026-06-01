const express = require('express');
const { 
  uploadDocument, 
  getAllDocuments, 
  deleteDocument, 
  uploadMiddleware 
} = require('../controllers/uploadController');
const router = express.Router();

router.post('/', uploadMiddleware, uploadDocument);
router.get('/', getAllDocuments);
router.delete('/:id', deleteDocument);

module.exports = router;