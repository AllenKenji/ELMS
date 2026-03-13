/**
 * Notification Model - Data access layer for notification operations.
 */
const pool = require('../db');

/** @returns {Promise<import('pg').QueryResult>} */
exports.create = async (userId, type, title, message, relatedId, relatedType) => {
  return pool.query(
    `INSERT INTO notifications (user_id, type, title, message, related_id, related_type, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     RETURNING *`,
    [userId, type, title, message, relatedId || null, relatedType || null]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.findByUser = async (userId, type, unread) => {
  let query = `
    SELECT * FROM notifications
    WHERE user_id = $1 AND deleted_at IS NULL
  `;
  const params = [userId];

  if (type) {
    query += ` AND type = $${params.length + 1}`;
    params.push(type);
  }
  if (unread === 'true') {
    query += ' AND is_read = FALSE';
  }
  query += ' ORDER BY created_at DESC LIMIT 100';
  return pool.query(query, params);
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.findById = async (id, userId) => {
  return pool.query(
    'SELECT * FROM notifications WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.markRead = async (id) => {
  return pool.query(
    'UPDATE notifications SET is_read = TRUE, updated_at = NOW() WHERE id = $1',
    [id]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.updateReadStatus = async (id, userId, isRead) => {
  return pool.query(
    `UPDATE notifications
     SET is_read = $1, updated_at = NOW()
     WHERE id = $2 AND user_id = $3
     RETURNING *`,
    [isRead, id, userId]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.markAllRead = async (userId) => {
  return pool.query(
    `UPDATE notifications
     SET is_read = TRUE, updated_at = NOW()
     WHERE user_id = $1 AND is_read = FALSE`,
    [userId]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.softDelete = async (id, userId) => {
  return pool.query(
    'UPDATE notifications SET deleted_at = NOW() WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.getUnreadCount = async (userId) => {
  return pool.query(
    `SELECT COUNT(*) as count FROM notifications
     WHERE user_id = $1 AND is_read = FALSE AND deleted_at IS NULL`,
    [userId]
  );
};
