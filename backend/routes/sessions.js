const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const authorizeRoles = require('../middleware/roles');
const sessionController = require('../controllers/sessionController');

router.post('/', authenticateToken, authorizeRoles('Secretary', 'Admin'), sessionController.create);
router.get('/', authenticateToken, sessionController.getAll);
router.get('/:id', authenticateToken, sessionController.getById);
router.put('/:id', authenticateToken, authorizeRoles('Secretary', 'Admin'), sessionController.update);
router.delete('/:id', authenticateToken, authorizeRoles('Admin'), sessionController.remove);
router.get('/:id/ordinances', authenticateToken, sessionController.getOrdinances);
router.get('/:id/participants', authenticateToken, sessionController.getParticipants);
router.post('/:id/participants', authenticateToken, authorizeRoles('Secretary', 'Admin'), sessionController.addParticipant);
router.put('/:id/participants/:userId', authenticateToken, sessionController.updateParticipant);

module.exports = router;
