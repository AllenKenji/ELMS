const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authenticateToken = require('../middleware/auth');
const authorizeRoles = require('../middleware/roles');
const resolutionController = require('../controllers/resolutionController');
const upload = require('../middleware/upload');
// const { validateBody } = require('../middleware/validation');
// const { createResolutionSchema, updateResolutionSchema } = require('../validators/schemas');

const workflowLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'fail', message: 'Too many requests, please try again later.' },
});

router.post('/', authenticateToken, authorizeRoles('Councilor', 'Admin'), upload.array('attachments_files'), resolutionController.create);
router.put('/:id', authenticateToken, authorizeRoles('Secretary', 'Councilor', 'Admin'), upload.array('attachments_files'), resolutionController.update);
router.get('/', authenticateToken, resolutionController.getAll);
router.get('/:id', authenticateToken, resolutionController.getById);
router.delete('/:id', authenticateToken, authorizeRoles('Admin', 'Secretary'), resolutionController.remove);
router.get('/:id/workflow', authenticateToken, resolutionController.getWorkflow);
router.get('/:id/workflow-status', workflowLimiter, authenticateToken, resolutionController.getWorkflowStatus);
router.get('/:id/history', authenticateToken, resolutionController.getHistory);
router.get('/:id/approvals', authenticateToken, resolutionController.getApprovals);
router.put('/:id/status', authenticateToken, authorizeRoles('Admin', 'Secretary', 'Councilor'), resolutionController.changeStatus);
router.post('/:id/workflow-action', authenticateToken, resolutionController.workflowAction);
router.post('/:id/approvals', authenticateToken, authorizeRoles('Admin', 'Secretary'), resolutionController.createApproval);
router.put('/:id/approvals/:approvalId', authenticateToken, resolutionController.updateApproval);
router.get('/:id/generate-pdf', authenticateToken, resolutionController.generatePdf);
router.get('/:id/sessions', workflowLimiter, authenticateToken, resolutionController.getResolutionSessions);

// ─── Three-Readings Legislative Workflow ──────────────────────────────────────
router.get('/:id/committee-report', workflowLimiter, authenticateToken, resolutionController.getCommitteeReport);
router.post('/:id/submit-to-vice-mayor',  workflowLimiter, authenticateToken, authorizeRoles('Councilor', 'Admin'), resolutionController.submitToViceMayor);
router.post('/:id/first-reading',        workflowLimiter, authenticateToken, authorizeRoles('Secretary', 'Admin'), resolutionController.firstReading);
router.post('/:id/assign-committee',     workflowLimiter, authenticateToken, authorizeRoles('Vice Mayor', 'Secretary', 'Admin'), resolutionController.assignCommittee);
router.post('/:id/committee-report',     workflowLimiter, authenticateToken, authorizeRoles('Councilor', 'Committee Secretary', 'Admin'), resolutionController.committeeReport);
router.post('/:id/second-reading',       workflowLimiter, authenticateToken, authorizeRoles('Secretary', 'Admin'), resolutionController.secondReading);
router.post('/:id/open-voting',          workflowLimiter, authenticateToken, authorizeRoles('Secretary', 'Admin'), resolutionController.openThirdReadingVote);
router.post('/:id/cast-vote',            workflowLimiter, authenticateToken, authorizeRoles('Councilor', 'Secretary', 'Admin'), resolutionController.castThirdReadingVote);
router.get('/:id/voting-status',         workflowLimiter, authenticateToken, resolutionController.getThirdReadingVotingStatus);
router.post('/:id/close-voting',         workflowLimiter, authenticateToken, authorizeRoles('Secretary', 'Admin'), resolutionController.closeThirdReadingVote);
router.post('/:id/executive-approval',   workflowLimiter, authenticateToken, authorizeRoles('Vice Mayor', 'Admin'), resolutionController.executiveApproval);
router.post('/:id/executive-rejection',  workflowLimiter, authenticateToken, authorizeRoles('Vice Mayor', 'Admin'), resolutionController.executiveRejection);
router.post('/:id/post-publicly',        workflowLimiter, authenticateToken, authorizeRoles('Secretary', 'Admin'), resolutionController.postPublicly);
router.post('/:id/mark-effective',       workflowLimiter, authenticateToken, authorizeRoles('Secretary', 'Admin'), resolutionController.markEffective);

module.exports = router;
