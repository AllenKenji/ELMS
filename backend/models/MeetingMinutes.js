/**
 * MeetingMinutes Model - Data access layer for meeting minutes operations.
 */
const pool = require('../db');

/** @returns {Promise<import('pg').QueryResult>} */
exports.create = async (title, meetingDate, participants, transcript, createdBy, sessionId) => {
  return pool.query(
    `INSERT INTO meeting_minutes
       (title, meeting_date, participants, transcript, status, created_by, session_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'Draft', $5, $6, NOW(), NOW())
     RETURNING *`,
    [title, meetingDate || null, participants || null, transcript, createdBy, sessionId || null]
  );
};

/** @returns {Promise<{minutes: Array, total: number}>} */
exports.findAll = async (status, pageNum, limitNum, safeSort, safeOrder) => {
  const conditions = [];
  const params = [];

  if (status) {
    params.push(status);
    conditions.push(`m.status = $${params.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (pageNum - 1) * limitNum;

  const countRes = await pool.query(
    `SELECT COUNT(*) FROM meeting_minutes m ${whereClause}`,
    params
  );
  const total = parseInt(countRes.rows[0].count, 10);

  params.push(limitNum, offset);
  const result = await pool.query(
    `SELECT m.*, u.name AS created_by_name
     FROM meeting_minutes m
     LEFT JOIN users u ON u.id = m.created_by
     ${whereClause}
     ORDER BY ${safeSort} ${safeOrder}
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return { minutes: result.rows, total };
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.findById = async (id) => {
  return pool.query(
    `SELECT m.*, u.name AS created_by_name
     FROM meeting_minutes m
     LEFT JOIN users u ON u.id = m.created_by
     WHERE m.id = $1`,
    [id]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.update = async (id, title, meetingDate, participants, status) => {
  return pool.query(
    `UPDATE meeting_minutes
     SET title = $1, meeting_date = $2, participants = $3, status = $4, updated_at = NOW()
     WHERE id = $5
     RETURNING *`,
    [title, meetingDate || null, participants || null, status, id]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.updateGeneratedMinutes = async (id, generatedMinutes, attendees, keyDecisions, actionItems, nextSteps) => {
  return pool.query(
    `UPDATE meeting_minutes
     SET generated_minutes = $1, attendees = $2, key_decisions = $3,
         action_items = $4, next_steps = $5, status = 'Generated', updated_at = NOW()
     WHERE id = $6
     RETURNING *`,
    [generatedMinutes, attendees || null, keyDecisions || null, actionItems || null, nextSteps || null, id]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.deleteById = async (id) => {
  return pool.query('DELETE FROM meeting_minutes WHERE id = $1', [id]);
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.findBySessionId = async (sessionId) => {
  return pool.query(
    `SELECT m.*, u.name AS created_by_name
     FROM meeting_minutes m
     LEFT JOIN users u ON u.id = m.created_by
     WHERE m.session_id = $1
     ORDER BY m.created_at DESC`,
    [sessionId]
  );
};
