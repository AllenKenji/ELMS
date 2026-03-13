/**
 * Voting Service - Business logic for voting sessions and votes.
 */
const Vote = require('../models/Vote');
const AuditLog = require('../models/AuditLog');
const { createNotification } = require('../utils/notifications');
const { getIO } = require('../socket');

/**
 * Create a new voting session.
 * @param {object} data
 * @param {number} userId
 * @returns {Promise<object>}
 */
exports.createVotingSession = async ({ title, description, ordinance_id, resolution_id, question, voting_type }, userId) => {
  if (!title || !question) {
    const err = new Error('Title and question are required');
    err.status = 400;
    throw err;
  }

  const validTypes = ['yes_no', 'yes_no_abstain'];
  const type = validTypes.includes(voting_type) ? voting_type : 'yes_no';

  const result = await Vote.createSession(title, description, ordinance_id, resolution_id, question, type, userId);
  const session = result.rows[0];

  await AuditLog.create(null, userId, 'VOTING_SESSION_CREATE', `Voting session "${title}" created`);

  const councilors = await Vote.findCouncilors();
  for (const c of councilors.rows) {
    await createNotification(c.id, `New voting session: "${title}"`);
  }

  const io = getIO();
  io.emit('votingSessionCreated', session);

  return session;
};

/**
 * Retrieve all voting sessions.
 * @returns {Promise<Array>}
 */
exports.getAllVotingSessions = async () => {
  const result = await Vote.findAllSessions();
  return result.rows;
};

/**
 * Retrieve a single voting session with full results.
 * @param {string|number} id
 * @param {number} currentUserId
 * @returns {Promise<object>}
 */
exports.getVotingSessionById = async (id, currentUserId) => {
  const sessionResult = await Vote.findSessionById(id);
  if (sessionResult.rows.length === 0) {
    const err = new Error('Voting session not found');
    err.status = 404;
    throw err;
  }

  const session = sessionResult.rows[0];
  const resultsQuery = await Vote.getResults(id);
  const participantsQuery = await Vote.getParticipants(id);
  const userVoteQuery = await Vote.findUserVote(id, currentUserId);

  return {
    session,
    results: resultsQuery.rows,
    participants: participantsQuery.rows,
    totalVotes: participantsQuery.rows.length,
    userVote: userVoteQuery.rows[0]?.vote_option || null,
  };
};

/**
 * Cast a vote in a voting session.
 * @param {string|number} sessionId
 * @param {string} voteOption
 * @param {number} userId
 * @returns {Promise<object>}
 */
exports.castVote = async (sessionId, voteOption, userId) => {
  if (!sessionId || !voteOption) {
    const err = new Error('session_id and vote_option are required');
    err.status = 400;
    throw err;
  }

  const sessionResult = await Vote.findSessionById(sessionId);
  if (sessionResult.rows.length === 0) {
    const err = new Error('Voting session not found');
    err.status = 404;
    throw err;
  }

  const session = sessionResult.rows[0];
  if (session.status !== 'active') {
    const err = new Error('This voting session is no longer active');
    err.status = 400;
    throw err;
  }

  const allowedOptions = session.voting_type === 'yes_no_abstain'
    ? ['Yes', 'No', 'Abstain']
    : ['Yes', 'No'];

  if (!allowedOptions.includes(voteOption)) {
    const err = new Error(`Invalid vote option. Allowed: ${allowedOptions.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const existing = await Vote.findExistingVote(sessionId, userId);
  if (existing.rows.length > 0) {
    const err = new Error('You have already voted in this session');
    err.status = 400;
    throw err;
  }

  const result = await Vote.castVote(sessionId, userId, voteOption);
  await AuditLog.create(null, userId, 'VOTE_CAST', `Vote "${voteOption}" cast in session "${session.title}"`);

  const updatedResults = await Vote.getResults(sessionId);
  const totalVotes = await Vote.getTotalVotes(sessionId);

  const io = getIO();
  io.emit('voteCast', {
    session_id: sessionId,
    results: updatedResults.rows,
    totalVotes: totalVotes.rows[0].total,
  });

  return { success: true, vote: result.rows[0] };
};

/**
 * Close a voting session.
 * @param {string|number} id
 * @param {number} userId
 * @returns {Promise<object>}
 */
exports.closeVotingSession = async (id, userId) => {
  const sessionResult = await Vote.findSessionById(id);
  if (sessionResult.rows.length === 0) {
    const err = new Error('Voting session not found');
    err.status = 404;
    throw err;
  }

  if (sessionResult.rows[0].status === 'closed') {
    const err = new Error('Voting session is already closed');
    err.status = 400;
    throw err;
  }

  const result = await Vote.closeSession(id);
  const session = result.rows[0];

  await AuditLog.create(null, userId, 'VOTING_SESSION_CLOSE', `Voting session "${session.title}" closed`);

  const io = getIO();
  io.emit('votingSessionClosed', session);

  return session;
};

/**
 * Delete a voting session.
 * @param {string|number} id
 * @param {number} userId
 * @returns {Promise<void>}
 */
exports.deleteVotingSession = async (id, userId) => {
  const sessionResult = await Vote.findSessionById(id);
  if (sessionResult.rows.length === 0) {
    const err = new Error('Voting session not found');
    err.status = 404;
    throw err;
  }

  const sessionTitle = sessionResult.rows[0].title;
  await Vote.deleteSession(id);
  await AuditLog.create(null, userId, 'VOTING_SESSION_DELETE', `Voting session "${sessionTitle}" deleted`);

  const io = getIO();
  io.emit('votingSessionDeleted', { id: parseInt(id) });
};

/**
 * Get voting analytics.
 * @returns {Promise<object>}
 */
exports.getAnalytics = async () => {
  const { totals, totalVotes, recentSessions } = await Vote.getAnalytics();
  return {
    ...totals,
    total_votes: totalVotes.total_votes,
    recent_sessions: recentSessions,
  };
};
