/**
 * Vote Model - Data access layer for voting sessions and votes.
 */
const pool = require('../db');

/** @returns {Promise<import('pg').QueryResult>} */
exports.findAllSessions = async () => {
  return pool.query(
    `SELECT vs.*, u.name as created_by_name,
            COUNT(DISTINCT v.id)::int as total_votes
     FROM voting_sessions vs
     LEFT JOIN users u ON u.id = vs.created_by
     LEFT JOIN votes v ON v.session_id = vs.id
     GROUP BY vs.id, u.name
     ORDER BY vs.created_at DESC`
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.findSessionById = async (id) => {
  return pool.query(
    `SELECT vs.*, u.name as created_by_name
     FROM voting_sessions vs
     LEFT JOIN users u ON u.id = vs.created_by
     WHERE vs.id = $1`,
    [id]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.createSession = async (title, description, ordinanceId, resolutionId, question, votingType, createdBy) => {
  return pool.query(
    `INSERT INTO voting_sessions (title, description, ordinance_id, resolution_id, question, voting_type, created_by, status, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', NOW())
     RETURNING *`,
    [title, description || null, ordinanceId || null, resolutionId || null, question, votingType, createdBy]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.getResults = async (sessionId) => {
  return pool.query(
    `SELECT vote_option,
            COUNT(*)::int as count,
            ROUND(COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM votes WHERE session_id = $1), 0), 2) as percentage
     FROM votes
     WHERE session_id = $1
     GROUP BY vote_option
     ORDER BY vote_option`,
    [sessionId]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.getParticipants = async (sessionId) => {
  return pool.query(
    `SELECT u.id, u.name, u.email, v.vote_option, v.voted_at
     FROM votes v
     JOIN users u ON u.id = v.user_id
     WHERE v.session_id = $1
     ORDER BY v.voted_at DESC`,
    [sessionId]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.findUserVote = async (sessionId, userId) => {
  return pool.query(
    'SELECT vote_option FROM votes WHERE session_id = $1 AND user_id = $2',
    [sessionId, userId]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.findExistingVote = async (sessionId, userId) => {
  return pool.query(
    'SELECT id FROM votes WHERE session_id = $1 AND user_id = $2',
    [sessionId, userId]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.castVote = async (sessionId, userId, voteOption) => {
  return pool.query(
    `INSERT INTO votes (session_id, user_id, vote_option, voted_at)
     VALUES ($1, $2, $3, NOW())
     RETURNING *`,
    [sessionId, userId, voteOption]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.getTotalVotes = async (sessionId) => {
  return pool.query(
    'SELECT COUNT(*)::int as total FROM votes WHERE session_id = $1',
    [sessionId]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.closeSession = async (id) => {
  return pool.query(
    `UPDATE voting_sessions SET status = 'closed', closed_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.deleteSession = async (id) => {
  return pool.query('DELETE FROM voting_sessions WHERE id = $1', [id]);
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.getAnalytics = async () => {
  const totals = await pool.query(
    `SELECT
       COUNT(*)::int as total_sessions,
       COUNT(*) FILTER (WHERE status = 'active')::int as active_sessions,
       COUNT(*) FILTER (WHERE status = 'closed')::int as closed_sessions
     FROM voting_sessions`
  );
  const totalVotes = await pool.query(
    'SELECT COUNT(*)::int as total_votes FROM votes'
  );
  const recentSessions = await pool.query(
    `SELECT vs.id, vs.title, vs.status, vs.created_at,
            COUNT(v.id)::int as vote_count
     FROM voting_sessions vs
     LEFT JOIN votes v ON v.session_id = vs.id
     GROUP BY vs.id
     ORDER BY vs.created_at DESC
     LIMIT 5`
  );
  return { totals: totals.rows[0], totalVotes: totalVotes.rows[0], recentSessions: recentSessions.rows };
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.findCouncilors = async () => {
  return pool.query(
    `SELECT u.id FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE r.role_name = 'Councilor'`
  );
};
