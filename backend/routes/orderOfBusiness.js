const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authenticateToken = require('../middleware/auth');
const authorizeRoles = require('../middleware/roles');
const ctrl = require('../controllers/orderOfBusinessController');

const oobLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'fail', message: 'Too many requests, please try again later.' },
});

// Reorder agenda items — must appear before /:id routes to prevent "reorder"
// being treated as an :id parameter value.
router.post('/reorder', oobLimiter, authenticateToken, authorizeRoles('Secretary', 'Admin'), ctrl.reorder);

// Batch-create multiple OOB items (full agenda)
router.post('/batch', oobLimiter, authenticateToken, authorizeRoles('Secretary', 'Admin'), ctrl.batchCreate);

// Get unassigned OOB items (no session yet)
router.get('/unassigned', oobLimiter, authenticateToken, ctrl.getUnassigned);

// Assign OOB items to a session
router.post('/assign-session', oobLimiter, authenticateToken, authorizeRoles('Secretary', 'Admin'), ctrl.assignToSession);

// Get all sessions that have OOB items (compiled list)
router.get('/sessions-with-oob', oobLimiter, authenticateToken, ctrl.getSessionsWithOob);

// Delete all OOB items for a session
router.delete('/session/:sessionId', oobLimiter, authenticateToken, authorizeRoles('Secretary', 'Admin'), ctrl.deleteBySession);

// Get full order of business for a session
router.get('/:sessionId/generate-pdf', oobLimiter, authenticateToken, ctrl.generatePdf);
router.get('/:sessionId', oobLimiter, authenticateToken, ctrl.getBySession);

// Create a new order-of-business item (Secretary and Admin only)
router.post('/', oobLimiter, authenticateToken, authorizeRoles('Secretary', 'Admin'), ctrl.create);

// Update an order-of-business item (Secretary and Admin only)
router.put('/:id', oobLimiter, authenticateToken, authorizeRoles('Secretary', 'Admin'), ctrl.update);

// Delete an order-of-business item (Secretary and Admin only)
router.delete('/:id', oobLimiter, authenticateToken, authorizeRoles('Secretary', 'Admin'), ctrl.remove);

// Update item status (Secretary and Admin only)
router.patch('/:id/status', oobLimiter, authenticateToken, authorizeRoles('Secretary', 'Admin'), ctrl.updateStatus);

module.exports = router;
