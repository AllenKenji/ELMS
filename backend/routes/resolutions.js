const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const authorizeRoles = require('../middleware/roles');
const resolutionController = require('../controllers/resolutionController');

router.post('/', authenticateToken, authorizeRoles('Secretary', 'Admin'), resolutionController.create);
router.get('/', authenticateToken, resolutionController.getAll);
router.get('/:id', authenticateToken, resolutionController.getById);
router.put('/:id', authenticateToken, authorizeRoles('Secretary', 'Admin'), resolutionController.update);
router.delete('/:id', authenticateToken, authorizeRoles('Admin'), resolutionController.remove);
router.patch('/:id/status', authenticateToken, authorizeRoles('Secretary', 'Admin'), resolutionController.changeStatus);
router.get('/:id/generate-pdf', authenticateToken, resolutionController.generatePdf);

module.exports = router;
