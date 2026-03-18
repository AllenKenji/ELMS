/**
 * Ordinance Service - Business logic for ordinance operations.
 */
const pool = require('../db');
const Ordinance = require('../models/Ordinance');
const AuditLog = require('../models/AuditLog');
const { createNotification } = require('../utils/notifications');
const { getIO } = require('../socket');

async function normalizeCouncilorCoAuthors(coAuthorIds, { allowEmpty = true } = {}) {
  if (coAuthorIds === undefined || coAuthorIds === null) {
    if (allowEmpty) return null;
    const err = new Error('Co-authors must be provided as an array');
    err.status = 400;
    throw err;
  }

  if (!Array.isArray(coAuthorIds)) {
    const err = new Error('Co-authors must be provided as an array');
    err.status = 400;
    throw err;
  }

  if (coAuthorIds.length === 0) {
    if (allowEmpty) return null;
    const err = new Error('At least one co-author / sponsor is required');
    err.status = 400;
    throw err;
  }

  const normalized = [...new Set(coAuthorIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
  if (normalized.length !== coAuthorIds.length) {
    const err = new Error('Co-authors must be valid user IDs');
    err.status = 400;
    throw err;
  }

  const result = await pool.query(
    `SELECT u.id, r.role_name
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.id = ANY($1::int[])`,
    [normalized]
  );

  if (result.rows.length !== normalized.length) {
    const err = new Error('One or more selected co-authors do not exist');
    err.status = 400;
    throw err;
  }

  const hasNonCouncilor = result.rows.some(
    (row) => String(row.role_name || '').toLowerCase() !== 'councilor'
  );
  if (hasNonCouncilor) {
    const err = new Error('Co-authors / sponsors must be users with Councilor role');
    err.status = 400;
    throw err;
  }

  return normalized.join(',');
}

/**
 * Create a new ordinance.
 * @param {object} data
 * @param {object} user
 * @returns {Promise<object>}
 */
exports.createOrdinance = async (data, user) => {
  // Debug: log incoming data
  console.log('createOrdinance received:', JSON.stringify(data, null, 2));
  // Defensive: check required fields
  const requiredFields = ['title', 'content'];
  for (const field of requiredFields) {
    if (!data[field]) {
      const err = new Error(`Missing required field: ${field}`);
      err.status = 400;
      throw err;
    }
  }
  // Destructure with defaults
  const {
    title = '',
    ordinance_number = '',
    description = '',
    content = '',
    remarks = '',
    proposer_name = '',
    status = '',
    co_authors = [],
    whereas_clauses = '',
    effectivity_clause = '',
    attachments = [],
  } = data;
  const normalizedCoAuthors = await normalizeCouncilorCoAuthors(co_authors, { allowEmpty: true });
  const initialStatus = status || 'Draft';
  const result = await Ordinance.create(
    title, ordinance_number, description, content, remarks,
    user.id,
    proposer_name || user.name,
    initialStatus,
    normalizedCoAuthors,
    whereas_clauses,
    effectivity_clause,
    attachments
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
  const ordinance = result.rows[0];
  // Parse co_authors as array of user objects
  let coAuthors = [];
  if (ordinance.co_authors) {
    // co_authors is a comma-separated string of IDs
    const ids = ordinance.co_authors.split(',').map(id => Number(id.trim())).filter(Boolean);
    if (ids.length > 0) {
      const { rows } = await require('../models/User').findAll();
      coAuthors = rows.filter(u => ids.includes(u.id)).map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role_name: u.role_name || u.role
      }));
    }
  }
  return { ...ordinance, co_authors: coAuthors };
};

/**
 * Update an ordinance.
 * @param {string|number} id
 * @param {object} data
 * @param {number} userId
 * @returns {Promise<object>}
 */
