const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const authorizeRoles = require('../middleware/roles');
const Committee = require('../models/Committee');
const meetingRecordingUpload = require('../middleware/meetingRecordingUpload');

const COMMITTEE_MEETING_ROLES = new Set(['Chair', 'Secretary', 'Committee Secretary']);

async function loadCommitteeContext(committeeId) {
	const committeeResult = await Committee.findById(committeeId);
	if (!committeeResult.rows.length) {
		return null;
	}

	const committee = committeeResult.rows[0];
	const membersResult = await Committee.findMembers(committeeId);
	const members = membersResult.rows || [];

	return { committee, members };
}

async function authorizeCommitteeMeetingView(req, res, next) {
	try {
		if (!req.user || !req.user.role || !req.user.id) {
			return res.status(401).json({ error: 'No user information found in token' });
		}

		if (req.user.role === 'Admin' || req.user.role === 1 || req.user.role === 'Vice Mayor' || req.user.role === 'Secretary') {
			return next();
		}

		const context = await loadCommitteeContext(req.params.id);
		if (!context) {
			return res.status(404).json({ error: 'Committee not found' });
		}

		const isChair = String(context.committee.chair_id) === String(req.user.id);
		const isAllowedMember = context.members.some(
			(member) => String(member.user_id) === String(req.user.id)
		);

		if (isChair || isAllowedMember) {
			return next();
		}

		return res.status(403).json({ error: 'Access denied: committee membership required' });
	} catch (err) {
		console.error('Committee meeting authorization error:', err);
		return res.status(500).json({ error: 'Authorization error' });
	}
}

async function authorizeCommitteeMeetingManagement(req, res, next) {
	try {
		if (!req.user || !req.user.role || !req.user.id) {
			return res.status(401).json({ error: 'No user information found in token' });
		}

		if (req.user.role === 'Admin' || req.user.role === 1 || req.user.role === 'Vice Mayor') {
			return next();
		}

		const context = await loadCommitteeContext(req.params.id);
		if (!context) {
			return res.status(404).json({ error: 'Committee not found' });
		}

		const isChair = String(context.committee.chair_id) === String(req.user.id);
		const isAllowedMember = context.members.some(
			(member) => String(member.user_id) === String(req.user.id) && COMMITTEE_MEETING_ROLES.has(member.role)
		);

		if (isChair || isAllowedMember) {
			return next();
		}

		return res.status(403).json({ error: 'Access denied: committee membership required' });
	} catch (err) {
		console.error('Committee meeting authorization error:', err);
		return res.status(500).json({ error: 'Authorization error' });
	}
}

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
router.post('/:id/meetings', authenticateToken, authorizeCommitteeMeetingManagement, committeeController.createMeeting);
router.post('/:id/meetings/:meetingId/recording', authenticateToken, authorizeCommitteeMeetingManagement, meetingRecordingUpload.single('recording_file'), committeeController.uploadMeetingRecording);
router.get('/:id/meetings', authenticateToken, authorizeCommitteeMeetingView, committeeController.getCommitteeMeetings);
router.delete('/:id/meetings/:meetingId', authenticateToken, authorizeCommitteeMeetingManagement, committeeController.deleteMeeting);
router.patch('/:id/meetings/:meetingId/end', authenticateToken, authorizeCommitteeMeetingManagement, committeeController.endMeeting);
router.get('/', authenticateToken, committeeController.getAll);
router.get('/:id', authenticateToken, committeeController.getById);
router.put('/:id', authenticateToken, authorizeAdminOrChair, committeeController.update);
router.delete('/:id', authenticateToken, authorizeRoles('Admin'), committeeController.remove);
router.get('/:id/members', authenticateToken, committeeController.getMembers);
router.post('/:id/members', authenticateToken, authorizeRoles('Admin', 'Secretary'), committeeController.addMember);
router.delete('/:id/members/:memberId', authenticateToken, authorizeRoles('Admin', 'Secretary'), committeeController.removeMember);

module.exports = router;
