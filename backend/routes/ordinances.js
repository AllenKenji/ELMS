const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const authorizeRoles = require('../middleware/roles');
const ordinanceController = require('../controllers/ordinanceController');
const { validateBody } = require('../middleware/validation');
const { createOrdinanceSchema, updateOrdinanceSchema } = require('../validators/schemas');

router.post('/', authenticateToken, authorizeRoles('Secretary', 'Councilor'), validateBody(createOrdinanceSchema), ordinanceController.create);
router.get('/', authenticateToken, ordinanceController.getAll);
router.get('/:id', authenticateToken, ordinanceController.getById);
router.put('/:id', authenticateToken, authorizeRoles('Secretary', 'Councilor', 'Admin'), validateBody(updateOrdinanceSchema), ordinanceController.update);
router.delete('/:id', authenticateToken, authorizeRoles('Admin', 'Secretary'), ordinanceController.remove);
router.get('/:id/workflow', authenticateToken, ordinanceController.getWorkflow);
router.get('/:id/history', authenticateToken, ordinanceController.getHistory);
router.get('/:id/approvals', authenticateToken, ordinanceController.getApprovals);
router.put('/:id/status', authenticateToken, authorizeRoles('Admin', 'Secretary'), ordinanceController.changeStatus);
router.post('/:id/workflow-action', authenticateToken, ordinanceController.workflowAction);
router.post('/:id/approvals', authenticateToken, authorizeRoles('Admin', 'Secretary'), ordinanceController.createApproval);
router.put('/:id/approvals/:approvalId', authenticateToken, ordinanceController.updateApproval);

module.exports = router;
