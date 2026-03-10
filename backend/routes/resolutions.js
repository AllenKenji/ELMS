const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const authorizeRoles = require('../middleware/roles');
const { createNotification } = require('../utils/notifications');
const { getIO } = require('../socket');

// CREATE resolution (only Councilors can submit)
router.post('/', authenticateToken, authorizeRoles('Councilor'), async (req, res) => {
  const { title, description, sessionId } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO resolutions (title, description, submitted_by, session_id, created_at)
       VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
      [title, description, req.user.id, sessionId]
    );

    const resolution = result.rows[0];

    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details, timestamp)
       VALUES ($1, $2, $3, NOW())`,
      [req.user.id, 'RESOLUTION_SUBMIT', `Resolution "${title}" submitted`]
    );

    // Notify Councilor (confirmation)
    await createNotification(req.user.id, `Your resolution "${title}" has been submitted.`);
    const io = getIO();
    io.to('Councilor').emit('resolutionSubmitted', resolution);

    // Notify all Secretaries
    const secretaries = await pool.query(`SELECT id FROM users WHERE role_id=1`);
    for (const sec of secretaries.rows) {
      await createNotification(sec.id, `New resolution submitted: "${title}"`);
    }
    io.to('Secretary').emit('newResolution', resolution);

    // Also notify Captains + DILG for oversight
    io.to('Captain').emit('newResolution', resolution);
    io.to('DILG').emit('newResolution', resolution);

    res.json(resolution);
  } catch (err) {
    console.error('Resolution create error:', err);
    res.status(500).json({ error: 'Error creating resolution' });
  }
});


// READ all resolutions
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM resolutions ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching resolutions');
  }
});

// READ single resolution
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM resolutions WHERE id=$1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Resolution not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching resolution');
  }
});

// UPDATE resolution (Secretary can link to session, Councilor can edit title/description)
router.put('/:id', authenticateToken, authorizeRoles('Secretary', 'Councilor'), async (req, res) => {
  const { title, description, status, session_id } = req.body;
  try {
    const result = await pool.query(
      `UPDATE resolutions
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           status = COALESCE($3, status),
           session_id = COALESCE($4, session_id)
       WHERE id=$5 RETURNING *`,
      [title, description, status, session_id, req.params.id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Resolution not found' });

    const resolution = result.rows[0];

    // Notify Councilor if Secretary linked resolution to a session
    if (session_id) {
      await createNotification(
        resolution.submitted_by,
        `Your resolution "${resolution.title}" was added to session ${session_id}.`
      );
      const io = getIO();
      io.to('Councilor').emit('resolutionLinked', resolution);
    }

    res.json(resolution);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error updating resolution');
  }
});

// UPDATE resolution status (only Captain or DILG can approve/reject)
router.put('/:id/status', authenticateToken, authorizeRoles('Captain', 'DILG Official'), async (req, res) => {
  const { status } = req.body;
  try {
    const result = await pool.query(
      `UPDATE resolutions SET status=$1 WHERE id=$2 RETURNING *`,
      [status, req.params.id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Resolution not found' });

    const resolution = result.rows[0];

    // Notify Councilor who submitted
    await createNotification(
      resolution.submitted_by,
      `Your resolution "${resolution.title}" was ${status}.`
    );

    // Broadcast to Councilors + Secretaries
    const io = getIO();
    io.to('Councilor').emit('resolutionStatusChanged', resolution);
    io.to('Secretary').emit('resolutionStatusChanged', resolution);

    res.json(resolution);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error updating resolution status');
  }
});

// DELETE resolution (only Secretary can delete)
router.delete('/:id', authenticateToken, authorizeRoles('Secretary'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM resolutions WHERE id=$1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Resolution not found' });

    const resolution = result.rows[0];

    // Notify Councilor who submitted
    await createNotification(
      resolution.submitted_by,
      `Your resolution "${resolution.title}" was deleted by the Secretary.`
    );
    const io = getIO();
    io.to('Councilor').emit('resolutionDeleted', resolution);
    res.json({ message: 'Resolution deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error deleting resolution');
  }
});

module.exports = router;
