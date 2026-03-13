const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const authorizeRoles = require('../middleware/roles');
const reportController = require('../controllers/reportController');

router.post('/', authenticateToken, authorizeRoles('Admin', 'Secretary', 'Councilor', 'DILG Official'), reportController.create);
router.get('/', authenticateToken, reportController.getAll);
router.get('/:id/export/csv', authenticateToken, reportController.exportCsv);
router.get('/:id/export/pdf', authenticateToken, reportController.exportPdf);
router.get('/:id', authenticateToken, reportController.getById);
router.put('/:id', authenticateToken, authorizeRoles('Admin', 'Secretary', 'Councilor', 'DILG Official'), reportController.update);
router.delete('/:id', authenticateToken, authorizeRoles('Admin', 'Secretary'), reportController.remove);

module.exports = router;
