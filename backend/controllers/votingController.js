/**
 * Voting Controller - Handles voting session and vote HTTP requests.
 */
const votingService = require('../services/votingService');

/**
 * Create a new voting session.
 * POST /votes/sessions
 */
exports.createSession = async (req, res) => {
  try {
    const session = await votingService.createVotingSession(req.body, req.user.id);
    res.json(session);
  } catch (err) {
    console.error('Create voting session error:', err);
    if (err.status === 400) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: 'Error creating voting session' });
  }
};

/**
 * Get all voting sessions.
 * GET /votes/sessions
 */
exports.getSessions = async (req, res) => {
  try {
    const sessions = await votingService.getAllVotingSessions();
    res.json(sessions);
  } catch (err) {
    console.error('Get voting sessions error:', err);
    res.status(500).json({ error: 'Error fetching voting sessions' });
  }
};

/**
 * Get a single voting session with full results.
 * GET /votes/sessions/:id
 */
exports.getSessionById = async (req, res) => {
  try {
    const result = await votingService.getVotingSessionById(req.params.id, req.user.id);
    res.json(result);
  } catch (err) {
    console.error('Get voting session error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error fetching voting session' });
  }
};

/**
 * Cast a vote.
 * POST /votes/cast
 */
exports.castVote = async (req, res) => {
  try {
    const result = await votingService.castVote(req.body.session_id, req.body.vote_option, req.user.id);
    res.json(result);
  } catch (err) {
    console.error('Cast vote error:', err);
    if (err.status === 400) return res.status(400).json({ error: err.message });
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error casting vote' });
  }
};

/**
 * Close a voting session.
 * PUT /votes/sessions/:id/close
 */
exports.closeSession = async (req, res) => {
  try {
    const session = await votingService.closeVotingSession(req.params.id, req.user.id);
    res.json(session);
  } catch (err) {
    console.error('Close voting session error:', err);
    if (err.status === 400) return res.status(400).json({ error: err.message });
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error closing voting session' });
  }
};

/**
 * Delete a voting session.
 * DELETE /votes/sessions/:id
 */
exports.deleteSession = async (req, res) => {
  try {
    await votingService.deleteVotingSession(req.params.id, req.user.id);
    res.json({ message: 'Voting session deleted successfully' });
  } catch (err) {
    console.error('Delete voting session error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error deleting voting session' });
  }
};

/**
 * Get voting analytics.
 * GET /votes/analytics
 */
exports.getAnalytics = async (req, res) => {
  try {
    const analytics = await votingService.getAnalytics();
    res.json(analytics);
  } catch (err) {
    console.error('Get analytics error:', err);
    res.status(500).json({ error: 'Error fetching analytics' });
  }
};
