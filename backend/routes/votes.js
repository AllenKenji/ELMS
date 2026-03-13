const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const authorizeRoles = require('../middleware/roles');
const votingController = require('../controllers/votingController');

router.post('/sessions', authenticateToken, authorizeRoles('Admin', 'Secretary', 'Councilor'), votingController.createSession);
router.get('/sessions', authenticateToken, votingController.getSessions);
router.get('/analytics', authenticateToken, authorizeRoles('Admin', 'Secretary'), votingController.getAnalytics);
router.get('/sessions/:id', authenticateToken, votingController.getSessionById);
router.post('/cast', authenticateToken, authorizeRoles('Admin', 'Secretary', 'Councilor'), votingController.castVote);
router.put('/sessions/:id/close', authenticateToken, authorizeRoles('Admin', 'Secretary', 'Councilor'), votingController.closeSession);
router.delete('/sessions/:id', authenticateToken, authorizeRoles('Admin'), votingController.deleteSession);

module.exports = router;
