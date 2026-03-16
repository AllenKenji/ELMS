const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const authorizeRoles = require('../middleware/roles');
const ordinanceController = require('../controllers/ordinanceController');
const { validateBody } = require('../middleware/validation');
const { createOrdinanceSchema, updateOrdinanceSchema } = require('../validators/schemas');

router.post('/', authenticateToken, authorizeRoles('Secretary', 'Councilor', 'Admin'), validateBody(createOrdinanceSchema), ordinanceController.create);

router.put('/:id', authenticateToken, authorizeRoles('Secretary', 'Councilor', 'Admin'), validateBody(updateOrdinanceSchema), ordinanceController.update);router.get('/', authenticateToken, ordinanceController.getAll);
router.get('/:id', authenticateToken, ordinanceController.getById);
router.delete('/:id', authenticateToken, authorizeRoles('Admin', 'Secretary'), ordinanceController.remove);
router.get('/:id/workflow', authenticateToken, ordinanceController.getWorkflow);
router.get('/:id/history', authenticateToken, ordinanceController.getHistory);
router.get('/:id/approvals', authenticateToken, ordinanceController.getApprovals);
router.put('/:id/status', authenticateToken, authorizeRoles('Admin', 'Secretary'), ordinanceController.changeStatus);
router.post('/:id/workflow-action', authenticateToken, ordinanceController.workflowAction);
router.post('/:id/approvals', authenticateToken, authorizeRoles('Admin', 'Secretary'), ordinanceController.createApproval);
router.put('/:id/approvals/:approvalId', authenticateToken, ordinanceController.updateApproval);
router.get('/:id/generate-pdf', authenticateToken, ordinanceController.generatePdf);

// ─── Three-Readings Legislative Workflow ──────────────────────────────────────
router.get('/:id/workflow-status', authenticateToken, ordinanceController.getWorkflowStatus);
router.get('/:id/committee-report', authenticateToken, ordinanceController.getCommitteeReport);
router.post('/:id/submit-to-secretary',  authenticateToken, authorizeRoles('Councilor', 'Secretary', 'Admin', 'Captain'), ordinanceController.submitToSecretary);
router.post('/:id/first-reading',        authenticateToken, authorizeRoles('Secretary', 'Admin'), ordinanceController.firstReading);
router.post('/:id/assign-committee',     authenticateToken, authorizeRoles('Secretary', 'Admin'), ordinanceController.assignCommittee);
router.post('/:id/committee-report',     authenticateToken, authorizeRoles('Secretary', 'Admin', 'Captain'), ordinanceController.committeeReport);
router.post('/:id/second-reading',       authenticateToken, authorizeRoles('Secretary', 'Admin'), ordinanceController.secondReading);
router.post('/:id/third-reading-vote',   authenticateToken, authorizeRoles('Secretary', 'Admin'), ordinanceController.thirdReadingVote);
router.post('/:id/executive-approval',   authenticateToken, authorizeRoles('Captain', 'Admin'), ordinanceController.executiveApproval);
router.post('/:id/executive-rejection',  authenticateToken, authorizeRoles('Captain', 'Admin'), ordinanceController.executiveRejection);
router.post('/:id/post-publicly',        authenticateToken, authorizeRoles('Secretary', 'Admin'), ordinanceController.postPublicly);
router.post('/:id/mark-effective',       authenticateToken, authorizeRoles('Secretary', 'Admin'), ordinanceController.markEffective);

module.exports = router;
