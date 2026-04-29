const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const sectionImageController = require('../controllers/sectionImageController');

// All routes - no auth required
router.get('/section/:sectionName', sectionImageController.getImagesBySection);
router.get('/:id', sectionImageController.getImageById);
router.post('/upload', upload.single('image'), sectionImageController.uploadImage);
router.put('/:id', sectionImageController.updateImage);
router.delete('/:id', sectionImageController.deleteImage);
router.post('/reorder', sectionImageController.reorderImages);

module.exports = router;