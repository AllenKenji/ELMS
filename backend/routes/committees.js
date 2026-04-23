const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const authorizeRoles = require('../middleware/roles');
const Committee = require('../models/Committee');
const meetingRecordingUpload = require('../middleware/meetingRecordingUpload');

// Custom middleware: allow only Admin or the assigned Chairperson
async function authorizeAdminOrChair(req, res, next) {
	try {
		if (!req.user || !req.user.role || !req.user.id) {
			return res.status(401).json({ error: 'No user information found in token' });
		}
		// Allow Admin or Vice Mayor
		if (req.user.role === 'Admin' || req.user.role === 1 || req.user.role === 'Vice Mayor') return next();
		// Check if user is the chairperson of the committee
		const committeeId = req.params.id;
		const committeeResult = await Committee.findById(committeeId);
		if (!committeeResult.rows.length) {
			return res.status(404).json({ error: 'Committee not found' });
		}
		const committee = committeeResult.rows[0];
		if (String(committee.chair_id) === String(req.user.id)) {
			return next();
		}
		return res.status(403).json({ error: 'Access denied: only Admin or Chairperson can update this committee' });
	} catch (err) {
		console.error('Authorization error:', err);
		return res.status(500).json({ error: 'Authorization error' });
	}
}
const committeeController = require('../controllers/committeeController');

router.post('/', authenticateToken, authorizeRoles('Admin', 'Vice Mayor'), committeeController.create);
router.post('/:id/meetings', authenticateToken, committeeController.createMeeting);
router.post('/:id/meetings/:meetingId/recording', authenticateToken, meetingRecordingUpload.single('recording_file'), committeeController.uploadMeetingRecording);
router.get('/:id/meetings', authenticateToken, committeeController.getCommitteeMeetings);
router.delete('/:id/meetings/:meetingId', authenticateToken, committeeController.deleteMeeting);
router.patch('/:id/meetings/:meetingId/end', authenticateToken, committeeController.endMeeting);
router.get('/', authenticateToken, committeeController.getAll);
router.get('/:id', authenticateToken, committeeController.getById);
router.put('/:id', authenticateToken, authorizeAdminOrChair, committeeController.update);
router.delete('/:id', authenticateToken, authorizeRoles('Admin'), committeeController.remove);
router.get('/:id/members', authenticateToken, committeeController.getMembers);
router.post('/:id/members', authenticateToken, authorizeRoles('Admin', 'Secretary'), committeeController.addMember);
router.delete('/:id/members/:memberId', authenticateToken, authorizeRoles('Admin', 'Secretary'), committeeController.removeMember);

module.exports = router;
