const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authenticateToken = require('../middleware/auth');
const authorizeRoles = require('../middleware/roles');
const ordinanceController = require('../controllers/ordinanceController');
const { validateBody } = require('../middleware/validation');
const { createOrdinanceSchema, updateOrdinanceSchema } = require('../validators/schemas');

const workflowLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'fail', message: 'Too many requests, please try again later.' },
});

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
router.get('/:id/workflow-status', workflowLimiter, authenticateToken, ordinanceController.getWorkflowStatus);
router.get('/:id/committee-report', workflowLimiter, authenticateToken, ordinanceController.getCommitteeReport);
router.post('/:id/submit-to-secretary',  workflowLimiter, authenticateToken, authorizeRoles('Councilor', 'Secretary', 'Admin'), ordinanceController.submitToSecretary);
router.post('/:id/first-reading',        workflowLimiter, authenticateToken, authorizeRoles('Secretary', 'Admin'), ordinanceController.firstReading);
router.post('/:id/assign-committee',     workflowLimiter, authenticateToken, authorizeRoles('Secretary', 'Admin'), ordinanceController.assignCommittee);
router.post('/:id/committee-report',     workflowLimiter, authenticateToken, authorizeRoles('Secretary', 'Admin', 'Captain'), ordinanceController.committeeReport);
router.post('/:id/second-reading',       workflowLimiter, authenticateToken, authorizeRoles('Secretary', 'Admin'), ordinanceController.secondReading);
router.post('/:id/third-reading-vote',   workflowLimiter, authenticateToken, authorizeRoles('Secretary', 'Admin'), ordinanceController.thirdReadingVote);
router.post('/:id/executive-approval',   workflowLimiter, authenticateToken, authorizeRoles('Captain', 'Admin'), ordinanceController.executiveApproval);
router.post('/:id/executive-rejection',  workflowLimiter, authenticateToken, authorizeRoles('Captain', 'Admin'), ordinanceController.executiveRejection);
router.post('/:id/post-publicly',        workflowLimiter, authenticateToken, authorizeRoles('Secretary', 'Admin'), ordinanceController.postPublicly);
router.post('/:id/mark-effective',       workflowLimiter, authenticateToken, authorizeRoles('Secretary', 'Admin'), ordinanceController.markEffective);

module.exports = router;
