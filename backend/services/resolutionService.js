/**
 * Resolution Service - Business logic for resolution operations.
 */
const pool = require('../db');
const Resolution = require('../models/Resolution');
const AuditLog = require('../models/AuditLog');
const { createNotification } = require('../utils/notifications');
const { getIO } = require('../socket');

const VALID_STATUSES = ['Draft', 'Submitted', 'Under Review', 'Approved', 'Published', 'Rejected'];

async function normalizeCouncilorCoAuthors(coAuthorIds, { allowEmpty = true } = {}) {
  if (!Array.isArray(coAuthorIds) || coAuthorIds.length === 0) {
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
 * Create a new resolution.
 * @param {object} data
 * @param {object} user
 * @returns {Promise<object>}
 */
exports.createResolution = async ({
  title,
  resolution_number,
  description,
  content,
  remarks,
  status,
  co_authors,
  whereas_clauses,
  effectivity_clause,
  attachments,
}, user) => {
  const normalizedCoAuthors = await normalizeCouncilorCoAuthors(co_authors);
  const initialStatus = status || 'Draft';
  // Set initial reading_stage based on status
  let initialReadingStage = null;
  if (initialStatus && initialStatus.toLowerCase() === 'draft') {
    initialReadingStage = 'DRAFT';
  } else if (initialStatus && initialStatus.toLowerCase() === 'submitted') {
    initialReadingStage = 'SUBMITTED';
  } else {
    initialReadingStage = 'DRAFT';
  }
  const result = await Resolution.create(
    title,
    resolution_number,
    description,
    content,
    remarks,
    user.id,
    user.name,
    initialStatus,
    normalizedCoAuthors,
    whereas_clauses,
    effectivity_clause,
    attachments,
    initialReadingStage
  );
  const resolution = result.rows[0];

  await AuditLog.create(null, user.id, 'RESOLUTION_CREATE', `Resolution "${title}" created`);

  const io = getIO();
  io.emit('resolutionCreated', resolution);

  return resolution;
};

/**
 * Retrieve all resolutions with optional filters.
 * @param {string} [status]
 * @param {string|number} [proposerId]
 * @returns {Promise<Array>}
 */
exports.getAllResolutions = async (status, proposerId) => {
  const result = await Resolution.findAll(status, proposerId);
  return result.rows;
};

/**
 * Retrieve a single resolution by ID.
 * @param {string|number} id
 * @returns {Promise<object>}
 */
exports.getResolutionById = async (id) => {
  const result = await Resolution.findById(id);
  if (result.rows.length === 0) {
    const err = new Error('Resolution not found');
    err.status = 404;
    throw err;
  }
  const resolution = result.rows[0];

  // Parse co_authors as array of user objects
  let coAuthors = [];
  if (resolution.co_authors) {
    const ids = resolution.co_authors.split(',').map(id => Number(id.trim())).filter(Boolean);
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

  // Fetch and attach full committee object if committee_id is present
  let committee = undefined;
  if (resolution.committee_id) {
    const Committee = require('../models/Committee');
    const committeeResult = await Committee.findById(resolution.committee_id);
    if (committeeResult && committeeResult.rows && committeeResult.rows.length > 0) {
      committee = committeeResult.rows[0];
      if (committee && committee.id) {
        const membersResult = await Committee.findMembers(committee.id);
        committee.members = membersResult && membersResult.rows ? membersResult.rows : [];
      }
    }
  }

  return { ...resolution, co_authors: coAuthors, committee };
};

/**
 * Update a resolution.
 * @param {string|number} id
 * @param {object} data
 * @param {number} userId
 * @returns {Promise<object>}
 */
exports.updateResolution = async (
  id,
  {
    title,
    resolution_number,
    description,
    content,
    remarks,
    status,
    co_authors,
    whereas_clauses,
    effectivity_clause,
    attachments,
  },
  userId,
  userRole
) => {
  const existing = await Resolution.findById(id);
  if (existing.rows.length === 0) {
    const err = new Error('Resolution not found');
    err.status = 404;
    throw err;
  }

  if (userRole === 'Secretary' && existing.rows[0].status === 'Draft' && status === 'Submitted') {
    const err = new Error('Secretary is not allowed to submit draft resolutions as proposed measures');
    err.status = 403;
    throw err;
  }

  const normalizedCoAuthors = co_authors === undefined
    ? undefined
    : await normalizeCouncilorCoAuthors(co_authors);

  const result = await Resolution.update(
    id,
    title,
    resolution_number,
    description,
    content,
    remarks,
    status,
    normalizedCoAuthors,
    whereas_clauses,
    effectivity_clause,
    attachments
  );
  if (result.rows.length === 0) {
    const err = new Error('Resolution not found');
    err.status = 404;
    throw err;
  }

  const resolution = result.rows[0];
  await AuditLog.create(null, userId, 'RESOLUTION_UPDATE', `Resolution "${title}" updated`);

  const io = getIO();
  io.emit('resolutionUpdated', resolution);

  return resolution;
};

/**
 * Delete a resolution and related records.
 * @param {string|number} id
 * @param {number} userId
 * @returns {Promise<void>}
 */
exports.deleteResolution = async (id, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await Resolution.findById(id);
    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      const err = new Error('Resolution not found');
      err.status = 404;
      throw err;
    }

    await Resolution.deleteWorkflow(client, id);
    await Resolution.deleteApprovals(client, id);
    await client.query('DELETE FROM resolutions WHERE id = $1', [id]);
    await AuditLog.create(client, userId, 'RESOLUTION_DELETE', `Resolution "${existing.rows[0].title}" deleted`);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Change the status of a resolution.
 * @param {string|number} id
 * @param {string} status
 * @returns {Promise<object>}
 */
exports.changeStatus = async (id, status, user) => {
  if (!VALID_STATUSES.includes(status)) {
    const err = new Error('Invalid status');
    err.status = 400;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await Resolution.findById(id);
    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      const err = new Error('Resolution not found');
      err.status = 404;
      throw err;
    }

    if (user?.role === 'Secretary' && existing.rows[0].status === 'Draft' && status === 'Submitted') {
      await client.query('ROLLBACK');
      const err = new Error('Secretary is not allowed to submit draft resolutions as proposed measures');
      err.status = 403;
      throw err;
    }

    const result = await client.query(
      'UPDATE resolutions SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, id]
    );
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      const err = new Error('Resolution not found');
      err.status = 404;
      throw err;
    }

    const resolution = result.rows[0];
    await Resolution.insertWorkflowAction(client, id, 'STATUS_CHANGE', status, user?.id, '');

    if (status === 'Submitted') await Resolution.setReadingStage(client, id, 'SUBMITTED', 'Submitted');
    if (status === 'Approved') await Resolution.setApprovedDate(client, id);
    if (status === 'Published') await Resolution.setPublishedDate(client, id);

    await AuditLog.create(client, user?.id, 'STATUS_CHANGE', `Resolution status changed to "${status}"`);

    const io = getIO();
    io.emit('resolutionStatusChanged', resolution);

    await client.query('COMMIT');
    return resolution;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ─── Workflow helpers ─────────────────────────────────────────────────────────

/**
 * Get workflow data for a resolution.
 */
exports.getWorkflow = async (id) => {
  const result = await Resolution.findWorkflow(id);
  return { actions: result.rows };
};

/**
 * Get workflow history for a resolution.
 */
exports.getHistory = async (id) => {
  const result = await Resolution.findHistory(id);
  return result.rows;
};

/**
 * Get approvals for a resolution.
 */
exports.getApprovals = async (id) => {
  const result = await Resolution.findApprovals(id);
  return result.rows;
};

/**
 * Perform a workflow action on a resolution.
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

    const resResult = await Resolution.findById(id);
    if (resResult.rows.length === 0) {
      await client.query('ROLLBACK');
      const err = new Error('Resolution not found');
      err.status = 404;
      throw err;
    }

    const resolution = resResult.rows[0];
    const newStatus = validActions[action];

    if (userRole === 'Secretary' && resolution.status === 'Draft' && newStatus === 'Submitted') {
      await client.query('ROLLBACK');
      const err = new Error('Secretary is not allowed to submit draft resolutions as proposed measures');
      err.status = 403;
      throw err;
    }

    const updatedRes = await client.query(
      'UPDATE resolutions SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
      [newStatus, id]
    );
    const workflowResult = await Resolution.insertWorkflowAction(
      client, id, action.toUpperCase(), newStatus, userId, comment || ''
    );

    if (newStatus === 'Approved') await Resolution.setApprovedDate(client, id);
    if (newStatus === 'Published') await Resolution.setPublishedDate(client, id);

    await AuditLog.create(client, userId, `WORKFLOW_${action.toUpperCase()}`, `Action: ${action} on resolution "${resolution.title}"`);

    const actionMessages = {
      submit: 'submitted for review',
      approve: 'approved',
      reject: 'rejected',
      request_changes: 'requested changes for',
      publish: 'published',
      archive: 'archived',
    };
    await createNotification(resolution.proposer_id, `Your resolution "${resolution.title}" has been ${actionMessages[action]}.`);

    const workflowHistory = await Resolution.findWorkflow(id);
    const approvals = await Resolution.findApprovals(id);

    const io = getIO();
    io.emit('resolutionWorkflowUpdated', {
      resolution: updatedRes.rows[0],
      action,
      workflow: workflowResult.rows[0],
    });

    await client.query('COMMIT');
    return {
      resolution: updatedRes.rows[0],
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
 * Create an approval record for a resolution.
 */
exports.createApproval = async (resolutionId, { approver_role, approver_id, notes }) => {
  const result = await Resolution.createApproval(resolutionId, approver_role, approver_id, notes);
  return result.rows[0];
};

/**
 * Update an approval record.
 */
exports.updateApproval = async (approvalId, resolutionId, status, notes) => {
  const result = await Resolution.updateApproval(approvalId, resolutionId, status, notes);
  if (result.rows.length === 0) {
    const err = new Error('Approval not found');
    err.status = 404;
    throw err;
  }
  return result.rows[0];
};

// ─── Three-Readings Legislative Workflow ─────────────────────────────────────

/**
 * Stage 1: Councilor submits proposed measure to Vice Mayor.
 * Transitions: Draft → SUBMITTED
 */
exports.submitToViceMayor = async (id, comment, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await Resolution.findById(id);
    if (!existing.rows.length) { await client.query('ROLLBACK'); const e = new Error('Resolution not found'); e.status = 404; throw e; }
    const resolution = existing.rows[0];
    if (resolution.reading_stage && resolution.reading_stage !== 'SUBMITTED') {
      await client.query('ROLLBACK');
      const e = new Error('Resolution has already been submitted'); e.status = 400; throw e;
    }

    const updated = await Resolution.setReadingStage(client, id, 'SUBMITTED', 'Submitted');
    await Resolution.insertWorkflowAction(client, id, 'SUBMIT_TO_VICE_MAYOR', 'SUBMITTED', userId, comment || '');
    await AuditLog.create(client, userId, 'LEGISLATIVE_SUBMIT', `Resolution "${resolution.title}" submitted to Vice Mayor`);
    await createNotification(userId, `Resolution "${resolution.title}" submitted to Vice Mayor.`);
    const io = getIO();
    io.to('Secretary').emit('resolutionSubmitted', updated.rows[0]);

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

    const existing = await Resolution.findById(id);
    if (!existing.rows.length) { await client.query('ROLLBACK'); const e = new Error('Resolution not found'); e.status = 404; throw e; }
    const resolution = existing.rows[0];
    if (resolution.reading_stage !== 'SUBMITTED') {
      await client.query('ROLLBACK');
      const e = new Error('First Reading requires resolution to be in SUBMITTED stage'); e.status = 400; throw e;
    }

    await client.query(
      `UPDATE resolutions SET session_id_first_reading=$1, reading_stage='FIRST_READING', status='Under Review', updated_at=NOW() WHERE id=$2`,
      [sessionId || null, id]
    );
    const updated = await client.query('SELECT * FROM resolutions WHERE id=$1', [id]);
    await Resolution.insertReadingSession(client, id, sessionId, 1, discussionNotes, presidingOfficer);
    await Resolution.insertWorkflowAction(client, id, 'FIRST_READING', 'FIRST_READING', userId, discussionNotes || '');
    await AuditLog.create(client, userId, 'FIRST_READING', `First reading conducted for "${resolution.title}"`);
    await createNotification(resolution.proposer_id, `First reading conducted for your resolution "${resolution.title}".`);
    const io = getIO();
    io.emit('resolutionFirstReading', updated.rows[0]);

    await client.query('COMMIT');
    return updated.rows[0];
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
};

/**
 * Stage 3: Assign resolution to a committee.
 * Transitions: FIRST_READING → COMMITTEE_REVIEW
 */
exports.assignCommittee = async (id, committeeId, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await Resolution.findById(id);
    if (!existing.rows.length) { await client.query('ROLLBACK'); const e = new Error('Resolution not found'); e.status = 404; throw e; }
    const resolution = existing.rows[0];
    const stage = (resolution.reading_stage || '').toUpperCase();
    if (stage !== 'FIRST_READING') {
      await client.query('ROLLBACK');
      const e = new Error('Committee assignment requires resolution to be in FIRST_READING stage'); e.status = 400; throw e;
    }

    const updated = await Resolution.assignCommittee(client, id, committeeId, userId, 'COMMITTEE_REVIEW');
    await Resolution.insertWorkflowAction(client, id, 'ASSIGN_COMMITTEE', 'COMMITTEE_REVIEW', userId, `Assigned to committee ${committeeId}`);
    await AuditLog.create(client, userId, 'COMMITTEE_ASSIGNED', `Committee ${committeeId} assigned to "${resolution.title}"`);
    await createNotification(resolution.proposer_id, `Your resolution "${resolution.title}" has been assigned to a committee.`);
    const io = getIO();
    io.emit('resolutionCommitteeAssigned', updated.rows[0]);

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

    const existing = await Resolution.findById(id);
    if (!existing.rows.length) { await client.query('ROLLBACK'); const e = new Error('Resolution not found'); e.status = 404; throw e; }
    const resolution = existing.rows[0];
    if (!['COMMITTEE_REVIEW', 'COMMITTEE_REPORT_SUBMITTED'].includes(resolution.reading_stage)) {
      await client.query('ROLLBACK');
      const e = new Error('Committee report requires resolution to be in COMMITTEE_REVIEW or COMMITTEE_REPORT_SUBMITTED stage'); e.status = 400; throw e;
    }

    const committeeId = reportData.committee_id || resolution.committee_id;
    const roleRes = await client.query(
      `SELECT id, role FROM committee_members WHERE committee_id=$1 AND user_id=$2 AND role IN ('Chair', 'Committee Secretary')`,
      [committeeId, userId]
    );
    if (!roleRes.rows.length) {
      await client.query('ROLLBACK');
      const e = new Error('Only the committee chair or committee secretary can submit the committee report'); e.status = 403; throw e;
    }

    const report = await Resolution.insertCommitteeReport(client, {
      resolutionId: id,
      committeeId,
      submittedBy: userId,
      recommendation: reportData.recommendation,
      reportContent: reportData.report_content,
      meetingDate: reportData.meeting_date,
      meetingMinutes: reportData.meeting_minutes,
      attendees: reportData.attendees,
    });

    await client.query(
      `UPDATE resolutions SET committee_report_id=$1, reading_stage='COMMITTEE_REPORT_SUBMITTED', updated_at=NOW() WHERE id=$2`,
      [report.rows[0].id, id]
    );
    const updated = await client.query('SELECT * FROM resolutions WHERE id=$1', [id]);
    await Resolution.insertWorkflowAction(client, id, 'COMMITTEE_REPORT', 'COMMITTEE_REPORT_SUBMITTED', userId, `Recommendation: ${reportData.recommendation}`);
    await AuditLog.create(client, userId, 'COMMITTEE_REPORT_SUBMITTED', `Committee report submitted for "${resolution.title}"`);
    await createNotification(resolution.proposer_id, `Committee report submitted for your resolution "${resolution.title}". Recommendation: ${reportData.recommendation}`);

    const usersRes = await client.query(`SELECT u.id, r.role_name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE r.role_name IN ('Secretary', 'Admin')`);
    for (const u of usersRes.rows) {
      await createNotification(u.id, `Committee report was submitted for resolution "${resolution.title}". Recommendation: ${reportData.recommendation}`);
    }

    const io = getIO();
    io.to('Secretary').emit('resolutionCommitteeReportSubmitted', { resolution: updated.rows[0], report: report.rows[0] });

    await client.query('COMMIT');
    return { resolution: updated.rows[0], report: report.rows[0] };
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

    const existing = await Resolution.findById(id);
    if (!existing.rows.length) { await client.query('ROLLBACK'); const e = new Error('Resolution not found'); e.status = 404; throw e; }
    const resolution = existing.rows[0];
    if (resolution.reading_stage !== 'COMMITTEE_REPORT_SUBMITTED') {
      await client.query('ROLLBACK');
      const e = new Error('Second Reading requires resolution to be in COMMITTEE_REPORT_SUBMITTED stage'); e.status = 400; throw e;
    }

    await client.query(
      `UPDATE resolutions SET session_id_second_reading=$1, reading_stage='SECOND_READING', updated_at=NOW() WHERE id=$2`,
      [sessionId || null, id]
    );
    const updated = await client.query('SELECT * FROM resolutions WHERE id=$1', [id]);
    await Resolution.insertReadingSession(client, id, sessionId, 2, discussionNotes, presidingOfficer);
    await Resolution.insertWorkflowAction(client, id, 'SECOND_READING', 'SECOND_READING', userId, discussionNotes || '');
    await AuditLog.create(client, userId, 'SECOND_READING', `Second reading conducted for "${resolution.title}"`);
    await createNotification(resolution.proposer_id, `Second reading conducted for your resolution "${resolution.title}".`);
    const io = getIO();
    io.emit('resolutionSecondReading', updated.rows[0]);

    await client.query('COMMIT');
    return updated.rows[0];
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
};

/**
 * Stage 6a: Open electronic voting for third reading.
 * Transitions: SECOND_READING → THIRD_READING_VOTING
 */
exports.openThirdReadingVote = async (id, sessionId, presidingOfficer, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await Resolution.findById(id);
    if (!existing.rows.length) { await client.query('ROLLBACK'); const e = new Error('Resolution not found'); e.status = 404; throw e; }
    const resolution = existing.rows[0];
    if (resolution.reading_stage !== 'SECOND_READING') {
      await client.query('ROLLBACK');
      const e = new Error('Opening voting requires resolution to be in SECOND_READING stage'); e.status = 400; throw e;
    }

    const existingSession = await client.query(
      `SELECT id FROM voting_sessions WHERE resolution_id = $1 AND status = 'active'`, [id]
    );
    if (existingSession.rows.length) {
      await client.query('ROLLBACK');
      const e = new Error('There is already an active voting session for this resolution'); e.status = 400; throw e;
    }

    const vsRes = await client.query(
      `INSERT INTO voting_sessions (title, description, resolution_id, question, voting_type, created_by, status, created_at)
       VALUES ($1, $2, $3, $4, 'yes_no_abstain', $5, 'active', NOW()) RETURNING *`,
      [
        `Third Reading Vote: ${resolution.title}`,
        `Electronic voting for the third reading of "${resolution.title}"`,
        id,
        `Do you approve the proposed resolution "${resolution.title}"?`,
        userId
      ]
    );
    const votingSession = vsRes.rows[0];

    await client.query(
      `UPDATE resolutions SET reading_stage='THIRD_READING_VOTING', session_id_third_reading=$1, updated_at=NOW() WHERE id=$2`,
      [sessionId || null, id]
    );
    const updated = await client.query('SELECT * FROM resolutions WHERE id=$1', [id]);

    await Resolution.insertWorkflowAction(client, id, 'OPEN_THIRD_READING_VOTE', 'THIRD_READING_VOTING', userId,
      `Electronic voting opened. Session: ${votingSession.id}`);
    await AuditLog.create(client, userId, 'OPEN_THIRD_READING_VOTE', `Third reading voting opened for "${resolution.title}"`);

    const councilors = await client.query(
      `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.role_name = 'Councilor'`
    );
    for (const c of councilors.rows) {
      await createNotification(c.id, `Voting is now open for resolution "${resolution.title}". Please cast your vote.`);
    }

    const io = getIO();
    io.emit('resolutionThirdReadingVoteOpened', { resolution: updated.rows[0], votingSession });

    await client.query('COMMIT');
    return { resolution: updated.rows[0], votingSession };
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
};

/**
 * Stage 6b: Councilor casts their vote in the third reading.
 */
exports.castThirdReadingVote = async (resolutionId, voteOption, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await Resolution.findById(resolutionId);
    if (!existing.rows.length) { await client.query('ROLLBACK'); const e = new Error('Resolution not found'); e.status = 404; throw e; }
    const resolution = existing.rows[0];
    if (resolution.reading_stage !== 'THIRD_READING_VOTING') {
      await client.query('ROLLBACK');
      const e = new Error('Voting is not currently open for this resolution'); e.status = 400; throw e;
    }

    const vsRes = await client.query(
      `SELECT * FROM voting_sessions WHERE resolution_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1`, [resolutionId]
    );
    if (!vsRes.rows.length) {
      await client.query('ROLLBACK');
      const e = new Error('No active voting session found'); e.status = 400; throw e;
    }
    const session = vsRes.rows[0];

    const allowed = ['Yes', 'No', 'Abstain'];
    if (!allowed.includes(voteOption)) {
      await client.query('ROLLBACK');
      const e = new Error(`Invalid vote option. Allowed: ${allowed.join(', ')}`); e.status = 400; throw e;
    }

    const existingVote = await client.query(
      'SELECT id FROM votes WHERE session_id = $1 AND user_id = $2', [session.id, userId]
    );
    if (existingVote.rows.length) {
      await client.query('ROLLBACK');
      const e = new Error('You have already cast your vote'); e.status = 400; throw e;
    }

    await client.query(
      `INSERT INTO votes (session_id, user_id, vote_option, voted_at) VALUES ($1, $2, $3, NOW()) RETURNING *`,
      [session.id, userId, voteOption]
    );
    await AuditLog.create(client, userId, 'CAST_VOTE', `Voted "${voteOption}" on resolution "${resolution.title}"`);

    const results = await client.query(
      `SELECT vote_option, COUNT(*)::int as count FROM votes WHERE session_id = $1 GROUP BY vote_option`, [session.id]
    );
    const totalVotes = await client.query(
      'SELECT COUNT(*)::int as total FROM votes WHERE session_id = $1', [session.id]
    );
    const totalCouncilors = await client.query(
      `SELECT COUNT(*)::int as total FROM users u JOIN roles r ON r.id = u.role_id WHERE r.role_name = 'Councilor'`
    );

    const io = getIO();
    io.emit('resolutionThirdReadingVoteCast', {
      resolution_id: resolutionId,
      voting_session_id: session.id,
      results: results.rows,
      totalVotes: totalVotes.rows[0].total,
      totalCouncilors: totalCouncilors.rows[0].total,
    });

    await client.query('COMMIT');
    return {
      results: results.rows,
      totalVotes: totalVotes.rows[0].total,
      totalCouncilors: totalCouncilors.rows[0].total,
    };
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
};

/**
 * Get current voting status for a resolution's third reading.
 */
exports.getThirdReadingVotingStatus = async (resolutionId, userId) => {
  const vsRes = await pool.query(
    `SELECT * FROM voting_sessions WHERE resolution_id = $1 ORDER BY created_at DESC LIMIT 1`, [resolutionId]
  );
  if (!vsRes.rows.length) return { votingSession: null, results: [], userVote: null, totalVotes: 0, totalCouncilors: 0, voters: [] };
  const session = vsRes.rows[0];

  const [results, userVote, totalVotes, totalCouncilors, voters] = await Promise.all([
    pool.query(`SELECT vote_option, COUNT(*)::int as count FROM votes WHERE session_id = $1 GROUP BY vote_option`, [session.id]),
    pool.query('SELECT vote_option FROM votes WHERE session_id = $1 AND user_id = $2', [session.id, userId]),
    pool.query('SELECT COUNT(*)::int as total FROM votes WHERE session_id = $1', [session.id]),
    pool.query(`SELECT COUNT(*)::int as total FROM users u JOIN roles r ON r.id = u.role_id WHERE r.role_name = 'Councilor'`),
    pool.query(
      `SELECT u.id, u.name, v.vote_option, v.voted_at FROM votes v JOIN users u ON u.id = v.user_id WHERE v.session_id = $1 ORDER BY v.voted_at`,
      [session.id]
    ),
  ]);

  return {
    votingSession: session,
    results: results.rows,
    userVote: userVote.rows[0]?.vote_option || null,
    totalVotes: totalVotes.rows[0].total,
    totalCouncilors: totalCouncilors.rows[0].total,
    voters: voters.rows,
  };
};

/**
 * Stage 6c: Close electronic voting and record the result.
 * Transitions: THIRD_READING_VOTING → THIRD_READING_VOTED (or REJECTED)
 */
exports.closeThirdReadingVote = async (id, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await Resolution.findById(id);
    if (!existing.rows.length) { await client.query('ROLLBACK'); const e = new Error('Resolution not found'); e.status = 404; throw e; }
    const resolution = existing.rows[0];
    if (resolution.reading_stage !== 'THIRD_READING_VOTING') {
      await client.query('ROLLBACK');
      const e = new Error('Closing voting requires resolution to be in THIRD_READING_VOTING stage'); e.status = 400; throw e;
    }

    const vsRes = await client.query(
      `SELECT * FROM voting_sessions WHERE resolution_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1`, [id]
    );
    if (!vsRes.rows.length) {
      await client.query('ROLLBACK');
      const e = new Error('No active voting session found'); e.status = 400; throw e;
    }
    const session = vsRes.rows[0];

    await client.query(`UPDATE voting_sessions SET status = 'closed', closed_at = NOW() WHERE id = $1`, [session.id]);

    const results = await client.query(
      `SELECT vote_option, COUNT(*)::int as count FROM votes WHERE session_id = $1 GROUP BY vote_option`, [session.id]
    );
    let yesCount = 0, noCount = 0, abstainCount = 0;
    for (const r of results.rows) {
      if (r.vote_option === 'Yes') yesCount = r.count;
      else if (r.vote_option === 'No') noCount = r.count;
      else if (r.vote_option === 'Abstain') abstainCount = r.count;
    }

    const passed = yesCount > noCount;
    const votingResults = { yes_count: yesCount, no_count: noCount, abstain_count: abstainCount, passed, passed_at: new Date() };

    const sessionId = resolution.session_id_third_reading;
    if (passed) {
      await Resolution.recordVote(client, id, votingResults, sessionId);
    } else {
      await client.query(
        `UPDATE resolutions SET voting_results=$1, voted_at=NOW(),
         reading_stage='REJECTED', status='Rejected', updated_at=NOW() WHERE id=$2`,
        [JSON.stringify(votingResults), id]
      );
    }
    const updated = await client.query('SELECT * FROM resolutions WHERE id=$1', [id]);

    await Resolution.insertReadingSession(client, id, sessionId, 3, `Yes:${yesCount} No:${noCount} Abstain:${abstainCount}`, null);
    await Resolution.insertWorkflowAction(client, id, 'CLOSE_THIRD_READING_VOTE', passed ? 'THIRD_READING_VOTED' : 'REJECTED', userId,
      `Yes:${yesCount} No:${noCount} Abstain:${abstainCount} — ${passed ? 'PASSED' : 'FAILED'}`);
    await AuditLog.create(client, userId, 'CLOSE_THIRD_READING_VOTE', `Third reading vote for "${resolution.title}": ${passed ? 'Passed' : 'Failed'}`);
    await createNotification(resolution.proposer_id,
      `Third reading vote for your resolution "${resolution.title}" ${passed ? 'PASSED' : 'FAILED'} (Yes:${yesCount} No:${noCount} Abstain:${abstainCount}).`);

    const io = getIO();
    io.emit('resolutionThirdReadingVoteClosed', { resolution: updated.rows[0], passed, votingResults });

    await client.query('COMMIT');
    return { resolution: updated.rows[0], passed, votingResults };
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
};

/**
 * Stage 7a: Executive approval.
 * Transitions: THIRD_READING_VOTED → APPROVED
 */
exports.executiveApproval = async (id, approvedBy, remarks, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await Resolution.findById(id);
    if (!existing.rows.length) { await client.query('ROLLBACK'); const e = new Error('Resolution not found'); e.status = 404; throw e; }
    const resolution = existing.rows[0];
    if (resolution.reading_stage !== 'THIRD_READING_VOTED') {
      await client.query('ROLLBACK');
      const e = new Error('Executive approval requires resolution to be in THIRD_READING_VOTED stage'); e.status = 400; throw e;
    }

    const updated = await Resolution.recordApproval(client, id, approvedBy || userId, remarks);
    await Resolution.insertWorkflowAction(client, id, 'EXECUTIVE_APPROVAL', 'APPROVED', userId, remarks || '');
    await AuditLog.create(client, userId, 'EXECUTIVE_APPROVAL', `Resolution "${resolution.title}" approved by executive`);
    await createNotification(resolution.proposer_id, `Your resolution "${resolution.title}" has been approved by the executive!`);
    const io = getIO();
    io.emit('resolutionExecutiveApproval', updated.rows[0]);

    await client.query('COMMIT');
    return updated.rows[0];
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
};

/**
 * Stage 7b: Executive rejection.
 * Transitions: THIRD_READING_VOTED → REJECTED
 */
exports.executiveRejection = async (id, rejectedBy, reason, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await Resolution.findById(id);
    if (!existing.rows.length) { await client.query('ROLLBACK'); const e = new Error('Resolution not found'); e.status = 404; throw e; }
    const resolution = existing.rows[0];
    if (resolution.reading_stage !== 'THIRD_READING_VOTED') {
      await client.query('ROLLBACK');
      const e = new Error('Executive rejection requires resolution to be in THIRD_READING_VOTED stage'); e.status = 400; throw e;
    }

    const updated = await Resolution.recordRejection(client, id, rejectedBy || userId, reason);
    await Resolution.insertWorkflowAction(client, id, 'EXECUTIVE_REJECTION', 'REJECTED', userId, reason || '');
    await AuditLog.create(client, userId, 'EXECUTIVE_REJECTION', `Resolution "${resolution.title}" rejected by executive`);
    await createNotification(resolution.proposer_id, `Your resolution "${resolution.title}" has been rejected by the executive. Reason: ${reason}`);
    const io = getIO();
    io.emit('resolutionExecutiveRejection', updated.rows[0]);

    await client.query('COMMIT');
    return updated.rows[0];
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
};

/**
 * Stage 8a: Post resolution publicly.
 * Transitions: APPROVED → POSTED
 */
exports.postPublicly = async (id, postingDurationDays, postingLocation, notes, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await Resolution.findById(id);
    if (!existing.rows.length) { await client.query('ROLLBACK'); const e = new Error('Resolution not found'); e.status = 404; throw e; }
    const resolution = existing.rows[0];
    if (resolution.reading_stage !== 'APPROVED') {
      await client.query('ROLLBACK');
      const e = new Error('Public posting requires resolution to be in APPROVED stage'); e.status = 400; throw e;
    }

    const days = postingDurationDays || 3;
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);
    const postingEndDate = endDate.toISOString().split('T')[0];

    const updated = await Resolution.recordPosting(client, id, postingEndDate);
    await Resolution.insertPostingRecord(client, {
      resolutionId: id, postedBy: userId,
      postingDurationDays: days, postingLocation,
      effectiveDate: postingEndDate, notes,
    });
    await Resolution.insertWorkflowAction(client, id, 'POST_PUBLICLY', 'POSTED', userId, `Posted for ${days} days at: ${postingLocation || 'N/A'}`);
    await AuditLog.create(client, userId, 'RESOLUTION_POSTED', `Resolution "${resolution.title}" posted publicly`);
    const io = getIO();
    io.emit('resolutionPosted', updated.rows[0]);

    await client.query('COMMIT');
    return updated.rows[0];
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
};

/**
 * Stage 8b: Mark resolution as effective after posting period.
 * Transitions: POSTED → EFFECTIVE
 */
exports.markEffective = async (id, effectiveDate, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await Resolution.findById(id);
    if (!existing.rows.length) { await client.query('ROLLBACK'); const e = new Error('Resolution not found'); e.status = 404; throw e; }
    const resolution = existing.rows[0];
    if (resolution.reading_stage !== 'POSTED') {
      await client.query('ROLLBACK');
      const e = new Error('Mark effective requires resolution to be in POSTED stage'); e.status = 400; throw e;
    }

    const effDate = effectiveDate || new Date().toISOString().split('T')[0];
    const updated = await Resolution.recordEffective(client, id, effDate);
    await Resolution.insertWorkflowAction(client, id, 'MARK_EFFECTIVE', 'EFFECTIVE', userId, `Effective date: ${effDate}`);
    await AuditLog.create(client, userId, 'RESOLUTION_EFFECTIVE', `Resolution "${resolution.title}" is now effective`);
    await createNotification(resolution.proposer_id, `Your resolution "${resolution.title}" is now in effect!`);
    const io = getIO();
    io.emit('resolutionEffective', updated.rows[0]);

    await client.query('COMMIT');
    return updated.rows[0];
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
};

/**
 * Get complete workflow status.
 */
exports.getWorkflowStatus = async (id) => {
  const [resolutionRes, readings, history] = await Promise.all([
    Resolution.findById(id),
    Resolution.findReadingSessions(id),
    Resolution.findHistory(id),
  ]);

  if (!resolutionRes.rows.length) {
    const e = new Error('Resolution not found'); e.status = 404; throw e;
  }

  const res = resolutionRes.rows[0];
  let committeeReport = null;
  let postingRecords = [];

  // Fetch committee with members
  let committee = undefined;
  if (res.committee_id) {
    const { getCommitteeWithMembers } = require('../utils/committeesHelper');
    committee = await getCommitteeWithMembers(res.committee_id);
  }
  res.committee = committee;

  if (res.committee_report_id) {
    const rpt = await Resolution.findCommitteeReport(id);
    committeeReport = rpt.rows[0] || null;
  }

  const posting = await Resolution.findPostingRecords(id);
  postingRecords = posting.rows;

  return {
    resolution: res,
    readings: readings.rows,
    committeeReport,
    postingRecords,
    history: history.rows,
  };
};

/**
 * Get committee report for a resolution.
 */
exports.getCommitteeReport = async (id) => {
  const result = await Resolution.findCommitteeReport(id);
  return result.rows[0] || null;
};

/**
 * Get all sessions a resolution is scheduled in.
 */
exports.getResolutionSessions = async (resolutionId) => {
  const result = await Resolution.findSessionsByResolution(resolutionId);
  return result.rows;
};
