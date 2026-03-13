/**
 * AuditLog Model - Data access layer for audit log operations.
 */
const pool = require('../db');

/** @returns {Promise<import('pg').QueryResult>} */
exports.findAll = async () => {
  return pool.query('SELECT * FROM audit_logs ORDER BY timestamp DESC');
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.create = async (client, userId, action, details) => {
  const db = client || pool;
  return db.query(
    `INSERT INTO audit_logs (user_id, action, details, timestamp)
     VALUES ($1, $2, $3, NOW())`,
    [userId, action, details]
  );
};
