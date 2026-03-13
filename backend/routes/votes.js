const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const authorizeRoles = require('../middleware/roles');
const { createNotification } = require('../utils/notifications');
const { getIO } = require('../socket');

// ============================================
// VOTING SESSION ENDPOINTS
// ============================================

// CREATE a new voting session (Admin, Secretary, Councilor)
router.post('/sessions', authenticateToken, authorizeRoles('Admin', 'Secretary', 'Councilor'), async (req, res) => {
  const { title, description, ordinance_id, resolution_id, question, voting_type } = req.body;
  try {
    if (!title || !question) {
      return res.status(400).json({ error: 'Title and question are required' });
    }

    const validTypes = ['yes_no', 'yes_no_abstain'];
    const type = validTypes.includes(voting_type) ? voting_type : 'yes_no';

    const result = await pool.query(
      `INSERT INTO voting_sessions (title, description, ordinance_id, resolution_id, question, voting_type, created_by, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', NOW())
       RETURNING *`,
      [title, description || null, ordinance_id || null, resolution_id || null, question, type, req.user.id]
    );

    const session = result.rows[0];

    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details, timestamp)
       VALUES ($1, $2, $3, NOW())`,
      [req.user.id, 'VOTING_SESSION_CREATE', `Voting session "${title}" created`]
    );

    // Notify all councilors (role_id 3 = Councilor per seed data)
    const councilors = await pool.query(
      `SELECT u.id FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE r.role_name = 'Councilor'`
    );
    for (const c of councilors.rows) {
      await createNotification(c.id, `New voting session: "${title}"`);
    }

    const io = getIO();
    io.emit('votingSessionCreated', session);

    res.json(session);
  } catch (err) {
    console.error('Create voting session error:', err);
    res.status(500).json({ error: 'Error creating voting session' });
  }
});

// GET all voting sessions
router.get('/sessions', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT vs.*, u.name as created_by_name,
              COUNT(DISTINCT v.id)::int as total_votes
       FROM voting_sessions vs
       LEFT JOIN users u ON u.id = vs.created_by
       LEFT JOIN votes v ON v.session_id = vs.id
       GROUP BY vs.id, u.name
       ORDER BY vs.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get voting sessions error:', err);
    res.status(500).json({ error: 'Error fetching voting sessions' });
  }
});

// GET single voting session with full results
router.get('/sessions/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const sessionResult = await pool.query(
      `SELECT vs.*, u.name as created_by_name
       FROM voting_sessions vs
       LEFT JOIN users u ON u.id = vs.created_by
       WHERE vs.id = $1`,
      [id]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Voting session not found' });
    }

    const session = sessionResult.rows[0];

    // Aggregate results
    const resultsQuery = await pool.query(
      `SELECT vote_option,
              COUNT(*)::int as count,
              ROUND(COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM votes WHERE session_id = $1), 0), 2) as percentage
       FROM votes
       WHERE session_id = $1
       GROUP BY vote_option
       ORDER BY vote_option`,
      [id]
    );

    // Participants list
    const participantsQuery = await pool.query(
      `SELECT u.id, u.name, u.email, v.vote_option, v.voted_at
       FROM votes v
       JOIN users u ON u.id = v.user_id
       WHERE v.session_id = $1
       ORDER BY v.voted_at DESC`,
      [id]
    );

    // Check if current user already voted
    const userVoteQuery = await pool.query(
      `SELECT vote_option FROM votes WHERE session_id = $1 AND user_id = $2`,
      [id, req.user.id]
    );

    res.json({
      session,
      results: resultsQuery.rows,
      participants: participantsQuery.rows,
      totalVotes: participantsQuery.rows.length,
      userVote: userVoteQuery.rows[0]?.vote_option || null
    });
  } catch (err) {
    console.error('Get voting session error:', err);
    res.status(500).json({ error: 'Error fetching voting session' });
  }
});

// ============================================
// VOTING ENDPOINTS
// ============================================

// CAST a vote
router.post('/cast', authenticateToken, authorizeRoles('Admin', 'Secretary', 'Councilor'), async (req, res) => {
  const { session_id, vote_option } = req.body;
  try {
    if (!session_id || !vote_option) {
      return res.status(400).json({ error: 'session_id and vote_option are required' });
    }

    // Validate session exists and is active
    const sessionResult = await pool.query(
      `SELECT * FROM voting_sessions WHERE id = $1`,
      [session_id]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Voting session not found' });
    }

    const session = sessionResult.rows[0];

    if (session.status !== 'active') {
      return res.status(400).json({ error: 'This voting session is no longer active' });
    }

    // Validate vote option
    const allowedOptions = session.voting_type === 'yes_no_abstain'
      ? ['Yes', 'No', 'Abstain']
      : ['Yes', 'No'];

    if (!allowedOptions.includes(vote_option)) {
      return res.status(400).json({ error: `Invalid vote option. Allowed: ${allowedOptions.join(', ')}` });
    }

    // Check if user already voted
    const existing = await pool.query(
      `SELECT id FROM votes WHERE session_id = $1 AND user_id = $2`,
      [session_id, req.user.id]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'You have already voted in this session' });
    }

    const result = await pool.query(
      `INSERT INTO votes (session_id, user_id, vote_option, voted_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [session_id, req.user.id, vote_option]
    );

    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details, timestamp)
       VALUES ($1, $2, $3, NOW())`,
      [req.user.id, 'VOTE_CAST', `Vote "${vote_option}" cast in session "${session.title}"`]
    );

    // Get updated results and broadcast
    const updatedResults = await pool.query(
      `SELECT vote_option,
              COUNT(*)::int as count,
              ROUND(COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM votes WHERE session_id = $1), 0), 2) as percentage
       FROM votes
       WHERE session_id = $1
       GROUP BY vote_option
       ORDER BY vote_option`,
      [session_id]
    );

    const totalVotes = await pool.query(
      `SELECT COUNT(*)::int as total FROM votes WHERE session_id = $1`,
      [session_id]
    );

    const io = getIO();
    io.emit('voteCast', {
      session_id,
      results: updatedResults.rows,
      totalVotes: totalVotes.rows[0].total
    });

    res.json({ success: true, vote: result.rows[0] });
  } catch (err) {
    console.error('Cast vote error:', err);
    res.status(500).json({ error: 'Error casting vote' });
  }
});

// ============================================
// SESSION MANAGEMENT ENDPOINTS
// ============================================

// CLOSE a voting session (Admin, Secretary)
router.put('/sessions/:id/close', authenticateToken, authorizeRoles('Admin', 'Secretary', 'Councilor'), async (req, res) => {
  try {
    const { id } = req.params;

    const sessionResult = await pool.query(
      `SELECT * FROM voting_sessions WHERE id = $1`,
      [id]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Voting session not found' });
    }

    if (sessionResult.rows[0].status === 'closed') {
      return res.status(400).json({ error: 'Voting session is already closed' });
    }

    const result = await pool.query(
      `UPDATE voting_sessions SET status = 'closed', closed_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    const session = result.rows[0];

    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details, timestamp)
       VALUES ($1, $2, $3, NOW())`,
      [req.user.id, 'VOTING_SESSION_CLOSE', `Voting session "${session.title}" closed`]
    );

    const io = getIO();
    io.emit('votingSessionClosed', session);

    res.json(session);
  } catch (err) {
    console.error('Close voting session error:', err);
    res.status(500).json({ error: 'Error closing voting session' });
  }
});

// DELETE a voting session (Admin only)
router.delete('/sessions/:id', authenticateToken, authorizeRoles('Admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const sessionResult = await pool.query(
      `SELECT * FROM voting_sessions WHERE id = $1`,
      [id]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Voting session not found' });
    }

    await pool.query(`DELETE FROM voting_sessions WHERE id = $1`, [id]);

    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details, timestamp)
       VALUES ($1, $2, $3, NOW())`,
      [req.user.id, 'VOTING_SESSION_DELETE', `Voting session "${sessionResult.rows[0].title}" deleted`]
    );

    const io = getIO();
    io.emit('votingSessionDeleted', { id: parseInt(id) });

    res.json({ message: 'Voting session deleted successfully' });
  } catch (err) {
    console.error('Delete voting session error:', err);
    res.status(500).json({ error: 'Error deleting voting session' });
  }
});

// GET voting analytics (Admin, Secretary)
router.get('/analytics', authenticateToken, authorizeRoles('Admin', 'Secretary'), async (req, res) => {
  try {
    const totals = await pool.query(
      `SELECT
         COUNT(*)::int as total_sessions,
         COUNT(*) FILTER (WHERE status = 'active')::int as active_sessions,
         COUNT(*) FILTER (WHERE status = 'closed')::int as closed_sessions
       FROM voting_sessions`
    );

    const totalVotes = await pool.query(
      `SELECT COUNT(*)::int as total_votes FROM votes`
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

    res.json({
      ...totals.rows[0],
      total_votes: totalVotes.rows[0].total_votes,
      recent_sessions: recentSessions.rows
    });
  } catch (err) {
    console.error('Get analytics error:', err);
    res.status(500).json({ error: 'Error fetching analytics' });
  }
});

module.exports = router;
