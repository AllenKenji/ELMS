/**
 * Session Controller - Handles legislative session HTTP requests.
 */
const sessionService = require('../services/sessionService');

/**
 * Create a new session.
 * POST /sessions
 */
exports.create = async (req, res) => {
  try {
    const session = await sessionService.createSession(req.body, req.user.id);
    res.json(session);
  } catch (err) {
    console.error('Session create error:', err);
    res.status(500).json({ error: 'Error creating session' });
  }
};

/**
 * Get all sessions.
 * GET /sessions
 */
exports.getAll = async (req, res) => {
  try {
    const sessions = await sessionService.getAllSessions();
    res.json(sessions);
  } catch (err) {
    console.error('Get sessions error:', err);
    res.status(500).json({ error: 'Error fetching sessions' });
  }
};

/**
 * Get a single session by ID.
 * GET /sessions/:id
 */
exports.getById = async (req, res) => {
  try {
    const session = await sessionService.getSessionById(req.params.id);
    res.json(session);
  } catch (err) {
    console.error('Get session error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error fetching session' });
  }
};

/**
 * Update a session.
 * PUT /sessions/:id
 */
exports.update = async (req, res) => {
  try {
    const session = await sessionService.updateSession(req.params.id, req.body, req.user.id);
    res.json(session);
  } catch (err) {
    console.error('Update session error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error updating session' });
  }
};

/**
 * Delete a session.
 * DELETE /sessions/:id
 */
exports.remove = async (req, res) => {
  try {
    await sessionService.deleteSession(req.params.id, req.user.id);
    res.json({ message: 'Session deleted successfully' });
  } catch (err) {
    console.error('Delete session error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error deleting session' });
  }
};

/**
 * Get ordinances in a session.
 * GET /sessions/:id/ordinances
 */
exports.getOrdinances = async (req, res) => {
  try {
    const ordinances = await sessionService.getSessionOrdinances(req.params.id);
    res.json(ordinances);
  } catch (err) {
    console.error('Get session ordinances error:', err);
    res.status(500).json({ error: 'Error fetching ordinances' });
  }
};

/**
 * Get participants in a session.
 * GET /sessions/:id/participants
 */
exports.getParticipants = async (req, res) => {
  try {
    const participants = await sessionService.getParticipants(req.params.id);
    res.json(participants);
  } catch (err) {
    console.error('Get participants error:', err);
    res.status(500).json({ error: 'Error fetching participants' });
  }
};

/**
 * Add a participant to a session.
 * POST /sessions/:id/participants
 */
exports.addParticipant = async (req, res) => {
  try {
    const participant = await sessionService.addParticipant(req.params.id, req.body.user_id);
    res.json(participant);
  } catch (err) {
    console.error('Add participant error:', err);
    if (err.status === 400) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: 'Error adding participant' });
  }
};

/**
 * Update a participant's attendance status.
 * PUT /sessions/:id/participants/:userId
 */
exports.updateParticipant = async (req, res) => {
  try {
    const participant = await sessionService.updateParticipantAttendance(
      req.params.id,
      req.params.userId,
      req.body.attendance_status
    );
    res.json(participant);
  } catch (err) {
    console.error('Update participant error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error updating participant' });
  }
};

/**
 * Get meeting minutes for a session.
 * GET /sessions/:id/minutes
 */
exports.getMinutes = async (req, res) => {
  try {
    const minutes = await sessionService.getSessionMinutes(req.params.id);
    res.json(minutes);
  } catch (err) {
    console.error('Get session minutes error:', err);
    res.status(500).json({ error: 'Error fetching meeting minutes for session' });
  }
};
