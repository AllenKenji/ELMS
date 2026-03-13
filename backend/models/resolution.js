/**
 * Resolution Model - Data access layer for resolution operations.
 */
const pool = require('../db');

/** @returns {Promise<import('pg').QueryResult>} */
exports.findAll = async (status, proposerId) => {
  let query = `
    SELECT r.*, u.name as proposer_name
    FROM resolutions r
    LEFT JOIN users u ON u.id = r.proposer_id
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    query += ` AND r.status = $${params.length + 1}`;
    params.push(status);
  }
  if (proposerId) {
    query += ` AND r.proposer_id = $${params.length + 1}`;
    params.push(proposerId);
  }
  query += ' ORDER BY r.created_at DESC';
  return pool.query(query, params);
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.findById = async (id) => {
  return pool.query(
    `SELECT r.*, u.name as proposer_name
     FROM resolutions r
     LEFT JOIN users u ON u.id = r.proposer_id
     WHERE r.id = $1`,
    [id]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.create = async (title, resolutionNumber, description, content, remarks, proposerId, proposerName) => {
  return pool.query(
    `INSERT INTO resolutions (title, resolution_number, description, content, remarks, proposer_id, proposer_name, status, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'Draft', NOW()) RETURNING *`,
    [title, resolutionNumber, description, content, remarks || null, proposerId, proposerName]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.update = async (id, title, resolutionNumber, description, content, remarks, status) => {
  return pool.query(
    `UPDATE resolutions
     SET title=$1, resolution_number=$2, description=$3, content=$4, remarks=$5, status=$6, updated_at=NOW()
     WHERE id=$7 RETURNING *`,
    [title, resolutionNumber, description, content, remarks || null, status || 'Draft', id]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.deleteById = async (id) => {
  return pool.query('DELETE FROM resolutions WHERE id = $1', [id]);
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.updateStatus = async (id, status) => {
  return pool.query(
    'UPDATE resolutions SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [status, id]
  );
};
