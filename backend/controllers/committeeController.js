/**
 * End a committee meeting (set ended=true)
 * PATCH /committees/:id/meetings/:meetingId/end
 */
exports.endMeeting = async (req, res) => {
  try {
    await require('../services/committeeService').endMeeting(req.params.id, req.params.meetingId, req.user.id);
    res.json({ message: 'Meeting ended successfully' });
  } catch (err) {
    console.error('End committee meeting error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error ending committee meeting' });
  }
};
/**
 * Delete a committee meeting.
 * DELETE /committees/:committeeId/meetings/:meetingId
 */
exports.deleteMeeting = async (req, res) => {
  try {
    await require('../services/committeeService').deleteMeeting(req.params.id, req.params.meetingId, req.user.id);
    res.json({ message: 'Meeting deleted successfully' });
  } catch (err) {
    console.error('Delete committee meeting error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error deleting committee meeting' });
  }
};
/**
 * Create a meeting for a committee.
 * POST /committees/:id/meetings
 */
exports.createMeeting = async (req, res) => {
  try {
    const {
      title,
      meeting_date,
      meeting_time,
      ordinance_id,
      resolution_id,
      meetingLink,
      meeting_mode,
      meeting_location,
    } = req.body;
    if (!title || !meeting_date) {
      return res.status(400).json({ error: 'Meeting title and date are required' });
    }
    // Optionally, check if user is chair or secretary of this committee
    // (Authorization middleware can be added in routes)
    const meeting = await require('../services/committeeService').createMeeting(
      req.params.id,
      { title, meeting_date, meeting_time, ordinance_id, resolution_id, meetingLink, meeting_mode, meeting_location },
      req.user.id
    );
    // Expose meeting_link and minutes_id in the response
    res.status(201).json({
      ...meeting,
      meeting_link: meeting.meeting_link,
      minutes_id: meeting.minutes_id
    });
  } catch (err) {
    console.error('Create committee meeting error:', err);
    if (err.status === 400) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: 'Error creating committee meeting' });
  }
};

/**
 * Upload a committee meeting recording.
 * POST /committees/:id/meetings/:meetingId/recording
 */
exports.uploadMeetingRecording = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'A recording file is required.' });
    }

    const meeting = await require('../services/committeeService').saveMeetingRecording(
      req.params.id,
      req.params.meetingId,
      req.file,
      req.user.id
    );

    res.status(201).json(meeting);
  } catch (err) {
    console.error('Upload committee meeting recording error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    if (err.status === 400) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: 'Error uploading committee meeting recording' });
  }
};
/**
 * Committee Controller - Handles committee HTTP requests.
 */
const committeeService = require('../services/committeeService'); // Now uses CommitteeMinutes

/**
 * Get all meetings for a committee.
 * GET /committees/:id/meetings
 */
exports.getCommitteeMeetings = async (req, res) => {
  try {
    const committeeId = req.params.id;
    const meetings = await committeeService.getCommitteeMeetings(committeeId);
    res.json(meetings);
  } catch (err) {
    console.error('Get committee meetings error:', err);
    res.status(500).json({ error: 'Error fetching committee meetings' });
  }
};


/**
 * Create a new committee.
 * POST /committees
 */
exports.create = async (req, res) => {
  try {
    const committee = await committeeService.createCommittee(req.body, req.user.id);
    res.status(201).json(committee);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A committee with that name already exists' });
    console.error('Committee create error:', err);
    if (err.status === 400) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: 'Error creating committee' });
  }
};

/**
 * Get all committees.
 * GET /committees
 */
exports.getAll = async (req, res) => {
  try {
    const committees = await committeeService.getAllCommittees(req.query.status);
    res.json(committees);
  } catch (err) {
    console.error('Get committees error:', err);
    res.status(500).json({ error: 'Error fetching committees' });
  }
};

/**
 * Get a single committee with its members.
 * GET /committees/:id
 */
exports.getById = async (req, res) => {
  try {
    const committee = await committeeService.getCommitteeById(req.params.id);
    res.json(committee);
  } catch (err) {
    console.error('Get committee error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error fetching committee' });
  }
};

/**
 * Update a committee.
 * PUT /committees/:id
 */
exports.update = async (req, res) => {
  try {
    const committee = await committeeService.updateCommittee(req.params.id, req.body, req.user.id);
    res.json(committee);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A committee with that name already exists' });
    console.error('Update committee error:', err);
    if (err.status === 400) return res.status(400).json({ error: err.message });
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error updating committee' });
  }
};

/**
 * Delete a committee.
 * DELETE /committees/:id
 */
exports.remove = async (req, res) => {
  try {
    await committeeService.deleteCommittee(req.params.id, req.user.id);
    res.json({ message: 'Committee deleted successfully' });
  } catch (err) {
    console.error('Delete committee error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error deleting committee' });
  }
};

/**
 * Get members of a committee.
 * GET /committees/:id/members
 */
exports.getMembers = async (req, res) => {
  try {
    const members = await committeeService.getMembers(req.params.id);
    res.json(members);
  } catch (err) {
    console.error('Get committee members error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error fetching committee members' });
  }
};

/**
 * Add a member to a committee.
 * POST /committees/:id/members
 */
exports.addMember = async (req, res) => {
  try {
    const member = await committeeService.addMember(req.params.id, req.body, req.user.id);
    res.status(201).json(member);
  } catch (err) {
    if (err.code === '23505' || err.status === 409) return res.status(409).json({ error: err.message || 'User is already a member of this committee' });
    console.error('Add committee member error:', err);
    if (err.status === 400) return res.status(400).json({ error: err.message });
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error adding committee member' });
  }
};

/**
 * Remove a member from a committee.
 * DELETE /committees/:id/members/:memberId
 */
exports.removeMember = async (req, res) => {
  try {
    await committeeService.removeMember(req.params.id, req.params.memberId, req.user.id);
    res.json({ message: 'Committee member removed successfully' });
  } catch (err) {
    console.error('Remove committee member error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error removing committee member' });
  }
};
