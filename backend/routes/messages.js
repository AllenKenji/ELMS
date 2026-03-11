const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const { getIO } = require('../socket');

// SEND message
router.post('/', authenticateToken, async (req, res) => {
  const { receiver_id, subject, body } = req.body;

  // Validate
  if (!receiver_id || !subject?.trim() || !body?.trim()) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (subject.trim().length < 3) {
    return res.status(400).json({ error: 'Subject must be at least 3 characters' });
  }

  if (body.trim().length < 5) {
    return res.status(400).json({ error: 'Message body must be at least 5 characters' });
  }

  if (receiver_id === req.user.id) {
    return res.status(400).json({ error: 'Cannot message yourself' });
  }

  try {
    // Check if receiver exists
    const receiverCheck = await pool.query(
      'SELECT id FROM users WHERE id = $1',
      [receiver_id]
    );

    if (receiverCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    // Insert message
    const result = await pool.query(
      `INSERT INTO messages (sender_id, receiver_id, subject, body, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [req.user.id, receiver_id, subject.trim(), body.trim()]
    );

    const message = result.rows[0];

    // Real-time notification
    const io = getIO();
    io.to(`user_${receiver_id}`).emit('newMessage', {
      id: message.id,
      sender_id: message.sender_id,
      sender_name: req.user.name,
      subject: message.subject,
      created_at: message.created_at,
    });

    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details, timestamp)
       VALUES ($1, $2, $3, NOW())`,
      [req.user.id, 'MESSAGE_SEND', `Message sent to user ${receiver_id}`]
    );

    res.status(201).json(message);
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Error sending message' });
  }
});

// GET inbox (received messages)
router.get('/inbox', authenticateToken, async (req, res) => {
  try {
    const { search, unread } = req.query;

    let query = `
      SELECT 
        m.*,
        u.name as sender_name
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.receiver_id = $1 AND m.deleted_by_receiver = FALSE
    `;
    const params = [req.user.id];

    if (unread === 'true') {
      query += ` AND m.is_read = FALSE`;
    }

    if (search) {
      query += ` AND (m.subject ILIKE $${params.length + 1} OR m.body ILIKE $${params.length + 1})`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY m.created_at DESC LIMIT 50`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get inbox error:', err);
    res.status(500).json({ error: 'Error fetching inbox' });
  }
});

// GET sent messages
router.get('/sent', authenticateToken, async (req, res) => {
  try {
    const { search } = req.query;

    let query = `
      SELECT 
        m.*,
        u.name as receiver_name
      FROM messages m
      JOIN users u ON u.id = m.receiver_id
      WHERE m.sender_id = $1 AND m.deleted_by_sender = FALSE
    `;
    const params = [req.user.id];

    if (search) {
      query += ` AND (m.subject ILIKE $${params.length + 1} OR m.body ILIKE $${params.length + 1})`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY m.created_at DESC LIMIT 50`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get sent error:', err);
    res.status(500).json({ error: 'Error fetching sent messages' });
  }
});

// GET single message
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        m.*,
        sender.name as sender_name,
        receiver.name as receiver_name
       FROM messages m
       JOIN users sender ON sender.id = m.sender_id
       JOIN users receiver ON receiver.id = m.receiver_id
       WHERE m.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const message = result.rows[0];

    // Check authorization
    if (message.sender_id !== req.user.id && message.receiver_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Mark as read
    if (message.receiver_id === req.user.id && !message.is_read) {
      await pool.query(
        'UPDATE messages SET is_read = TRUE, updated_at = NOW() WHERE id = $1',
        [req.params.id]
      );
      message.is_read = true;
    }

    res.json(message);
  } catch (err) {
    console.error('Get message error:', err);
    res.status(500).json({ error: 'Error fetching message' });
  }
});

// MARK as read/unread
router.patch('/:id/read', authenticateToken, async (req, res) => {
  const { is_read } = req.body;

  try {
    const result = await pool.query(
      `UPDATE messages 
       SET is_read = $1, updated_at = NOW()
       WHERE id = $2 AND receiver_id = $3
       RETURNING *`,
      [is_read, req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ error: 'Error updating message' });
  }
});

// DELETE message (soft delete)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const message = await pool.query(
      'SELECT * FROM messages WHERE id = $1',
      [req.params.id]
    );

    if (message.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const msg = message.rows[0];

    // Determine who's deleting
    if (msg.sender_id === req.user.id) {
      await pool.query(
        'UPDATE messages SET deleted_by_sender = TRUE WHERE id = $1',
        [req.params.id]
      );
    } else if (msg.receiver_id === req.user.id) {
      await pool.query(
        'UPDATE messages SET deleted_by_receiver = TRUE WHERE id = $1',
        [req.params.id]
      );
    } else {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // If both deleted, hard delete
    await pool.query(
      `DELETE FROM messages 
       WHERE id = $1 AND deleted_by_sender = TRUE AND deleted_by_receiver = TRUE`,
      [req.params.id]
    );

    res.json({ message: 'Message deleted' });
  } catch (err) {
    console.error('Delete message error:', err);
    res.status(500).json({ error: 'Error deleting message' });
  }
});

// GET unread count
router.get('/count/unread', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM messages 
       WHERE receiver_id = $1 AND is_read = FALSE AND deleted_by_receiver = FALSE`,
      [req.user.id]
    );

    res.json({ unread: parseInt(result.rows[0].count) });
  } catch (err) {
    console.error('Unread count error:', err);
    res.status(500).json({ error: 'Error fetching count' });
  }
});

module.exports = router;