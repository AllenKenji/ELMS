const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const authorizeRoles = require('../middleware/roles');
const { createNotification } = require('../utils/notifications');
const { getIO } = require('../socket');

// ============================================
// BASIC CRUD OPERATIONS
// ============================================

// CREATE session (only Secretary and Admin can create)
router.post('/', authenticateToken, authorizeRoles('Secretary', 'Admin'), async (req, res) => {
  const { title, date, location, agenda, notes } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO sessions (title, date, location, agenda, notes, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`,
      [title, date, location, agenda, notes || null, req.user.id]
    );

    const session = result.rows[0];

    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details, timestamp)
       VALUES ($1, $2, $3, NOW())`,
      [req.user.id, 'SESSION_CREATE', `Session "${title}" created`]
    );

    // Notify Secretary/Admin (confirmation)
    await createNotification(req.user.id, `Session "${title}" has been created.`);
    const io = getIO();
    io.to('Secretary').emit('sessionCreated', session);
    io.to('Admin').emit('sessionCreated', session);

    // Notify all other users
    io.to('Councilor').emit('newSession', session);
    io.to('Captain').emit('newSession', session);
    io.to('DILG').emit('newSession', session);
    io.to('Resident').emit('newSession', session);

    res.json(session);
  } catch (err) {
    console.error('Session create error:', err);
    res.status(500).json({ error: 'Error creating session' });
  }
});

// READ all sessions (any authenticated user)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        s.*,
        u.name as created_by_name
       FROM sessions s
       LEFT JOIN users u ON u.id = s.created_by
       ORDER BY s.date DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get sessions error:', err);
    res.status(500).json({ error: 'Error fetching sessions' });
  }
});

// READ single session
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        s.*,
        u.name as created_by_name
       FROM sessions s
       LEFT JOIN users u ON u.id = s.created_by
       WHERE s.id=$1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get session error:', err);
    res.status(500).json({ error: 'Error fetching session' });
  }
});

// UPDATE session (only Secretary and Admin can update)
router.put('/:id', authenticateToken, authorizeRoles('Secretary', 'Admin'), async (req, res) => {
  const { title, date, location, agenda, notes } = req.body;
  try {
    const result = await pool.query(
      `UPDATE sessions 
       SET title=$1, date=$2, location=$3, agenda=$4, notes=$5, updated_at=NOW()
       WHERE id=$6 RETURNING *`,
      [title, date, location, agenda, notes || null, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = result.rows[0];

    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details, timestamp)
       VALUES ($1, $2, $3, NOW())`,
      [req.user.id, 'SESSION_UPDATE', `Session "${title}" updated`]
    );

    // Notify users
    await createNotification(req.user.id, `Session "${title}" has been updated.`);
    const io = getIO();
    io.to('Secretary').emit('sessionUpdated', session);
    io.to('Admin').emit('sessionUpdated', session);
    io.to('Councilor').emit('sessionUpdated', session);
    io.to('Captain').emit('sessionUpdated', session);
    io.to('DILG').emit('sessionUpdated', session);

    res.json(session);
  } catch (err) {
    console.error('Update session error:', err);
    res.status(500).json({ error: 'Error updating session' });
  }
});

// DELETE session (only Admin can delete)
router.delete('/:id', authenticateToken, authorizeRoles('Admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const session = await client.query('SELECT * FROM sessions WHERE id=$1', [req.params.id]);
    if (session.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Session not found' });
    }

    // Delete related records
    await client.query('DELETE FROM session_participants WHERE session_id=$1', [req.params.id]);
    await client.query('DELETE FROM sessions WHERE id=$1', [req.params.id]);

    // Audit log
    await client.query(
      `INSERT INTO audit_logs (user_id, action, details, timestamp)
       VALUES ($1, $2, $3, NOW())`,
      [req.user.id, 'SESSION_DELETE', `Session "${session.rows[0].title}" deleted`]
    );

    await client.query('COMMIT');
    res.json({ message: 'Session deleted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Delete session error:', err);
    res.status(500).json({ error: 'Error deleting session' });
  } finally {
    client.release();
  }
});

// ============================================
// SESSION-SPECIFIC ENDPOINTS
// ============================================

// GET ordinances in a session
router.get('/:id/ordinances', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        o.*,
        u.name as proposer_name
       FROM ordinances o
       LEFT JOIN users u ON u.id = o.proposer_id
       WHERE o.session_id=$1
       ORDER BY o.created_at DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get session ordinances error:', err);
    res.status(500).json({ error: 'Error fetching ordinances' });
  }
});

// GET participants in a session
router.get('/:id/participants', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        u.id,
        u.name,
        u.email,
        r.role_name as role,
        sp.attendance_status
       FROM session_participants sp
       LEFT JOIN users u ON u.id = sp.user_id
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE sp.session_id=$1
       ORDER BY u.name ASC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get participants error:', err);
    res.status(500).json({ error: 'Error fetching participants' });
  }
});

// ADD participant to session
router.post('/:id/participants', authenticateToken, authorizeRoles('Secretary', 'Admin'), async (req, res) => {
  const { user_id } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO session_participants (session_id, user_id, attendance_status, added_at)
       VALUES ($1, $2, 'Pending', NOW())
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [req.params.id, user_id]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Participant already added' });
    }

    // Notify participant
    const session = await pool.query('SELECT title FROM sessions WHERE id=$1', [req.params.id]);
    await createNotification(
      user_id,
      `You have been added to session: "${session.rows[0]?.title}"`
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Add participant error:', err);
    res.status(500).json({ error: 'Error adding participant' });
  }
});

// UPDATE participant attendance
router.put('/:id/participants/:userId', authenticateToken, async (req, res) => {
  const { attendance_status } = req.body;
  try {
    const result = await pool.query(
      `UPDATE session_participants 
       SET attendance_status=$1
       WHERE session_id=$2 AND user_id=$3
       RETURNING *`,
      [attendance_status, req.params.id, req.params.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Participant not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update participant error:', err);
    res.status(500).json({ error: 'Error updating participant' });
  }
});

module.exports = router;