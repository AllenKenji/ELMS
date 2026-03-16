/**
 * Ordinance Model - Data access layer for ordinance operations.
 */
const pool = require('../db');

/** @returns {Promise<import('pg').QueryResult>} */
exports.findAll = async (proposerId) => {
  let query = 'SELECT * FROM ordinances';
  const params = [];
  if (proposerId) {
    query += ' WHERE proposer_id = $1';
    params.push(proposerId);
  }
  query += ' ORDER BY created_at DESC';
  return pool.query(query, params);
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.findById = async (id) => {
  return pool.query('SELECT * FROM ordinances WHERE id = $1', [id]);
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.create = async (title, ordinanceNumber, description, content, remarks, proposerId, proposerName) => {
  return pool.query(
    `INSERT INTO ordinances (
       title, ordinance_number, description, content, remarks,
       proposer_id, proposer_name, status, created_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'Draft', NOW())
     RETURNING *`,
    [title, ordinanceNumber, description, content, remarks, proposerId, proposerName]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.update = async (id, title, ordinanceNumber, description, content, remarks) => {
  return pool.query(
    `UPDATE ordinances
     SET title = COALESCE($1, title),
         ordinance_number = COALESCE($2, ordinance_number),
         description = COALESCE($3, description),
         content = COALESCE($4, content),
         remarks = COALESCE($5, remarks)
     WHERE id = $6 RETURNING *`,
    [title, ordinanceNumber, description, content, remarks, id]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.deleteById = async (client, id) => {
  return client.query('DELETE FROM ordinances WHERE id = $1', [id]);
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.updateStatus = async (client, id, status) => {
  return client.query(
    'UPDATE ordinances SET status = $1 WHERE id = $2 RETURNING *',
    [status, id]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.setApprovedDate = async (client, id) => {
  return client.query('UPDATE ordinances SET approved_date = NOW() WHERE id = $1', [id]);
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.setPublishedDate = async (client, id) => {
  return client.query('UPDATE ordinances SET published_date = NOW() WHERE id = $1', [id]);
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.findWorkflow = async (id) => {
  return pool.query(
    'SELECT * FROM ordinance_workflow WHERE ordinance_id = $1 ORDER BY created_at DESC',
    [id]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.findHistory = async (id) => {
  return pool.query(
    `SELECT ow.id, ow.ordinance_id, ow.action_type as action, ow.status,
            ow.performed_by_id, u.name as changed_by_name,
            ow.comment as notes, ow.created_at as changed_at
     FROM ordinance_workflow ow
     LEFT JOIN users u ON u.id = ow.performed_by_id
     WHERE ow.ordinance_id = $1
     ORDER BY ow.created_at DESC`,
    [id]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.findApprovals = async (id) => {
  return pool.query(
    `SELECT oa.id, oa.ordinance_id, oa.approver_role, oa.approver_id,
            u.name as approver_name, oa.status, oa.approved_at, oa.notes
     FROM ordinance_approvals oa
     LEFT JOIN users u ON u.id = oa.approver_id
     WHERE oa.ordinance_id = $1
     ORDER BY oa.approver_role ASC`,
    [id]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.insertWorkflowAction = async (client, ordinanceId, actionType, status, performedById, comment) => {
  return client.query(
    `INSERT INTO ordinance_workflow (ordinance_id, action_type, status, performed_by_id, comment, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`,
    [ordinanceId, actionType, status, performedById, comment || '']
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.deleteWorkflow = async (client, ordinanceId) => {
  return client.query('DELETE FROM ordinance_workflow WHERE ordinance_id = $1', [ordinanceId]);
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.createApproval = async (ordinanceId, approverRole, approverId, notes) => {
  return pool.query(
    `INSERT INTO ordinance_approvals (ordinance_id, approver_role, approver_id, status, notes, created_at)
     VALUES ($1, $2, $3, 'Pending', $4, NOW())
     RETURNING *`,
    [ordinanceId, approverRole, approverId, notes || '']
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.updateApproval = async (approvalId, ordinanceId, status, notes) => {
  return pool.query(
    `UPDATE ordinance_approvals
     SET status = $1, notes = $2, approved_at = NOW()
     WHERE id = $3 AND ordinance_id = $4
     RETURNING *`,
    [status, notes || '', approvalId, ordinanceId]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.updateApprovalByApprover = async (client, ordinanceId, approverId, status, notes) => {
  return client.query(
    `UPDATE ordinance_approvals
     SET status = $1, approved_at = NOW(), notes = $2
     WHERE ordinance_id = $3 AND approver_id = $4`,
    [status, notes || '', ordinanceId, approverId]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.deleteApprovals = async (client, ordinanceId) => {
  return client.query('DELETE FROM ordinance_approvals WHERE ordinance_id = $1', [ordinanceId]);
};
