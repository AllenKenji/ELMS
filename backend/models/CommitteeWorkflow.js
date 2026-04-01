/**
 * CommitteeWorkflow Model - Data access layer for committee workflow operations.
 */
const pool = require('../db');

/**
 * Create a new committee workflow entry
 * @param {object} data
 * @returns {Promise<import('pg').QueryResult>}
 */
exports.create = async (data) => {
  const {
    item_type,
    item_id,
    committee_id,
    status = 'pending',
    remarks = null,
    last_action_date = null,
  } = data;
  return pool.query(
    `INSERT INTO committee_workflows
      (item_type, item_id, committee_id, status, remarks, last_action_date, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
     RETURNING *`,
    [item_type, item_id, committee_id, status, remarks, last_action_date]
  );
};

/**
 * Get all workflows for a specific item (ordinance/resolution)
 * @param {string} item_type
 * @param {number} item_id
 * @returns {Promise<import('pg').QueryResult>}
 */
exports.findByItem = async (item_type, item_id) => {
  return pool.query(
    `SELECT * FROM committee_workflows WHERE item_type = $1 AND item_id = $2 ORDER BY created_at ASC`,
    [item_type, item_id]
  );
};

/**
 * Update workflow status and remarks
 * @param {number} id
 * @param {string} status
 * @param {string} remarks
 * @returns {Promise<import('pg').QueryResult>}
 */
exports.updateStatus = async (id, status, remarks) => {
  return pool.query(
    `UPDATE committee_workflows
     SET status = $1, remarks = $2, last_action_date = NOW(), updated_at = NOW()
     WHERE id = $3 RETURNING *`,
    [status, remarks, id]
  );
};

/**
 * Get all workflows for a committee
 * @param {number} committee_id
 * @returns {Promise<import('pg').QueryResult>}
 */
exports.findByCommittee = async (committee_id) => {
  return pool.query(
    `SELECT * FROM committee_workflows WHERE committee_id = $1 ORDER BY created_at DESC`,
    [committee_id]
  );
};
