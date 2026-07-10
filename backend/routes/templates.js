const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const authorizeRoles = require('../middleware/roles');
const upload = require('../middleware/templateScanUpload');
const templateController = require('../controllers/templateController');

router.get('/:measureType/history', authenticateToken, (req, res, next) => {
  req.query.historyOnly = 'true';
  next();
}, templateController.getTemplates);
router.get('/:measureType', authenticateToken, templateController.getTemplates);
router.post('/:measureType/scan', authenticateToken, authorizeRoles('Councilor', 'Secretary', 'Admin', 'Vice Mayor'), upload.single('document'), templateController.scanTemplateDocument);
router.post('/:measureType/:id/use', authenticateToken, templateController.markTemplateUsed);
router.post('/:measureType/:id/favorite', authenticateToken, templateController.toggleFavorite);

module.exports = router;
