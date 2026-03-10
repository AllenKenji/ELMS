const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const { getIO } = require('../socket');

// CREATE notification (any role can trigger)
router.post('/', authenticateToken, async (req, res) => {
  const { message, userId } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO notifications (message, user_id, created_at)
       VALUES ($1, $2, NOW()) RETURNING *`,
      [message, userId]
    );

    const notification = result.rows[0];

    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details, timestamp)
       VALUES ($1, $2, $3, NOW())`,
      [userId, 'NOTIFICATION_CREATE', `Notification created: ${message}`]
    );

    // Broadcast
    const io = getIO();
    io.to(`user_${userId}`).emit('notificationCreated', notification);

    res.json(notification);
  } catch (err) {
    console.error('Notification create error:', err);
    res.status(500).json({ error: 'Error creating notification' });
  }
});


// READ all notifications for current user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching notifications');
  }
});

// DELETE notification
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM notifications WHERE id=$1 AND user_id=$2 RETURNING *`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Notification not found' });

    const deleted = result.rows[0];

    // Broadcast deletion event
    const io = getIO();
    io.to(`user_${req.user.id}`).emit('notificationDeleted', deleted);

    res.json({ message: 'Notification deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error deleting notification');
  }
});

module.exports = router;
