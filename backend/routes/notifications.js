const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const { getIO } = require('../socket');

// CREATE notification
router.post('/', authenticateToken, async (req, res) => {
  const { user_id, type, title, message, related_id, related_type } = req.body;

  // Only admin or the user creating the notification for themselves
  if (user_id !== req.user.id && req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  if (!user_id || !type || !title || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, related_id, related_type, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [user_id, type, title, message, related_id || null, related_type || null]
    );

    const notification = result.rows[0];

    // Real-time notification
    const io = getIO();
    io.to(`user_${user_id}`).emit('notificationCreated', notification);

    res.status(201).json(notification);
  } catch (err) {
    console.error('Create notification error:', err);
    res.status(500).json({ error: 'Error creating notification' });
  }
});

// GET notifications for current user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { type, unread } = req.query;
    let query = `
      SELECT * FROM notifications
      WHERE user_id = $1 AND deleted_at IS NULL
    `;
    const params = [req.user.id];

    if (type) {
      query += ` AND type = $${params.length + 1}`;
      params.push(type);
    }

    if (unread === 'true') {
      query += ` AND is_read = FALSE`;
    }

    query += ` ORDER BY created_at DESC LIMIT 100`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ error: 'Error fetching notifications' });
  }
});

// GET notification by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM notifications
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const notification = result.rows[0];

    // Mark as read
    if (!notification.is_read) {
      await pool.query(
        'UPDATE notifications SET is_read = TRUE, updated_at = NOW() WHERE id = $1',
        [req.params.id]
      );
      notification.is_read = true;
    }

    res.json(notification);
  } catch (err) {
    console.error('Get notification error:', err);
    res.status(500).json({ error: 'Error fetching notification' });
  }
});

// MARK as read/unread
router.patch('/:id/read', authenticateToken, async (req, res) => {
  const { is_read } = req.body;

  try {
    const result = await pool.query(
      `UPDATE notifications
       SET is_read = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [is_read, req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ error: 'Error updating notification' });
  }
});

// MARK all as read
router.patch('/mark-all/read', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications
       SET is_read = TRUE, updated_at = NOW()
       WHERE user_id = $1 AND is_read = FALSE`,
      [req.user.id]
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('Mark all read error:', err);
    res.status(500).json({ error: 'Error updating notifications' });
  }
});

// DELETE notification (soft delete)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE notifications
       SET deleted_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted' });
  } catch (err) {
    console.error('Delete notification error:', err);
    res.status(500).json({ error: 'Error deleting notification' });
  }
});

// GET unread count
router.get('/count/unread', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM notifications
       WHERE user_id = $1 AND is_read = FALSE AND deleted_at IS NULL`,
      [req.user.id]
    );

    res.json({ unread: parseInt(result.rows[0].count) });
  } catch (err) {
    console.error('Unread count error:', err);
    res.status(500).json({ error: 'Error fetching count' });
  }
});

module.exports = router;