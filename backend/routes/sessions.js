const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const authorizeRoles = require('../middleware/roles');
const { createNotification } = require('../utils/notifications');
const { getIO } = require('../socket');

// CREATE session (only Secretary can create)
router.post('/', authenticateToken, authorizeRoles('Secretary'), async (req, res) => {
  const { title, date, agenda } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO sessions (title, date, agenda, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [title, date, agenda, req.user.id]
    );

    const session = result.rows[0];

    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details, timestamp)
       VALUES ($1, $2, $3, NOW())`,
      [req.user.id, 'SESSION_CREATE', `Session "${title}" created`]
    );

    // Notify Secretary (confirmation)
    await createNotification(req.user.id, `Session "${title}" has been created.`);
    const io = getIO();
    io.to('Secretary').emit('sessionCreated', session);

    // Notify Councilors, Captains, and DILG
    io.to('Councilor').emit('newSession', session);
    io.to('Captain').emit('newSession', session);
    io.to('DILG').emit('newSession', session);

    res.json(session);
  } catch (err) {
    console.error('Session create error:', err);
    res.status(500).json({ error: 'Error creating session' });
  }
});

// READ all sessions (any authenticated user)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM sessions ORDER BY date DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching sessions');
  }
});

// READ single session
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM sessions WHERE id=$1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Session not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching session');
  }
});

// UPDATE session (only Secretary can update)
router.put('/:id', authenticateToken, authorizeRoles('Secretary'), async (req, res) => {
  const { title, date, agenda } = req.body;
  try {
    const result = await pool.query(
      `UPDATE sessions SET title=$1, date=$2, agenda=$3 WHERE id=$4 RETURNING *`,
      [title, date, agenda, req.params.id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Session not found' });

    const session = result.rows[0];
    const io = getIO();
    // Notify Secretary (confirmation)
    await createNotification(req.user.id, `Session "${title}" has been updated.`);
    io.to('Secretary').emit('sessionUpdated', session);
    // Notify Councilors, Captains, and DILG about update
    io.to('Councilor').emit('sessionUpdated', session);
    io.to('Captain').emit('sessionUpdated', session);
    io.to('DILG').emit('sessionUpdated', session);

    res.json(session);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error updating session');
  }
});

// DELETE session (only Secretary can delete)
router.delete('/:id', authenticateToken, authorizeRoles('Secretary'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM sessions WHERE id=$1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Session not found' });

    const session = result.rows[0];
    const io = getIO();
    // Notify Secretary (confirmation)
    await createNotification(req.user.id, `Session "${session.title}" has been deleted.`);
    io.to('Secretary').emit('sessionDeleted', session);
    // Notify Councilors, Captains, and DILG about deletion
    io.to('Councilor').emit('sessionDeleted', session);
    io.to('Captain').emit('sessionDeleted', session);
    io.to('DILG').emit('sessionDeleted', session);

    res.json({ message: 'Session deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error deleting session');
  }
});

module.exports = router;
