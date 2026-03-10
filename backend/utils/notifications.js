const pool = require('../db');
const { getIO } = require('../socket');

async function createNotification(userId, message) {
  try {
    const result = await pool.query(
      `INSERT INTO notifications (user_id, message, created_at)
       VALUES ($1, $2, NOW()) RETURNING *`,
      [userId, message]
    );

    const notification = result.rows[0];

    // Broadcast to the specific user room
    const io = getIO();
    io.to(`user_${userId}`).emit('notificationCreated', notification);

    return notification;
  } catch (err) {
    console.error('Error creating notification:', err);
  }
}

async function deleteNotification(userId, notificationId) {
  try {
    const result = await pool.query(
      `DELETE FROM notifications WHERE id=$1 AND user_id=$2 RETURNING *`,
      [notificationId, userId]
    );

    if (result.rows.length > 0) {
      const deleted = result.rows[0];
      const io = getIO();
      io.to(`user_${userId}`).emit('notificationDeleted', deleted); 
      return deleted;
    }
    return null;
  } catch (err) {
    console.error('Error deleting notification:', err);
  }
}

module.exports = { createNotification, deleteNotification };
