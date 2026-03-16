const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const authorizeRoles = require('../middleware/roles');
const minutesController = require('../controllers/minutesController');

router.post('/', authenticateToken, authorizeRoles('Admin', 'Secretary'), minutesController.create);
router.post('/:id/generate', authenticateToken, authorizeRoles('Admin', 'Secretary'), minutesController.generate);
router.get('/', authenticateToken, minutesController.getAll);
router.get('/:id', authenticateToken, minutesController.getById);
router.get('/:id/export/text', authenticateToken, minutesController.exportText);
router.put('/:id', authenticateToken, authorizeRoles('Admin', 'Secretary'), minutesController.update);
router.delete('/:id', authenticateToken, authorizeRoles('Admin', 'Secretary'), minutesController.remove);

module.exports = router;
