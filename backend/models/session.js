/**
 * Session Model - Data access layer for legislative session operations.
 */
const pool = require('../db');

/** @returns {Promise<import('pg').QueryResult>} */
exports.findAll = async () => {
  return pool.query(
    `SELECT s.*, u.name as created_by_name
     FROM sessions s
     LEFT JOIN users u ON u.id = s.created_by
     ORDER BY s.date DESC`
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.findById = async (id) => {
  return pool.query(
    `SELECT s.*, u.name as created_by_name
     FROM sessions s
     LEFT JOIN users u ON u.id = s.created_by
     WHERE s.id = $1`,
    [id]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.create = async (title, date, location, agenda, notes, createdBy) => {
  return pool.query(
    `INSERT INTO sessions (title, date, location, agenda, notes, created_by, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`,
    [title, date, location, agenda, notes || null, createdBy]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.update = async (id, title, date, location, agenda, notes) => {
  return pool.query(
    `UPDATE sessions
     SET title=$1, date=$2, location=$3, agenda=$4, notes=$5, updated_at=NOW()
     WHERE id=$6 RETURNING *`,
    [title, date, location, agenda, notes || null, id]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.deleteById = async (client, id) => {
  return client.query('DELETE FROM sessions WHERE id = $1', [id]);
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.findOrdinancesBySessionId = async (sessionId) => {
  return pool.query(
    `SELECT o.*, u.name as proposer_name
     FROM ordinances o
     LEFT JOIN users u ON u.id = o.proposer_id
     WHERE o.session_id = $1
     ORDER BY o.created_at DESC`,
    [sessionId]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.findParticipants = async (sessionId) => {
  return pool.query(
    `SELECT u.id, u.name, u.email, r.role_name as role, sp.attendance_status
     FROM session_participants sp
     LEFT JOIN users u ON u.id = sp.user_id
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE sp.session_id = $1
     ORDER BY u.name ASC`,
    [sessionId]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.addParticipant = async (sessionId, userId) => {
  return pool.query(
    `INSERT INTO session_participants (session_id, user_id, attendance_status, added_at)
     VALUES ($1, $2, 'Pending', NOW())
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [sessionId, userId]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.updateParticipantAttendance = async (sessionId, userId, attendanceStatus) => {
  return pool.query(
    `UPDATE session_participants
     SET attendance_status = $1
     WHERE session_id = $2 AND user_id = $3
     RETURNING *`,
    [attendanceStatus, sessionId, userId]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.deleteParticipants = async (client, sessionId) => {
  return client.query('DELETE FROM session_participants WHERE session_id = $1', [sessionId]);
};
