/**
 * Committee Model - Data access layer for committee operations.
 */
const pool = require('../db');

/** @returns {Promise<import('pg').QueryResult>} */
exports.findAll = async (status) => {
  let query = `
    SELECT c.*, u.name AS chair_name
    FROM committees c
    LEFT JOIN users u ON u.id = c.chair_id
    WHERE 1=1
  `;
  const params = [];
  if (status) {
    query += ` AND c.status = $${params.length + 1}`;
    params.push(status);
  }
  query += ' ORDER BY c.created_at DESC';
  return pool.query(query, params);
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.findById = async (id) => {
  return pool.query(
    `SELECT c.*, u.name AS chair_name
     FROM committees c
     LEFT JOIN users u ON u.id = c.chair_id
     WHERE c.id = $1`,
    [id]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.create = async (name, description, chairId, status) => {
  return pool.query(
    `INSERT INTO committees (name, description, chair_id, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING *`,
    [name, description || null, chairId || null, status || 'Active']
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.update = async (id, name, description, chairId, status) => {
  return pool.query(
    `UPDATE committees
     SET name=$1, description=$2, chair_id=$3, status=$4, updated_at=NOW()
     WHERE id=$5 RETURNING *`,
    [name, description, chairId, status, id]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.deleteById = async (id) => {
  return pool.query('DELETE FROM committees WHERE id = $1', [id]);
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.findMembers = async (committeeId) => {
  return pool.query(
    `SELECT cm.*, u.name AS user_name, u.email AS user_email
     FROM committee_members cm
     JOIN users u ON u.id = cm.user_id
     WHERE cm.committee_id = $1
     ORDER BY cm.joined_at ASC`,
    [committeeId]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.findMemberById = async (memberId, committeeId) => {
  return pool.query(
    `SELECT cm.*, u.name AS user_name
     FROM committee_members cm
     JOIN users u ON u.id = cm.user_id
     WHERE cm.id = $1 AND cm.committee_id = $2`,
    [memberId, committeeId]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.findExistingMember = async (client, committeeId, userId) => {
  return client.query(
    'SELECT id FROM committee_members WHERE committee_id = $1 AND user_id = $2',
    [committeeId, userId]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.addMember = async (client, committeeId, userId, role) => {
  return client.query(
    `INSERT INTO committee_members (committee_id, user_id, role, joined_at)
     VALUES ($1, $2, $3, NOW()) RETURNING *`,
    [committeeId, userId, role]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.removeMember = async (memberId) => {
  return pool.query('DELETE FROM committee_members WHERE id = $1', [memberId]);
};
