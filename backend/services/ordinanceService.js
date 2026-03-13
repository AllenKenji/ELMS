/**
 * Ordinance Service - Business logic for ordinance operations.
 */
const pool = require('../db');
const Ordinance = require('../models/Ordinance');
const AuditLog = require('../models/AuditLog');
const { createNotification } = require('../utils/notifications');
const { getIO } = require('../socket');

/**
 * Create a new ordinance.
 * @param {object} data
 * @param {object} user
 * @returns {Promise<object>}
 */
exports.createOrdinance = async ({ title, ordinance_number, description, content, remarks, proposer_name }, user) => {
  const result = await Ordinance.create(
    title, ordinance_number, description, content, remarks,
    user.id, proposer_name || user.name
  );
  const ordinance = result.rows[0];

  await AuditLog.create(null, user.id, 'ORDINANCE_CREATE', `Ordinance "${title}" created`);
  await createNotification(user.id, `Your ordinance "${title}" has been created.`);

  const io = getIO();
  io.to('Secretary').emit('ordinanceCreated', ordinance);
  io.to('Councilor').emit('ordinanceCreated', ordinance);

  return ordinance;
};

/**
 * Retrieve all ordinances with optional filter.
 * @param {string|number} [proposerId]
 * @returns {Promise<Array>}
 */
exports.getAllOrdinances = async (proposerId) => {
  const result = await Ordinance.findAll(proposerId);
  return result.rows;
};

/**
 * Retrieve a single ordinance by ID.
 * @param {string|number} id
 * @returns {Promise<object>}
 */
exports.getOrdinanceById = async (id) => {
  const result = await Ordinance.findById(id);
  if (result.rows.length === 0) {
    const err = new Error('Ordinance not found');
    err.status = 404;
    throw err;
  }
  return result.rows[0];
};

/**
 * Update an ordinance.
 * @param {string|number} id
 * @param {object} data
 * @param {number} userId
 * @returns {Promise<object>}
 */
exports.updateOrdinance = async (id, { title, ordinance_number, description, content, remarks }, userId) => {
  const result = await Ordinance.update(id, title, ordinance_number, description, content, remarks);
  if (result.rows.length === 0) {
    const err = new Error('Ordinance not found');
    err.status = 404;
    throw err;
  }

  await AuditLog.create(null, userId, 'ORDINANCE_UPDATE', `Ordinance "${title}" updated`);
  return result.rows[0];
};

/**
 * Delete an ordinance and its related records.
 * @param {string|number} id
 * @param {number} userId
 * @returns {Promise<void>}
 */
exports.deleteOrdinance = async (id, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await Ordinance.findById(id);
    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      const err = new Error('Ordinance not found');
      err.status = 404;
      throw err;
    }

    await Ordinance.deleteWorkflow(client, id);
    await Ordinance.deleteApprovals(client, id);
    await Ordinance.deleteById(client, id);
    await AuditLog.create(client, userId, 'ORDINANCE_DELETE', `Ordinance "${existing.rows[0].title}" deleted`);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Get workflow data for an ordinance.
 * @param {string|number} id
 * @returns {Promise<object>}
 */
exports.getWorkflow = async (id) => {
  const result = await Ordinance.findWorkflow(id);
  return { actions: result.rows };
};

/**
 * Get workflow history for an ordinance.
 * @param {string|number} id
 * @returns {Promise<Array>}
 */
exports.getHistory = async (id) => {
  const result = await Ordinance.findHistory(id);
  return result.rows;
};

/**
 * Get approvals for an ordinance.
 * @param {string|number} id
 * @returns {Promise<Array>}
 */
exports.getApprovals = async (id) => {
  const result = await Ordinance.findApprovals(id);
  return result.rows;
};

/**
 * Change ordinance status.
 * @param {string|number} id
 * @param {string} status
 * @param {string} notes
 * @param {number} userId
 * @returns {Promise<object>}
 */
