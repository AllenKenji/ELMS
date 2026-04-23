
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authenticateToken = require('../middleware/auth');
const authorizeRoles = require('../middleware/roles');
const sessionRecordingUpload = require('../middleware/sessionRecordingUpload');
const sessionController = require('../controllers/sessionController');
const ordinanceController = require('../controllers/ordinanceController');
const sessionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
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
router.post('/:id/participants/from-oob', authenticateToken, authorizeRoles('Secretary', 'Admin'), sessionController.addParticipantsFromOob);
router.put('/:id/participants/:userId', authenticateToken, sessionController.updateParticipant);
router.get('/:id/minutes', sessionLimiter, authenticateToken, sessionController.getMinutes);
router.post('/:id/recording', authenticateToken, authorizeRoles('Secretary', 'Admin', 'Vice Mayor', 'Councilor'), sessionRecordingUpload.single('recording_file'), sessionController.uploadRecording);
router.get('/:id/committee-reports', authenticateToken, sessionController.getCommitteeReports);

// Session agenda items (for legislative workflow)
router.get('/:id/agenda', sessionLimiter, authenticateToken, ordinanceController.getSessionAgenda);
router.post('/:id/add-agenda-item', sessionLimiter, authenticateToken, authorizeRoles('Secretary', 'Admin'), ordinanceController.addAgendaItem);
router.delete('/:id/agenda-item/resolution/:resolutionId', sessionLimiter, authenticateToken, authorizeRoles('Secretary', 'Admin'), ordinanceController.removeResolutionAgendaItem);
router.delete('/:id/agenda-item/:ordinanceId', sessionLimiter, authenticateToken, authorizeRoles('Secretary', 'Admin'), ordinanceController.removeAgendaItem);

module.exports = router;
