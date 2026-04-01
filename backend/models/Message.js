/**
 * Message Model - Data access layer for messaging operations.
 */
const pool = require('../db');

/** @returns {Promise<import('pg').QueryResult>} */
exports.create = async (senderId, receiverId, subject, body) => {
  return pool.query(
    `INSERT INTO messages (sender_id, receiver_id, subject, body, created_at)
     VALUES ($1, $2, $3, $4, NOW())
     RETURNING *`,
    [senderId, receiverId, subject, body]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.findInbox = async (userId, search, unread) => {
  let query = `
    SELECT m.*, u.name as sender_name
    FROM messages m
    JOIN users u ON u.id = m.sender_id
    WHERE m.receiver_id = $1 AND m.deleted_by_receiver = FALSE
  `;
  const params = [userId];

  if (unread === 'true') {
    query += ' AND m.is_read = FALSE';
  }
  if (search) {
    query += ` AND (m.subject ILIKE $${params.length + 1} OR m.body ILIKE $${params.length + 1})`;
    params.push(`%${search}%`);
  }
  query += ' ORDER BY m.created_at DESC LIMIT 50';
  return pool.query(query, params);
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.findSent = async (userId, search) => {
  let query = `
    SELECT m.*, u.name as receiver_name
    FROM messages m
    JOIN users u ON u.id = m.receiver_id
    WHERE m.sender_id = $1 AND m.deleted_by_sender = FALSE
  `;
  const params = [userId];

  if (search) {
    query += ` AND (m.subject ILIKE $${params.length + 1} OR m.body ILIKE $${params.length + 1})`;
    params.push(`%${search}%`);
  }
  query += ' ORDER BY m.created_at DESC LIMIT 50';
  return pool.query(query, params);
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.findById = async (id) => {
  return pool.query(
    `SELECT m.*,
            sender.name as sender_name,
            receiver.name as receiver_name
     FROM messages m
     JOIN users sender ON sender.id = m.sender_id
     JOIN users receiver ON receiver.id = m.receiver_id
     WHERE m.id = $1`,
    [id]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.markRead = async (id) => {
  return pool.query(
    'UPDATE messages SET is_read = TRUE, updated_at = NOW() WHERE id = $1',
    [id]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.updateReadStatus = async (id, receiverId, isRead) => {
  return pool.query(
    `UPDATE messages
     SET is_read = $1, updated_at = NOW()
     WHERE id = $2 AND receiver_id = $3
     RETURNING *`,
    [isRead, id, receiverId]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.softDeleteBySender = async (id) => {
  return pool.query(
    'UPDATE messages SET deleted_by_sender = TRUE WHERE id = $1',
    [id]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.softDeleteByReceiver = async (id) => {
  return pool.query(
    'UPDATE messages SET deleted_by_receiver = TRUE WHERE id = $1',
    [id]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.hardDeleteIfBothDeleted = async (id) => {
  return pool.query(
    'DELETE FROM messages WHERE id = $1 AND deleted_by_sender = TRUE AND deleted_by_receiver = TRUE',
    [id]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.getUnreadCount = async (userId) => {
  return pool.query(
    `SELECT COUNT(*) as count FROM messages
     WHERE receiver_id = $1 AND is_read = FALSE AND deleted_by_receiver = FALSE`,
    [userId]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.findReceiverById = async (receiverId) => {
  return pool.query('SELECT id FROM users WHERE id = $1', [receiverId]);
};