exports.changeStatus = async (id, status, notes, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const ordinanceResult = await Ordinance.updateStatus(client, id, status);
    if (ordinanceResult.rows.length === 0) {
      await client.query('ROLLBACK');
      const err = new Error('Ordinance not found');
      err.status = 404;
      throw err;
    }

    const ordinance = ordinanceResult.rows[0];
    await Ordinance.insertWorkflowAction(client, id, 'STATUS_CHANGE', status, userId, notes || '');

    if (status === 'Approved') await Ordinance.setApprovedDate(client, id);
    if (status === 'Published') await Ordinance.setPublishedDate(client, id);

    await AuditLog.create(client, userId, 'STATUS_CHANGE', `Ordinance status changed to "${status}"`);
    await createNotification(ordinance.proposer_id, `Your ordinance "${ordinance.title}" status changed to "${status}".`);

    const io = getIO();
    io.emit('ordinanceStatusChanged', { ordinance, newStatus: status });

    await client.query('COMMIT');
    return { ordinance, workflow: { status, changed_at: new Date() } };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Perform a workflow action on an ordinance.
 * @param {string|number} id
 * @param {string} action
 * @param {string} comment
 * @param {number} userId
 * @returns {Promise<object>}
 */
exports.performWorkflowAction = async (id, action, comment, userId) => {
  const validActions = {
    submit: 'Submitted',
    approve: 'Approved',
    reject: 'Rejected',
    request_changes: 'Draft',
    publish: 'Published',
    archive: 'Archived',
  };

  if (!validActions[action]) {
    const err = new Error('Invalid action');
    err.status = 400;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const ordinanceResult = await Ordinance.findById(id);
    if (ordinanceResult.rows.length === 0) {
      await client.query('ROLLBACK');
      const err = new Error('Ordinance not found');
      err.status = 404;
      throw err;
    }

    const ordinance = ordinanceResult.rows[0];
    const newStatus = validActions[action];

    const updatedOrdinance = await Ordinance.updateStatus(client, id, newStatus);
    const workflowResult = await Ordinance.insertWorkflowAction(
      client, id, action.toUpperCase(), newStatus, userId, comment || ''
    );

    if (newStatus === 'Approved') await Ordinance.setApprovedDate(client, id);
    if (newStatus === 'Published') await Ordinance.setPublishedDate(client, id);

    if (['approve', 'reject'].includes(action)) {
      await Ordinance.updateApprovalByApprover(
        client, id, userId,
        action === 'approve' ? 'Approved' : 'Rejected',
        comment || ''
      );
    }

    await AuditLog.create(client, userId, `WORKFLOW_${action.toUpperCase()}`, `Action: ${action} on ordinance "${ordinance.title}"`);

    const actionMessages = {
      submit: 'submitted for review',
      approve: 'approved',
      reject: 'rejected',
      request_changes: 'requested changes for',
      publish: 'published',
      archive: 'archived',
    };
    await createNotification(ordinance.proposer_id, `Your ordinance "${ordinance.title}" has been ${actionMessages[action]}.`);

    const workflowHistory = await Ordinance.findWorkflow(id);
    const approvals = await Ordinance.findApprovals(id);

    const io = getIO();
    io.emit('ordinanceWorkflowUpdated', {
      ordinance: updatedOrdinance.rows[0],
      action,
      workflow: workflowResult.rows[0],
    });

    await client.query('COMMIT');
    return {
      ordinance: updatedOrdinance.rows[0],
      workflow: workflowHistory.rows,
      approvals: approvals.rows,
      message: `Action "${action}" performed successfully`,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Create an approval record for an ordinance.
 * @param {string|number} ordinanceId
 * @param {object} data
 * @returns {Promise<object>}
 */
exports.createApproval = async (ordinanceId, { approver_role, approver_id, notes }) => {
  const result = await Ordinance.createApproval(ordinanceId, approver_role, approver_id, notes);
  const approval = result.rows[0];

  if (approver_id) {
    const ordinanceResult = await Ordinance.findById(ordinanceId);
    await createNotification(
      approver_id,
      `New ordinance awaiting your approval: "${ordinanceResult.rows[0]?.title}"`
    );
  }

  return approval;
};

/**
 * Update an approval record.
 * @param {string|number} approvalId
 * @param {string|number} ordinanceId
 * @param {string} status
 * @param {string} notes
 * @returns {Promise<object>}
 */
exports.updateApproval = async (approvalId, ordinanceId, status, notes) => {
  const result = await Ordinance.updateApproval(approvalId, ordinanceId, status, notes);
  if (result.rows.length === 0) {
    const err = new Error('Approval not found');
    err.status = 404;
    throw err;
  }
  return result.rows[0];
};
