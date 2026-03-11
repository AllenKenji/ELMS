const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const authorizeRoles = require('../middleware/roles');
const { createNotification } = require('../utils/notifications');
const { getIO } = require('../socket');

// CREATE resolution
router.post('/', authenticateToken, authorizeRoles('Secretary', 'Admin'), async (req, res) => {
  const { title, resolution_number, description, content, remarks } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO resolutions (title, resolution_number, description, content, remarks, proposer_id, proposer_name, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'Draft', NOW()) RETURNING *`,
      [title, resolution_number, description, content, remarks || null, req.user.id, req.user.name]
    );

    const resolution = result.rows[0];

    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details, timestamp)
       VALUES ($1, $2, $3, NOW())`,
      [req.user.id, 'RESOLUTION_CREATE', `Resolution "${title}" created`]
    );

    // Real-time notification
    const io = getIO();
    io.emit('resolutionCreated', resolution);

    res.json(resolution);
  } catch (err) {
    console.error('Resolution create error:', err);
    res.status(500).json({ error: 'Error creating resolution' });
  }
});

// READ all resolutions
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, proposer } = req.query;
    let query = `
      SELECT 
        r.*,
        u.name as proposer_name
       FROM resolutions r
       LEFT JOIN users u ON u.id = r.proposer_id
       WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ` AND r.status = $${params.length + 1}`;
      params.push(status);
    }

    if (proposer) {
      query += ` AND r.proposer_id = $${params.length + 1}`;
      params.push(proposer);
    }

    query += ` ORDER BY r.created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get resolutions error:', err);
    res.status(500).json({ error: 'Error fetching resolutions' });
  }
});

// READ single resolution
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        r.*,
        u.name as proposer_name
       FROM resolutions r
       LEFT JOIN users u ON u.id = r.proposer_id
       WHERE r.id=$1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Resolution not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get resolution error:', err);
    res.status(500).json({ error: 'Error fetching resolution' });
  }
});

// UPDATE resolution
router.put('/:id', authenticateToken, authorizeRoles('Secretary', 'Admin'), async (req, res) => {
  const { title, resolution_number, description, content, remarks, status } = req.body;
  try {
    const result = await pool.query(
      `UPDATE resolutions 
       SET title=$1, resolution_number=$2, description=$3, content=$4, remarks=$5, status=$6, updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [title, resolution_number, description, content, remarks || null, status || 'Draft', req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Resolution not found' });
    }

    const resolution = result.rows[0];

    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details, timestamp)
       VALUES ($1, $2, $3, NOW())`,
      [req.user.id, 'RESOLUTION_UPDATE', `Resolution "${title}" updated`]
    );

    // Real-time notification
    const io = getIO();
    io.emit('resolutionUpdated', resolution);

    res.json(resolution);
  } catch (err) {
    console.error('Update resolution error:', err);
    res.status(500).json({ error: 'Error updating resolution' });
  }
});

// DELETE resolution
router.delete('/:id', authenticateToken, authorizeRoles('Admin'), async (req, res) => {
  try {
    const resolution = await pool.query('SELECT * FROM resolutions WHERE id=$1', [req.params.id]);
    
    if (resolution.rows.length === 0) {
      return res.status(404).json({ error: 'Resolution not found' });
    }

    await pool.query('DELETE FROM resolutions WHERE id=$1', [req.params.id]);

    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details, timestamp)
       VALUES ($1, $2, $3, NOW())`,
      [req.user.id, 'RESOLUTION_DELETE', `Resolution "${resolution.rows[0].title}" deleted`]
    );

    res.json({ message: 'Resolution deleted successfully' });
  } catch (err) {
    console.error('Delete resolution error:', err);
    res.status(500).json({ error: 'Error deleting resolution' });
  }
});

// CHANGE STATUS
router.patch('/:id/status', authenticateToken, authorizeRoles('Secretary', 'Admin'), async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['Draft', 'Submitted', 'Under Review', 'Approved', 'Published', 'Rejected'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const result = await pool.query(
      `UPDATE resolutions SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [status, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Resolution not found' });
    }

    const resolution = result.rows[0];

    // Real-time notification
    const io = getIO();
    io.emit('resolutionStatusChanged', resolution);

    res.json(resolution);
  } catch (err) {
    console.error('Status change error:', err);
    res.status(500).json({ error: 'Error updating status' });
  }
});

module.exports = router;