exports.updateOrdinance = async (
  id,
  {
    title,
    ordinance_number,
    description,
    content,
    remarks,
    co_authors,
    whereas_clauses,
    effectivity_clause,
    attachments,
  },
  userId
) => {
  const normalizedCoAuthors = co_authors === undefined
    ? undefined
    : await normalizeCouncilorCoAuthors(co_authors, { allowEmpty: true });

  const result = await Ordinance.update(
    id,
    title,
    ordinance_number,
    description,
    content,
    remarks,
    normalizedCoAuthors,
    whereas_clauses,
    effectivity_clause,
    attachments
  );
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
exports.changeStatus = async (id, status, notes, userId, userRole) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existingResult = await Ordinance.findById(id);
    if (existingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      const err = new Error('Ordinance not found');
      err.status = 404;
      throw err;
    }

    const existingOrdinance = existingResult.rows[0];
    if (userRole === 'Secretary' && existingOrdinance.status === 'Draft' && status === 'Submitted') {
      await client.query('ROLLBACK');
      const err = new Error('Secretary is not allowed to submit draft ordinances as proposed measures');
      err.status = 403;
      throw err;
    }

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
exports.performWorkflowAction = async (id, action, comment, userId, userRole) => {
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

    if (userRole === 'Secretary' && ordinance.status === 'Draft' && newStatus === 'Submitted') {
      await client.query('ROLLBACK');
      const err = new Error('Secretary is not allowed to submit draft ordinances as proposed measures');
      err.status = 403;
      throw err;
    }

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

// ─── Three-Readings Legislative Workflow ─────────────────────────────────────

/**
 * Stage 1: Councilor submits proposed measure to Secretary.
 * Transitions: Draft → SUBMITTED
 */
exports.submitToSecretary = async (id, comment, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await Ordinance.findById(id);
    if (!existing.rows.length) { await client.query('ROLLBACK'); const e = new Error('Ordinance not found'); e.status = 404; throw e; }

    const ordinance = existing.rows[0];
    if (ordinance.reading_stage && ordinance.reading_stage !== 'SUBMITTED') {
      await client.query('ROLLBACK');
      const e = new Error('Ordinance has already been submitted'); e.status = 400; throw e;
    }

    const updated = await Ordinance.setReadingStage(client, id, 'SUBMITTED', 'Submitted');
    await Ordinance.insertWorkflowAction(client, id, 'SUBMIT_TO_SECRETARY', 'SUBMITTED', userId, comment || '');
    await AuditLog.create(client, userId, 'LEGISLATIVE_SUBMIT', `Ordinance "${ordinance.title}" submitted to Secretary`);
    await createNotification(userId, `Ordinance "${ordinance.title}" submitted to Secretary.`);
    const io = getIO();
    io.to('Secretary').emit('ordinanceSubmitted', updated.rows[0]);

    await client.query('COMMIT');
    return updated.rows[0];
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
};

/**
 * Stage 2: Secretary marks First Reading during a session.
 * Transitions: SUBMITTED → FIRST_READING
 */
exports.conductFirstReading = async (id, sessionId, discussionNotes, presidingOfficer, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await Ordinance.findById(id);
    if (!existing.rows.length) { await client.query('ROLLBACK'); const e = new Error('Ordinance not found'); e.status = 404; throw e; }
    const ordinance = existing.rows[0];
    if (ordinance.reading_stage !== 'SUBMITTED') {
      await client.query('ROLLBACK');
      const e = new Error('First Reading requires ordinance to be in SUBMITTED stage'); e.status = 400; throw e;
    }

    await client.query(
      `UPDATE ordinances SET session_id_first_reading=$1, reading_stage='FIRST_READING', status='Under Review', updated_at=NOW() WHERE id=$2`,
      [sessionId || null, id]
    );
    const updated = await client.query('SELECT * FROM ordinances WHERE id=$1', [id]);
    await Ordinance.insertReadingSession(client, id, sessionId, 1, discussionNotes, presidingOfficer);
    await Ordinance.insertWorkflowAction(client, id, 'FIRST_READING', 'FIRST_READING', userId, discussionNotes || '');
    await AuditLog.create(client, userId, 'FIRST_READING', `First reading conducted for "${ordinance.title}"`);
    await createNotification(ordinance.proposer_id, `First reading conducted for your ordinance "${ordinance.title}".`);
    const io = getIO();
    io.emit('ordinanceFirstReading', updated.rows[0]);

    await client.query('COMMIT');
    return updated.rows[0];
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
};

/**
 * Stage 3: Secretary assigns ordinance to a committee.
 * Transitions: FIRST_READING → COMMITTEE_REVIEW
 */
exports.assignCommittee = async (id, committeeId, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await Ordinance.findById(id);
    if (!existing.rows.length) { await client.query('ROLLBACK'); const e = new Error('Ordinance not found'); e.status = 404; throw e; }
    const ordinance = existing.rows[0];
    if (ordinance.reading_stage !== 'FIRST_READING') {
      await client.query('ROLLBACK');
      const e = new Error('Committee assignment requires ordinance to be in FIRST_READING stage'); e.status = 400; throw e;
    }

    const updated = await Ordinance.assignCommittee(client, id, committeeId, userId);
    await Ordinance.insertWorkflowAction(client, id, 'ASSIGN_COMMITTEE', 'COMMITTEE_REVIEW', userId, `Assigned to committee ${committeeId}`);
    await AuditLog.create(client, userId, 'COMMITTEE_ASSIGNED', `Committee ${committeeId} assigned to "${ordinance.title}"`);
    await createNotification(ordinance.proposer_id, `Your ordinance "${ordinance.title}" has been assigned to a committee.`);
    const io = getIO();
    io.emit('ordinanceCommitteeAssigned', updated.rows[0]);

    await client.query('COMMIT');
    return updated.rows[0];
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
};

/**
 * Stage 4: Committee submits its report.
 * Transitions: COMMITTEE_REVIEW → COMMITTEE_REPORT_SUBMITTED
 */
exports.submitCommitteeReport = async (id, reportData, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await Ordinance.findById(id);
    if (!existing.rows.length) { await client.query('ROLLBACK'); const e = new Error('Ordinance not found'); e.status = 404; throw e; }
    const ordinance = existing.rows[0];
    if (ordinance.reading_stage !== 'COMMITTEE_REVIEW') {
      await client.query('ROLLBACK');
      const e = new Error('Committee report requires ordinance to be in COMMITTEE_REVIEW stage'); e.status = 400; throw e;
    }

    const report = await Ordinance.insertCommitteeReport(client, {
      ordinanceId: id,
      committeeId: reportData.committee_id || ordinance.committee_id,
      submittedBy: userId,
      recommendation: reportData.recommendation,
      reportContent: reportData.report_content,
      meetingDate: reportData.meeting_date,
      meetingMinutes: reportData.meeting_minutes,
      attendees: reportData.attendees,
    });

    await client.query(
      `UPDATE ordinances SET committee_report_id=$1, reading_stage='COMMITTEE_REPORT_SUBMITTED', updated_at=NOW() WHERE id=$2`,
      [report.rows[0].id, id]
    );
    const updated = await client.query('SELECT * FROM ordinances WHERE id=$1', [id]);
    await Ordinance.insertWorkflowAction(client, id, 'COMMITTEE_REPORT', 'COMMITTEE_REPORT_SUBMITTED', userId, `Recommendation: ${reportData.recommendation}`);
    await AuditLog.create(client, userId, 'COMMITTEE_REPORT_SUBMITTED', `Committee report submitted for "${ordinance.title}"`);
    await createNotification(ordinance.proposer_id, `Committee report submitted for your ordinance "${ordinance.title}". Recommendation: ${reportData.recommendation}`);
    const io = getIO();
    io.to('Secretary').emit('committeeReportSubmitted', { ordinance: updated.rows[0], report: report.rows[0] });

    await client.query('COMMIT');
    return { ordinance: updated.rows[0], report: report.rows[0] };
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
};

/**
 * Stage 5: Secretary records Second Reading.
 * Transitions: COMMITTEE_REPORT_SUBMITTED → SECOND_READING
 */
exports.conductSecondReading = async (id, sessionId, discussionNotes, presidingOfficer, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await Ordinance.findById(id);
    if (!existing.rows.length) { await client.query('ROLLBACK'); const e = new Error('Ordinance not found'); e.status = 404; throw e; }
    const ordinance = existing.rows[0];
    if (ordinance.reading_stage !== 'COMMITTEE_REPORT_SUBMITTED') {
      await client.query('ROLLBACK');
      const e = new Error('Second Reading requires ordinance to be in COMMITTEE_REPORT_SUBMITTED stage'); e.status = 400; throw e;
    }

    await client.query(
      `UPDATE ordinances SET session_id_second_reading=$1, reading_stage='SECOND_READING', updated_at=NOW() WHERE id=$2`,
      [sessionId || null, id]
    );
    const updated = await client.query('SELECT * FROM ordinances WHERE id=$1', [id]);
    await Ordinance.insertReadingSession(client, id, sessionId, 2, discussionNotes, presidingOfficer);
    await Ordinance.insertWorkflowAction(client, id, 'SECOND_READING', 'SECOND_READING', userId, discussionNotes || '');
    await AuditLog.create(client, userId, 'SECOND_READING', `Second reading conducted for "${ordinance.title}"`);
    await createNotification(ordinance.proposer_id, `Second reading conducted for your ordinance "${ordinance.title}".`);
    const io = getIO();
    io.emit('ordinanceSecondReading', updated.rows[0]);

    await client.query('COMMIT');
    return updated.rows[0];
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
};

/**
 * Stage 6: Third Reading — final voting.
 * Transitions: SECOND_READING → THIRD_READING_VOTED (or REJECTED if failed)
 */
exports.conductThirdReadingVote = async (id, sessionId, yesCount, noCount, abstainCount, presidingOfficer, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await Ordinance.findById(id);
    if (!existing.rows.length) { await client.query('ROLLBACK'); const e = new Error('Ordinance not found'); e.status = 404; throw e; }
    const ordinance = existing.rows[0];
    if (ordinance.reading_stage !== 'SECOND_READING') {
      await client.query('ROLLBACK');
      const e = new Error('Third Reading requires ordinance to be in SECOND_READING stage'); e.status = 400; throw e;
    }

    const passed = yesCount > noCount;
    const votingResults = { yes_count: yesCount, no_count: noCount, abstain_count: abstainCount, passed, passed_at: new Date() };

    if (passed) {
      await Ordinance.recordVote(client, id, votingResults, sessionId);
    } else {
      await client.query(
        `UPDATE ordinances SET voting_results=$1, voted_at=NOW(), session_id_third_reading=$2,
         reading_stage='REJECTED', status='Rejected', updated_at=NOW() WHERE id=$3`,
        [JSON.stringify(votingResults), sessionId || null, id]
      );
    }
    const updated = await client.query('SELECT * FROM ordinances WHERE id=$1', [id]);
    await Ordinance.insertReadingSession(client, id, sessionId, 3, `Yes:${yesCount} No:${noCount} Abstain:${abstainCount}`, presidingOfficer);
    await Ordinance.insertWorkflowAction(client, id, 'THIRD_READING_VOTE', passed ? 'THIRD_READING_VOTED' : 'REJECTED', userId,
      `Yes:${yesCount} No:${noCount} Abstain:${abstainCount} — ${passed ? 'PASSED' : 'FAILED'}`);
    await AuditLog.create(client, userId, 'THIRD_READING_VOTE', `Third reading vote for "${ordinance.title}": ${passed ? 'Passed' : 'Failed'}`);
    await createNotification(ordinance.proposer_id,
      `Third reading vote for your ordinance "${ordinance.title}" ${passed ? 'PASSED' : 'FAILED'} (Yes:${yesCount} No:${noCount} Abstain:${abstainCount}).`);
    const io = getIO();
    io.emit('ordinanceThirdReadingVoted', { ordinance: updated.rows[0], passed, votingResults });

    await client.query('COMMIT');
    return { ordinance: updated.rows[0], passed, votingResults };
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
};

/**
 * Stage 7a: Captain/Mayor approves ordinance.
 * Transitions: THIRD_READING_VOTED → APPROVED
 */
exports.executiveApproval = async (id, approvedBy, remarks, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await Ordinance.findById(id);
    if (!existing.rows.length) { await client.query('ROLLBACK'); const e = new Error('Ordinance not found'); e.status = 404; throw e; }
    const ordinance = existing.rows[0];
    if (ordinance.reading_stage !== 'THIRD_READING_VOTED') {
      await client.query('ROLLBACK');
      const e = new Error('Executive approval requires ordinance to be in THIRD_READING_VOTED stage'); e.status = 400; throw e;
    }

    const updated = await Ordinance.recordApproval(client, id, approvedBy || userId, remarks);
    await Ordinance.insertWorkflowAction(client, id, 'EXECUTIVE_APPROVAL', 'APPROVED', userId, remarks || '');
    await AuditLog.create(client, userId, 'EXECUTIVE_APPROVAL', `Ordinance "${ordinance.title}" approved by executive`);
    await createNotification(ordinance.proposer_id, `Your ordinance "${ordinance.title}" has been approved by the executive!`);
    const io = getIO();
    io.emit('ordinanceExecutiveApproval', updated.rows[0]);

    await client.query('COMMIT');
    return updated.rows[0];
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
};

/**
 * Stage 7b: Captain/Mayor rejects ordinance.
 * Transitions: THIRD_READING_VOTED → REJECTED
 */
exports.executiveRejection = async (id, rejectedBy, reason, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await Ordinance.findById(id);
    if (!existing.rows.length) { await client.query('ROLLBACK'); const e = new Error('Ordinance not found'); e.status = 404; throw e; }
    const ordinance = existing.rows[0];
    if (ordinance.reading_stage !== 'THIRD_READING_VOTED') {
      await client.query('ROLLBACK');
      const e = new Error('Executive rejection requires ordinance to be in THIRD_READING_VOTED stage'); e.status = 400; throw e;
    }

    const updated = await Ordinance.recordRejection(client, id, rejectedBy || userId, reason);
    await Ordinance.insertWorkflowAction(client, id, 'EXECUTIVE_REJECTION', 'REJECTED', userId, reason || '');
    await AuditLog.create(client, userId, 'EXECUTIVE_REJECTION', `Ordinance "${ordinance.title}" rejected by executive`);
    await createNotification(ordinance.proposer_id, `Your ordinance "${ordinance.title}" has been rejected by the executive. Reason: ${reason}`);
    const io = getIO();
    io.emit('ordinanceExecutiveRejection', updated.rows[0]);

    await client.query('COMMIT');
    return updated.rows[0];
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
};

/**
 * Stage 8a: Secretary posts ordinance publicly.
 * Transitions: APPROVED → POSTED
 */
exports.postPublicly = async (id, postingDurationDays, postingLocation, notes, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await Ordinance.findById(id);
    if (!existing.rows.length) { await client.query('ROLLBACK'); const e = new Error('Ordinance not found'); e.status = 404; throw e; }
    const ordinance = existing.rows[0];
    if (ordinance.reading_stage !== 'APPROVED') {
      await client.query('ROLLBACK');
      const e = new Error('Public posting requires ordinance to be in APPROVED stage'); e.status = 400; throw e;
    }

    const days = postingDurationDays || 3;
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);
    const postingEndDate = endDate.toISOString().split('T')[0];

    const updated = await Ordinance.recordPosting(client, id, postingEndDate);
    await Ordinance.insertPostingRecord(client, {
      ordinanceId: id, postedBy: userId,
      postingDurationDays: days, postingLocation,
      effectiveDate: postingEndDate, notes,
    });
    await Ordinance.insertWorkflowAction(client, id, 'POST_PUBLICLY', 'POSTED', userId, `Posted for ${days} days at: ${postingLocation || 'N/A'}`);
    await AuditLog.create(client, userId, 'ORDINANCE_POSTED', `Ordinance "${ordinance.title}" posted publicly`);
    const io = getIO();
    io.emit('ordinancePosted', updated.rows[0]);

    await client.query('COMMIT');
    return updated.rows[0];
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
};

/**
 * Stage 8b: Mark ordinance as effective after posting period.
 * Transitions: POSTED → EFFECTIVE
 */
exports.markEffective = async (id, effectiveDate, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await Ordinance.findById(id);
    if (!existing.rows.length) { await client.query('ROLLBACK'); const e = new Error('Ordinance not found'); e.status = 404; throw e; }
    const ordinance = existing.rows[0];
    if (ordinance.reading_stage !== 'POSTED') {
      await client.query('ROLLBACK');
      const e = new Error('Mark effective requires ordinance to be in POSTED stage'); e.status = 400; throw e;
    }

    const effDate = effectiveDate || new Date().toISOString().split('T')[0];
    const updated = await Ordinance.recordEffective(client, id, effDate);
    await Ordinance.insertWorkflowAction(client, id, 'MARK_EFFECTIVE', 'EFFECTIVE', userId, `Effective date: ${effDate}`);
    await AuditLog.create(client, userId, 'ORDINANCE_EFFECTIVE', `Ordinance "${ordinance.title}" is now effective`);
    await createNotification(ordinance.proposer_id, `Your ordinance "${ordinance.title}" is now in effect!`);
    const io = getIO();
    io.emit('ordinanceEffective', updated.rows[0]);

    await client.query('COMMIT');
    return updated.rows[0];
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
};

/**
 * Get complete workflow status including readings, committee report, posting.
 */
exports.getWorkflowStatus = async (id) => {
  const [ordinance, readings, history] = await Promise.all([
    Ordinance.findById(id),
    Ordinance.findReadingSessions(id),
    Ordinance.findHistory(id),
  ]);

  if (!ordinance.rows.length) {
    const e = new Error('Ordinance not found'); e.status = 404; throw e;
  }

  const ord = ordinance.rows[0];
  let committeeReport = null;
  let postingRecords = [];

  if (ord.committee_report_id) {
    const rpt = await Ordinance.findCommitteeReport(id);
    committeeReport = rpt.rows[0] || null;
  }

  const posting = await Ordinance.findPostingRecords(id);
  postingRecords = posting.rows;

  return {
    ordinance: ord,
    readings: readings.rows,
    committeeReport,
    postingRecords,
    history: history.rows,
  };
};

/**
 * Get committee report for an ordinance.
 */
exports.getCommitteeReport = async (id) => {
  const result = await Ordinance.findCommitteeReport(id);
  return result.rows[0] || null;
};

/**
 * Add an ordinance to a session agenda.
 */
exports.addAgendaItem = async (sessionId, ordinanceId, agendaOrder, readingNumber) => {
  const result = await Ordinance.upsertAgendaItem(sessionId, ordinanceId, agendaOrder, readingNumber);
  return result.rows[0];
};

/**
 * Get all agenda items for a session.
 */
exports.getSessionAgenda = async (sessionId) => {
  const result = await Ordinance.findAgendaBySession(sessionId);
  return result.rows;
};

/**
 * Remove an ordinance from a session agenda.
 */
exports.removeAgendaItem = async (sessionId, ordinanceId) => {
  const result = await Ordinance.removeAgendaItem(sessionId, ordinanceId);
  return result.rows[0] || null;
};

/**
 * Get all sessions an ordinance is scheduled in (via agenda items).
 */
exports.getOrdinanceSessions = async (ordinanceId) => {
  const result = await Ordinance.findSessionsByOrdinance(ordinanceId);
  return result.rows;
};
