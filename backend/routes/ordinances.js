const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const authorizeRoles = require('../middleware/roles');
const { createNotification } = require('../utils/notifications');
const { getIO } = require('../socket');


// CREATE ordinance (only Councilors can submit)
router.post('/', authenticateToken, authorizeRoles('Councilor'), async (req, res) => {
  const { title, description, sessionId } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO ordinances (title, description, submitted_by, session_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [title, description, req.user.id, sessionId]
    );

    const ordinance = result.rows[0];

    // Notify Councilor (confirmation)
    await createNotification(req.user.id, `Your ordinance "${title}" has been submitted.`);
    const io = getIO();
    io.to('Councilor').emit('ordinanceSubmitted', ordinance);

    // Notify all Secretaries
    const secretaries = await pool.query(`SELECT id FROM users WHERE role_id=1`);
    for (const sec of secretaries.rows) {
      await createNotification(sec.id, `New ordinance submitted: "${title}"`);
    }
    io.to('Secretary').emit('newOrdinance', ordinance);
    // Also notify Captains + DILG for oversight
    io.to('Captain').emit('newOrdinance', ordinance);
    io.to('DILG').emit('newOrdinance', ordinance);

    res.json(ordinance);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error creating ordinance');
  }
});


// READ all ordinances
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ordinances ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching ordinances');
  }
});

// READ single ordinance
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ordinances WHERE id=$1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Ordinance not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching ordinance');
  }
});

// UPDATE ordinance (Secretary can link to session, Councilor can edit title/description)
router.put('/:id', authenticateToken, authorizeRoles('Secretary', 'Councilor'), async (req, res) => {
  const { title, description, status, session_id } = req.body;
  try {
    const result = await pool.query(
      `UPDATE ordinances
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           status = COALESCE($3, status),
           session_id = COALESCE($4, session_id)
       WHERE id=$5 RETURNING *`,
      [title, description, status, session_id, req.params.id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Ordinance not found' });

    const ordinance = result.rows[0];

    // Notify Councilor if Secretary linked ordinance to a session
    if (session_id) {
      await createNotification(
        ordinance.submitted_by,
        `Your ordinance "${ordinance.title}" was added to session ${session_id}.`
      );
    }

    res.json(ordinance);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error updating ordinance');
  }
});

// UPDATE ordinance status (only Captain or DILG can approve/reject)
router.put('/:id/status', authenticateToken, authorizeRoles('Captain', 'DILG Official'), async (req, res) => {
  const { status } = req.body;
  try {
    const result = await pool.query(
      `UPDATE ordinances SET status=$1 WHERE id=$2 RETURNING *`,
      [status, req.params.id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Ordinance not found' });

    const ordinance = result.rows[0];

    // Notify Councilor who submitted
    await createNotification(
      ordinance.submitted_by,
      `Your ordinance "${ordinance.title}" was ${status}.`
    );

    // Broadcast
    const io = getIO(); // <-- FIX
    io.to('Councilor').emit('ordinanceStatusChanged', ordinance);
    io.to('Secretary').emit('ordinanceStatusChanged', ordinance);

    res.json(ordinance);
  } catch (err) {
    console.error('Ordinance status update error:', err);
    res.status(500).json({ error: 'Error updating ordinance status' });
  }
});

// DELETE ordinance (only Secretary can delete)
router.delete('/:id', authenticateToken, authorizeRoles('Secretary'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM ordinances WHERE id=$1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Ordinance not found' });

    const ordinance = result.rows[0];

    // Notify Councilor who submitted
    await createNotification(
      ordinance.submitted_by,
      `Your ordinance "${ordinance.title}" was deleted by the Secretary.`
    );

    res.json({ message: 'Ordinance deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error deleting ordinance');
  }
});

module.exports = router;
