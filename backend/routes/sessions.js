const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authenticateToken = require('../middleware/auth');
const authorizeRoles = require('../middleware/roles');
const sessionController = require('../controllers/sessionController');

const sessionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'fail', message: 'Too many requests, please try again later.' },
});

router.post('/', authenticateToken, authorizeRoles('Secretary', 'Admin'), sessionController.create);
router.get('/', authenticateToken, sessionController.getAll);
router.get('/:id', authenticateToken, sessionController.getById);
router.put('/:id', authenticateToken, authorizeRoles('Secretary', 'Admin'), sessionController.update);
router.delete('/:id', authenticateToken, authorizeRoles('Admin'), sessionController.remove);
router.get('/:id/ordinances', authenticateToken, sessionController.getOrdinances);
router.get('/:id/participants', authenticateToken, sessionController.getParticipants);
router.post('/:id/participants', authenticateToken, authorizeRoles('Secretary', 'Admin'), sessionController.addParticipant);
router.put('/:id/participants/:userId', authenticateToken, sessionController.updateParticipant);
router.get('/:id/minutes', sessionLimiter, authenticateToken, sessionController.getMinutes);

// Session agenda items (for legislative workflow)
const ordinanceController = require('../controllers/ordinanceController');
router.get('/:id/agenda', authenticateToken, ordinanceController.getSessionAgenda);
router.post('/:id/add-agenda-item', authenticateToken, authorizeRoles('Secretary', 'Admin'), ordinanceController.addAgendaItem);

module.exports = router;
