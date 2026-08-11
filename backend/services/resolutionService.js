/**
 * Resolution Service - Business logic for resolution operations.
 */
const pool = require('../db');
const Resolution = require('../models/Resolution');
const SessionRecording = require('../models/SessionRecording');
const AuditLog = require('../models/AuditLog');
const { createNotification } = require('../utils/notifications');
const { getIO } = require('../socket');

const VALID_STATUSES = ['Draft', 'Submitted', 'Under Review', 'Approved', 'Published', 'Rejected'];

function isBlankInput(value) {
  return value === null || (typeof value === 'string' && value.trim() === '');
}

function isCouncilorRole(role) {
  return String(role || '').trim().toLowerCase() === 'councilor';
}

function normalizeRoleName(role) {
  return String(role || '').trim().toLowerCase();
}

function canAssignPrimaryAuthor(role) {
  const normalizedRole = normalizeRoleName(role);
  return normalizedRole === 'admin'
    || normalizedRole === 'secretary'
    || normalizedRole === 'committee secretary';
}

function canBypassWorkflowForLegacy(role) {
  const normalizedRole = normalizeRoleName(role);
  return normalizedRole === 'admin'
    || normalizedRole === 'secretary'
    || normalizedRole === 'committee secretary';
}

async function resolveResolutionProposer(data, user) {
  const creatorRole = normalizeRoleName(user?.role);

  // Councilors always become the author/proponent of measures they create.
  if (isCouncilorRole(creatorRole)) {
    return {
      id: Number(user?.id),
      name: String(user?.name || '').trim(),
    };
  }

  if (!canAssignPrimaryAuthor(creatorRole)) {
    return {
      id: Number(user?.id),
      name: String(user?.name || '').trim(),
    };
  }

  const requestedProposerId = Number(data?.proposer_id);
  if (!Number.isInteger(requestedProposerId) || requestedProposerId <= 0) {
    const err = new Error('Primary author is required and must be a valid Councilor');
    err.status = 400;
    throw err;
  }

  const proposerResult = await pool.query(
    `SELECT u.id, u.name, r.role_name
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1`,
    [requestedProposerId]
  );

  if (proposerResult.rows.length === 0) {
    const err = new Error('Selected primary author does not exist');
    err.status = 400;
    throw err;
  }

  const proposer = proposerResult.rows[0];
  if (normalizeRoleName(proposer.role_name) !== 'councilor') {
    const err = new Error('Primary author must be a user with Councilor role');
    err.status = 400;
    throw err;
  }

  return {
    id: Number(proposer.id),
    name: String(proposer.name || '').trim(),
  };
}

function normalizeAttendeesValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }

  if (typeof value !== 'string') {
    return [];
  }

  const text = value.trim();
  if (!text) {
    return [];
  }

  if (text.startsWith('[') && text.endsWith(']')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item || '').trim()).filter(Boolean);
      }
    } catch {
      // Fallback to comma-separated parsing below.
    }
  }

  return text.split(',').map((item) => item.trim()).filter(Boolean);
}

async function getLatestEndedCommitteeMeetingForResolution(client, resolutionId, committeeId) {
  const result = await client.query(
    `SELECT cm.meeting_date,
            cm.recording_url,
            COALESCE(
              NULLIF(TRIM(
                CASE
                  WHEN jsonb_typeof(minutes.attendees_json) = 'array' THEN (
                    SELECT string_agg(value, ', ')
                    FROM jsonb_array_elements_text(minutes.attendees_json) AS value
                  )
                  ELSE NULL
                END
              ), ''),
              NULLIF(TRIM(minutes.attendees), ''),
              NULLIF(TRIM(minutes.participants), ''),
              NULLIF(TRIM(committee_members.member_names), '')
            ) AS meeting_attendees
     FROM committee_meetings cm
     LEFT JOIN committee_minutes minutes ON minutes.id = cm.minutes_id
     LEFT JOIN LATERAL (
       SELECT string_agg(u.name, ', ' ORDER BY u.name) AS member_names
       FROM committee_members cmm
       JOIN users u ON u.id = cmm.user_id
       WHERE cmm.committee_id = cm.committee_id
     ) AS committee_members ON TRUE
     WHERE cm.resolution_id = $1
       AND cm.committee_id = $2
       AND cm.ended = TRUE
     ORDER BY cm.meeting_date DESC, cm.updated_at DESC, cm.created_at DESC
     LIMIT 1`,
    [resolutionId, committeeId]
  );

  return result.rows[0] || null;
}

function appendMeetingRecordingLine(reportContent, recordingUrl) {
  const normalizedUrl = String(recordingUrl || '').trim();
  const normalizedContent = String(reportContent || '').trim();

  if (!normalizedUrl) {
    return normalizedContent;
  }

  if (normalizedContent.includes(normalizedUrl)) {
    return normalizedContent;
  }

  const recordingLine = `Meeting recording: ${normalizedUrl}`;
  return normalizedContent ? `${normalizedContent}\n\n${recordingLine}` : recordingLine;
}

function normalizeLinkedRecordingUrl(recordingUrl) {
  const value = String(recordingUrl || '').trim();
  if (!value) {
    return '';
  }

  if (/^https?:\/\//i.test(value) || value.startsWith('/uploads/')) {
    return value;
  }

  return '';
}

function parseBooleanInput(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  return false;
}

function buildReadingNotesWithRecording(discussionNotes, recordingUrl) {
  const normalizedNotes = String(discussionNotes || '').trim();
  const normalizedRecordingUrl = normalizeLinkedRecordingUrl(recordingUrl);

  if (!normalizedRecordingUrl) {
    return normalizedNotes;
  }

  if (normalizedNotes.includes(normalizedRecordingUrl)) {
    return normalizedNotes;
  }

  const recordingLine = `Session recording: ${normalizedRecordingUrl}`;
  return normalizedNotes ? `${recordingLine}\n\n${normalizedNotes}` : recordingLine;
}

async function notifyUrgentActionByRoles(clientOrPool, roleNames, message, options = {}) {
  const normalizedRoles = Array.isArray(roleNames)
    ? [...new Set(roleNames.map((role) => String(role || '').trim()).filter(Boolean))]
    : [];

  if (!normalizedRoles.length) {
    return;
  }

  const source = clientOrPool || pool;
  const usersRes = await source.query(
    `SELECT DISTINCT u.id
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE r.role_name = ANY($1::text[])`,
    [normalizedRoles]
  );

  for (const row of usersRes.rows) {
    await createNotification(row.id, message, options);
  }
}

async function autoPostLegacyResolutionIfNeeded(resolution, payload, actorUser) {
  const isLegacyImport = parseBooleanInput(payload?.is_legacy_import);
  const autoPostPublicly = parseBooleanInput(payload?.auto_post_publicly);

  if (!isLegacyImport || !autoPostPublicly) {
    return resolution;
  }

  const postingDaysRaw = Number(payload?.posting_duration_days);
  const postingDurationDays = Number.isInteger(postingDaysRaw) && postingDaysRaw > 0
    ? postingDaysRaw
    : 3;
  const postingLocation = String(payload?.posting_location || '').trim();
  const approvalRemarks = String(payload?.approval_remarks || payload?.remarks || '').trim();
  const approvedByCandidate = Number(payload?.approved_by);
  const approvedBy = Number.isInteger(approvedByCandidate) && approvedByCandidate > 0
    ? approvedByCandidate
    : actorUser.id;

  const endDate = new Date();
  endDate.setDate(endDate.getDate() + postingDurationDays);
  const postingEndDate = endDate.toISOString().split('T')[0];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await Resolution.recordApproval(
      client,
      resolution.id,
      approvedBy,
      approvalRemarks || 'Legacy resolution import approved during electronic encoding.'
    );

    const postedResult = await Resolution.recordPosting(client, resolution.id, postingEndDate);

    await Resolution.insertPostingRecord(client, {
      resolutionId: resolution.id,
      postedBy: actorUser.id,
      postingDurationDays,
      postingLocation,
      effectiveDate: postingEndDate,
      notes: String(payload?.posting_notes || payload?.notes || '').trim() || 'Auto-posted from legacy resolution import.',
    });

    await Resolution.insertWorkflowAction(
      client,
      resolution.id,
      'LEGACY_IMPORT_APPROVAL',
      'APPROVED',
      actorUser.id,
      'Legacy resolution import auto-approved for public posting.'
    );
    await Resolution.insertWorkflowAction(
      client,
      resolution.id,
      'POST_PUBLICLY',
      'POSTED',
      actorUser.id,
      `Legacy resolution import auto-posted publicly for ${postingDurationDays} day(s) at: ${postingLocation || 'N/A'}`
    );

    await AuditLog.create(
      client,
      actorUser.id,
      'RESOLUTION_LEGACY_AUTO_POSTED',
      `Legacy resolution "${resolution.title}" was auto-posted publicly after import.`
    );
    await createNotification(
      resolution.proposer_id,
      `Your legacy resolution "${resolution.title}" was auto-posted publicly after electronic import.`
    );

    await client.query('COMMIT');
    return postedResult.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

const ADMIN_STAGE_SEQUENCE = [
  'DRAFT',
  'SUBMITTED',
  'RECORD_SESSION',
  'FIRST_READING',
  'COMMITTEE_REVIEW',
  'COMMITTEE_REPORT_SUBMITTED',
  'ASSIGN_SECOND_SESSION',
  'RECORD_SECOND_SESSION',
  'SECOND_READING',
  'THIRD_READING_VOTING',
  'THIRD_READING_VOTED',
  'APPROVED',
  'POSTED',
  'EFFECTIVE',
];

function normalizeReadingStage(stage) {
  return String(stage || 'DRAFT').trim().toUpperCase();
}

function resolveStatusForStage(stage) {
  if (stage === 'DRAFT') return 'Draft';
  if (stage === 'SUBMITTED') return 'Submitted';
  return 'Under Review';
}

async function generateNextResolutionNumber() {
  const year = new Date().getFullYear();
  const extractPattern = `^RES-${year}-(\\d+)$`;
  const matchPattern = `^RES-${year}-\\d+$`;

  const { rows } = await pool.query(
    `SELECT COALESCE(MAX((regexp_match(resolution_number, $1))[1]::int), 0) + 1 AS next_seq
     FROM resolutions
     WHERE resolution_number ~ $2`,
    [extractPattern, matchPattern]
  );

  const nextSeq = Number(rows[0]?.next_seq || 1);
  return `RES-${year}-${String(nextSeq).padStart(3, '0')}`;
}

async function normalizeCouncilorCoAuthors(coAuthorIds, { allowEmpty = true, excludeIds = [] } = {}) {
  if (!Array.isArray(coAuthorIds) || coAuthorIds.length === 0) {
    if (allowEmpty) return null;
    const err = new Error('At least one co-author / sponsor is required');
    err.status = 400;
    throw err;
  }

  const excluded = new Set(
    (Array.isArray(excludeIds) ? excludeIds : [excludeIds])
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0)
  );

  const normalized = [...new Set(coAuthorIds
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0 && !excluded.has(id)))];

  const invalidOrExcluded = coAuthorIds.some((id) => {
    const normalizedId = Number(id);
    return !Number.isInteger(normalizedId) || normalizedId <= 0 || excluded.has(normalizedId);
  });
  if (invalidOrExcluded && normalized.length !== coAuthorIds.length) {
    const hasOnlyExcludedPrimaryAuthor = normalized.length === 0 && excluded.size > 0;
    if (!hasOnlyExcludedPrimaryAuthor) {
      const err = new Error('Co-authors must be valid user IDs');
      err.status = 400;
      throw err;
    }
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
exports.createResolution = async (data, user) => {
  const {
    title,
    resolution_number,
    description,
    content,
    remarks,
    proposer_id,
    status,
    co_authors,
    whereas_clauses,
    effectivity_clause,
    attachments,
  } = data;

  const legacyImportRequested = parseBooleanInput(data?.is_legacy_import);
  const autoPostRequested = parseBooleanInput(data?.auto_post_publicly);
  const creatorRole = normalizeRoleName(user?.role || user?.role_name);
  const isSecretaryUploader = creatorRole === 'secretary' || creatorRole === 'committee secretary';

  if (isSecretaryUploader && !legacyImportRequested) {
    const err = new Error('Secretary accounts can only submit legacy resolution scans/uploads. Enable legacy import before submitting.');
    err.status = 403;
    throw err;
  }

  if ((legacyImportRequested || autoPostRequested) && !canBypassWorkflowForLegacy(user?.role || user?.role_name)) {
    const err = new Error('Only Admin/Secretary/Committee Secretary can use legacy resolution publish bypass options.');
    err.status = 403;
    throw err;
  }

  const proposer = await resolveResolutionProposer({ proposer_id }, user);
  const normalizedCoAuthors = await normalizeCouncilorCoAuthors(co_authors, {
    allowEmpty: true,
    excludeIds: proposer.id,
  });
  let finalResolutionNumber = resolution_number;
  if ((isCouncilorRole(user?.role || user?.role_name) || isSecretaryUploader) && isBlankInput(resolution_number)) {
    finalResolutionNumber = await generateNextResolutionNumber();
  }
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
    finalResolutionNumber,
    description,
    content,
    remarks,
    proposer.id,
    proposer.name,
    initialStatus,
    normalizedCoAuthors,
    whereas_clauses,
    effectivity_clause,
    attachments,
    initialReadingStage
  );
  let resolution = result.rows[0];

  resolution = await autoPostLegacyResolutionIfNeeded(resolution, data, user);

  try {
    await AuditLog.create(null, user.id, 'RESOLUTION_CREATE', `Resolution "${title}" created`);
  } catch (err) {
    console.warn('Non-fatal: failed to write resolution create audit log', err?.message || err);
  }

  try {
    await createNotification(user.id, `Your resolution "${title}" has been created.`);
  } catch (err) {
    console.warn('Non-fatal: failed to notify resolution creator', err?.message || err);
  }

  // Persist notifications for Secretary users so they can see new measures in the notifications panel.
  try {
    await notifyUrgentActionByRoles(
      pool,
      ['Secretary'],
      `Urgent action: Review proposed resolution "${title}" and assign a session for first reading when complete.`,
      {
        type: 'warning',
        title: 'Urgent Action Required',
        relatedId: resolution.id,
        relatedType: 'resolution',
      }
    );
  } catch (err) {
    console.warn('Non-fatal: failed to notify secretary for resolution create', err?.message || err);
  }

  try {
    const io = getIO();
    io.emit('resolutionCreated', resolution);
  } catch (err) {
    console.warn('Non-fatal: failed to emit resolutionCreated socket event', err?.message || err);
  }

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

  let finalResolutionNumber = resolution_number;
  if (isCouncilorRole(userRole) && existing.rows[0].status === 'Draft' && isBlankInput(resolution_number)) {
    finalResolutionNumber = isBlankInput(existing.rows[0].resolution_number)
      ? await generateNextResolutionNumber()
      : existing.rows[0].resolution_number;
  }

  const result = await Resolution.update(
    id,
    title,
    finalResolutionNumber,
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

    // Persist a notification for all Secretary users so they still receive it even when offline.
    await notifyUrgentActionByRoles(
      client,
      ['Secretary'],
      `Urgent action: Proposed resolution "${resolution.title}" was submitted. Review it and assign a session for first reading.`,
      {
        type: 'warning',
        title: 'Urgent Action Required',
        relatedId: Number(id),
        relatedType: 'resolution',
      }
    );

    const io = getIO();
    io.to('Secretary').emit('resolutionSubmitted', updated.rows[0]);

    await client.query('COMMIT');
    return updated.rows[0];
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
};

/**
 * Stage 2A: Secretary records/assigns session details before first reading.
 * Transitions: SUBMITTED -> RECORD_SESSION
 */
exports.assignSessionForFirstReading = async (id, sessionId, userId) => {
  const normalizedSessionId = Number(sessionId);
  if (!Number.isInteger(normalizedSessionId) || normalizedSessionId <= 0) {
    const e = new Error('A valid session is required');
    e.status = 400;
    throw e;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await Resolution.findById(id);
    if (!existing.rows.length) {
      await client.query('ROLLBACK');
      const e = new Error('Resolution not found');
      e.status = 404;
      throw e;
    }

    const resolution = existing.rows[0];
    if ((resolution.reading_stage || '').toUpperCase() !== 'SUBMITTED') {
      await client.query('ROLLBACK');
      const e = new Error('Session assignment requires resolution to be in SUBMITTED stage');
      e.status = 400;
      throw e;
    }

    const sessionResult = await client.query('SELECT id, title FROM sessions WHERE id = $1', [normalizedSessionId]);
    if (!sessionResult.rows.length) {
      await client.query('ROLLBACK');
      const e = new Error('Selected session was not found');
      e.status = 400;
      throw e;
    }

    await client.query(
      `UPDATE resolutions
       SET session_id_first_reading = $1,
           reading_stage = 'RECORD_SESSION',
           status = 'Under Review',
           updated_at = NOW()
       WHERE id = $2`,
      [normalizedSessionId, id]
    );

    await Resolution.insertWorkflowAction(client, id, 'ASSIGN_SESSION', 'RECORD_SESSION', userId, `Assigned to session ${normalizedSessionId}`);
    await AuditLog.create(client, userId, 'ASSIGN_SESSION', `Session assigned for first reading of resolution "${resolution.title}"`);
    await createNotification(resolution.proposer_id, `Your resolution "${resolution.title}" was assigned to a session for first reading.`);

    const updated = await client.query('SELECT * FROM resolutions WHERE id = $1', [id]);

    const io = getIO();
    io.emit('resolutionSessionAssigned', updated.rows[0]);

    await client.query('COMMIT');
    return updated.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Stage 3: Secretary marks First Reading during a session.
 * Transitions: RECORD_SESSION -> FIRST_READING
 */
exports.conductFirstReading = async (id, sessionId, discussionNotes, presidingOfficer, userId, selectedRecordingUrl = null) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await Resolution.findById(id);
    if (!existing.rows.length) { await client.query('ROLLBACK'); const e = new Error('Resolution not found'); e.status = 404; throw e; }
    const resolution = existing.rows[0];
    const stage = String(resolution.reading_stage || '').toUpperCase();
    const hasAssignedSession = Number.isInteger(Number(resolution.session_id_first_reading));
    const canProceedFromLegacySubmitted = stage === 'SUBMITTED' && hasAssignedSession;
    if (stage !== 'RECORD_SESSION' && !canProceedFromLegacySubmitted) {
      await client.query('ROLLBACK');
      const e = new Error('First Reading requires resolution to be in RECORD_SESSION stage'); e.status = 400; throw e;
    }

    const normalizedSessionId = Number(sessionId || resolution.session_id_first_reading);
    if (!Number.isInteger(normalizedSessionId) || normalizedSessionId <= 0) {
      await client.query('ROLLBACK');
      const e = new Error('Assign a session first before recording first reading'); e.status = 400; throw e;
    }

    const resolvedDiscussionNotes = buildReadingNotesWithRecording(discussionNotes, selectedRecordingUrl);

    await client.query(
      `UPDATE resolutions SET session_id_first_reading=$1, reading_stage='FIRST_READING', status='Under Review', updated_at=NOW() WHERE id=$2`,
      [normalizedSessionId, id]
    );
    const updated = await client.query('SELECT * FROM resolutions WHERE id=$1', [id]);
    await Resolution.insertReadingSession(client, id, normalizedSessionId, 1, resolvedDiscussionNotes, presidingOfficer);
    await Resolution.insertWorkflowAction(client, id, 'FIRST_READING', 'FIRST_READING', userId, resolvedDiscussionNotes || '');
    await AuditLog.create(client, userId, 'FIRST_READING', `First reading conducted for "${resolution.title}"`);
    await createNotification(resolution.proposer_id, `First reading conducted for your resolution "${resolution.title}".`);
    await notifyUrgentActionByRoles(
      client,
      ['Vice Mayor'],
      `Urgent action: First reading conducted for resolution "${resolution.title}". Refer it to committee for the next stage.`,
      {
        type: 'warning',
        title: 'Urgent Action Required',
        relatedId: Number(id),
        relatedType: 'resolution',
      }
    );
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

    const committeeLeadsRes = await client.query(
      `SELECT DISTINCT cm.user_id AS id
       FROM committee_members cm
       WHERE cm.committee_id = $1
         AND cm.role IN ('Chair', 'Committee Secretary')`,
      [committeeId]
    );
    for (const lead of committeeLeadsRes.rows) {
      await createNotification(
        lead.id,
        `Urgent action: Resolution "${resolution.title}" is assigned to your committee. Schedule/hold the committee meeting and submit the committee report.`,
        {
          type: 'warning',
          title: 'Urgent Action Required',
          relatedId: Number(id),
          relatedType: 'resolution',
        }
      );
    }

    const io = getIO();
    io.emit('resolutionCommitteeAssigned', updated.rows[0]);

    await client.query('COMMIT');
    return updated.rows[0];
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
};

/**
 * Stage 4: Committee submits its report.
 * Transitions: COMMITTEE_REPORT_SUBMITTED → ASSIGN_SECOND_SESSION
 */
exports.submitCommitteeReport = async (id, reportData, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await Resolution.findById(id);
    if (!existing.rows.length) { await client.query('ROLLBACK'); const e = new Error('Resolution not found'); e.status = 404; throw e; }
    const resolution = existing.rows[0];
    if (String(resolution.reading_stage || '').toUpperCase() !== 'COMMITTEE_REPORT_SUBMITTED') {
      await client.query('ROLLBACK');
      const e = new Error('Committee report requires resolution to be in COMMITTEE_REPORT_SUBMITTED stage'); e.status = 400; throw e;
    }
    if (Number(resolution.committee_report_id) > 0) {
      await client.query('ROLLBACK');
      const e = new Error('Committee report was already submitted for this resolution'); e.status = 400; throw e;
    }

    const reportTargetStage = 'ASSIGN_SECOND_SESSION';

    const committeeId = reportData.committee_id || resolution.committee_id;
    const roleRes = await client.query(
      `SELECT id, role FROM committee_members WHERE committee_id=$1 AND user_id=$2 AND role IN ('Chair', 'Committee Secretary')`,
      [committeeId, userId]
    );
    if (!roleRes.rows.length) {
      await client.query('ROLLBACK');
      const e = new Error('Only the committee chair or committee secretary can submit the committee report'); e.status = 403; throw e;
    }

    const latestEndedMeeting = await getLatestEndedCommitteeMeetingForResolution(client, id, committeeId);
    const resolvedMeetingDate = latestEndedMeeting?.meeting_date || reportData.meeting_date || null;
    const resolvedAttendees = latestEndedMeeting
      ? normalizeAttendeesValue(latestEndedMeeting.meeting_attendees)
      : normalizeAttendeesValue(reportData.attendees);
    const resolvedRecordingUrl =
      normalizeLinkedRecordingUrl(reportData.recording_url)
      || normalizeLinkedRecordingUrl(latestEndedMeeting?.recording_url);
    const resolvedReportContent = appendMeetingRecordingLine(
      reportData.report_content,
      resolvedRecordingUrl
    );

    const report = await Resolution.insertCommitteeReport(client, {
      resolutionId: id,
      committeeId,
      submittedBy: userId,
      recommendation: reportData.recommendation,
      reportContent: resolvedReportContent,
      meetingDate: resolvedMeetingDate,
      meetingMinutes: reportData.meeting_minutes,
      attendees: resolvedAttendees,
    });

    await client.query(
      `UPDATE resolutions SET committee_report_id=$1, reading_stage=$3, updated_at=NOW() WHERE id=$2`,
      [report.rows[0].id, id, reportTargetStage]
    );
    const updated = await client.query('SELECT * FROM resolutions WHERE id=$1', [id]);
    await Resolution.insertWorkflowAction(client, id, 'COMMITTEE_REPORT', reportTargetStage, userId, `Recommendation: ${reportData.recommendation}`);
    await AuditLog.create(client, userId, 'COMMITTEE_REPORT_SUBMITTED', `Committee report submitted for "${resolution.title}"`);
    await createNotification(resolution.proposer_id, `Committee report submitted for your resolution "${resolution.title}". Recommendation: ${reportData.recommendation}`);

    const usersRes = await client.query(`SELECT u.id, r.role_name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE r.role_name IN ('Secretary', 'Admin')`);
    for (const u of usersRes.rows) {
      const normalizedRole = String(u.role || '').toLowerCase();
      const isSecretary = normalizedRole === 'secretary';
      await createNotification(
        u.id,
        isSecretary
          ? `Urgent action: Committee report for resolution "${resolution.title}" is submitted. Assign a session for second reading.`
          : `Committee report was submitted for resolution "${resolution.title}". Recommendation: ${reportData.recommendation}`,
        {
          type: isSecretary ? 'warning' : 'activity',
          title: isSecretary ? 'Urgent Action Required' : 'Committee Report Submitted',
          relatedId: Number(id),
          relatedType: 'resolution',
        }
      );
    }

    const io = getIO();
    io.to('Secretary').emit('resolutionCommitteeReportSubmitted', { resolution: updated.rows[0], report: report.rows[0] });

    await client.query('COMMIT');
    return { resolution: updated.rows[0], report: report.rows[0] };
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
};

/**
 * Stage 5A: Secretary assigns session details before second reading.
 * Transitions: ASSIGN_SECOND_SESSION -> RECORD_SECOND_SESSION
 */
exports.assignSessionForSecondReading = async (id, sessionId, userId) => {
  const normalizedSessionId = Number(sessionId);
  if (!Number.isInteger(normalizedSessionId) || normalizedSessionId <= 0) {
    const e = new Error('A valid session is required');
    e.status = 400;
    throw e;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await Resolution.findById(id);
    if (!existing.rows.length) {
      await client.query('ROLLBACK');
      const e = new Error('Resolution not found');
      e.status = 404;
      throw e;
    }

    const resolution = existing.rows[0];
    const currentStage = String(resolution.reading_stage || '').toUpperCase();
    if (
      currentStage !== 'ASSIGN_SECOND_SESSION'
      && currentStage !== 'COMMITTEE_REPORT_SUBMITTED'
      && currentStage !== 'RECORD_SECOND_SESSION'
    ) {
      await client.query('ROLLBACK');
      const e = new Error('Second session assignment requires resolution to be in ASSIGN_SECOND_SESSION stage');
      e.status = 400;
      throw e;
    }

    const sessionResult = await client.query('SELECT id FROM sessions WHERE id = $1', [normalizedSessionId]);
    if (!sessionResult.rows.length) {
      await client.query('ROLLBACK');
      const e = new Error('Selected session was not found');
      e.status = 400;
      throw e;
    }

    await client.query(
      `UPDATE resolutions
       SET session_id_second_reading = $1,
           reading_stage = 'RECORD_SECOND_SESSION',
           status = 'Under Review',
           updated_at = NOW()
       WHERE id = $2`,
      [normalizedSessionId, id]
    );

    await Resolution.insertWorkflowAction(client, id, 'ASSIGN_SECOND_SESSION', 'RECORD_SECOND_SESSION', userId, `Assigned to session ${normalizedSessionId}`);
    await AuditLog.create(client, userId, 'ASSIGN_SECOND_SESSION', `Session assigned for second reading of resolution "${resolution.title}"`);
    await createNotification(resolution.proposer_id, `Your resolution "${resolution.title}" was assigned to a session for second reading.`);

    const updated = await client.query('SELECT * FROM resolutions WHERE id = $1', [id]);
    const io = getIO();
    io.emit('resolutionSecondSessionAssigned', updated.rows[0]);

    await client.query('COMMIT');
    return updated.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Admin-only correction path to override assigned session without forcing stage progression.
 */
exports.adminOverrideSessionAssignment = async (id, payload, adminUserId) => {
  const normalizedSessionId = Number(payload?.session_id);
  const readingPhase = String(payload?.reading_phase || '').trim().toLowerCase();
  const reason = String(payload?.reason || '').trim();

  if (!Number.isInteger(normalizedSessionId) || normalizedSessionId <= 0) {
    const e = new Error('A valid session_id is required');
    e.status = 400;
    throw e;
  }

  if (!['first', 'second'].includes(readingPhase)) {
    const e = new Error('reading_phase must be either "first" or "second"');
    e.status = 400;
    throw e;
  }

  if (!reason) {
    const e = new Error('A correction reason is required');
    e.status = 400;
    throw e;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT * FROM resolutions WHERE id = $1 FOR UPDATE', [id]);
    if (!existing.rows.length) {
      await client.query('ROLLBACK');
      const e = new Error('Resolution not found');
      e.status = 404;
      throw e;
    }

    const resolution = existing.rows[0];
    const currentStage = normalizeReadingStage(resolution.reading_stage);

    const stageRules = readingPhase === 'first'
      ? {
        allowedStages: ['SUBMITTED', 'RECORD_SESSION'],
        fieldName: 'session_id_first_reading',
        targetStage: currentStage === 'SUBMITTED' ? 'RECORD_SESSION' : currentStage,
      }
      : {
        allowedStages: ['COMMITTEE_REPORT_SUBMITTED', 'ASSIGN_SECOND_SESSION', 'RECORD_SECOND_SESSION'],
        fieldName: 'session_id_second_reading',
        targetStage: (currentStage === 'COMMITTEE_REPORT_SUBMITTED' || currentStage === 'ASSIGN_SECOND_SESSION')
          ? 'RECORD_SECOND_SESSION'
          : currentStage,
      };

    if (!stageRules.allowedStages.includes(currentStage)) {
      await client.query('ROLLBACK');
      const e = new Error(`Cannot override ${readingPhase} reading session while resolution is in ${currentStage} stage`);
      e.status = 400;
      throw e;
    }

    const sessionResult = await client.query('SELECT id, title FROM sessions WHERE id = $1', [normalizedSessionId]);
    if (!sessionResult.rows.length) {
      await client.query('ROLLBACK');
      const e = new Error('Selected session was not found');
      e.status = 400;
      throw e;
    }

    const previousSessionId = resolution[stageRules.fieldName] || null;
    await client.query(
      `UPDATE resolutions
       SET ${stageRules.fieldName} = $1,
           reading_stage = $2,
           status = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [normalizedSessionId, stageRules.targetStage, resolveStatusForStage(stageRules.targetStage), id]
    );

    const workflowComment = [
      `Admin override (${readingPhase} reading session)`,
      `from ${previousSessionId || 'none'} to ${normalizedSessionId}`,
      `Reason: ${reason}`,
    ].join(' | ');

    await Resolution.insertWorkflowAction(
      client,
      id,
      'ADMIN_OVERRIDE_SESSION',
      stageRules.targetStage,
      adminUserId,
      workflowComment
    );
    await AuditLog.create(
      client,
      adminUserId,
      'ADMIN_OVERRIDE_SESSION',
      `Admin corrected ${readingPhase} reading session for resolution "${resolution.title}" from ${previousSessionId || 'none'} to ${normalizedSessionId}. Reason: ${reason}`
    );
    await createNotification(
      resolution.proposer_id,
      `An administrator corrected the ${readingPhase} reading session assignment for your resolution "${resolution.title}".`
    );

    const updated = await client.query('SELECT * FROM resolutions WHERE id = $1', [id]);
    const io = getIO();
    io.emit('resolutionWorkflowCorrected', updated.rows[0]);

    await client.query('COMMIT');
    return updated.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Admin-only stage override for pre-voting corrections.
 */
exports.adminOverrideWorkflowStage = async (id, payload, adminUserId) => {
  const targetStage = normalizeReadingStage(payload?.target_stage);
  const reason = String(payload?.reason || '').trim();

  if (!reason) {
    const e = new Error('A correction reason is required');
    e.status = 400;
    throw e;
  }

  if (!ADMIN_STAGE_SEQUENCE.includes(targetStage)) {
    const e = new Error('target_stage is not recognized');
    e.status = 400;
    throw e;
  }

  const disallowedTargets = new Set(['THIRD_READING_VOTING', 'THIRD_READING_VOTED', 'APPROVED', 'POSTED', 'EFFECTIVE']);
  if (disallowedTargets.has(targetStage)) {
    const e = new Error('Admin override only allows correction to pre-voting stages');
    e.status = 400;
    throw e;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT * FROM resolutions WHERE id = $1 FOR UPDATE', [id]);
    if (!existing.rows.length) {
      await client.query('ROLLBACK');
      const e = new Error('Resolution not found');
      e.status = 404;
      throw e;
    }

    const resolution = existing.rows[0];
    const currentStage = normalizeReadingStage(resolution.reading_stage);

    if (!ADMIN_STAGE_SEQUENCE.includes(currentStage)) {
      await client.query('ROLLBACK');
      const e = new Error(`Current stage ${currentStage} is not recognized`);
      e.status = 400;
      throw e;
    }

    if (disallowedTargets.has(currentStage)) {
      await client.query('ROLLBACK');
      const e = new Error(`Cannot override workflow after ${currentStage}`);
      e.status = 400;
      throw e;
    }

    const currentIndex = ADMIN_STAGE_SEQUENCE.indexOf(currentStage);
    const targetIndex = ADMIN_STAGE_SEQUENCE.indexOf(targetStage);
    if (targetIndex > currentIndex) {
      await client.query('ROLLBACK');
      const e = new Error('Admin override can only move to the same or an earlier stage');
      e.status = 400;
      throw e;
    }

    const clearFirstSession = targetIndex < ADMIN_STAGE_SEQUENCE.indexOf('RECORD_SESSION');
    const clearSecondSession = targetIndex < ADMIN_STAGE_SEQUENCE.indexOf('RECORD_SECOND_SESSION');

    await client.query(
      `UPDATE resolutions
       SET reading_stage = $1,
           status = $2,
           session_id_first_reading = CASE WHEN $3 THEN NULL ELSE session_id_first_reading END,
           session_id_second_reading = CASE WHEN $4 THEN NULL ELSE session_id_second_reading END,
           updated_at = NOW()
       WHERE id = $5`,
      [targetStage, resolveStatusForStage(targetStage), clearFirstSession, clearSecondSession, id]
    );

    await Resolution.insertWorkflowAction(
      client,
      id,
      'ADMIN_OVERRIDE_STAGE',
      targetStage,
      adminUserId,
      `Admin stage correction from ${currentStage} to ${targetStage}. Reason: ${reason}`
    );
    await AuditLog.create(
      client,
      adminUserId,
      'ADMIN_OVERRIDE_STAGE',
      `Admin corrected workflow stage for resolution "${resolution.title}" from ${currentStage} to ${targetStage}. Reason: ${reason}`
    );
    await createNotification(
      resolution.proposer_id,
      `An administrator corrected the workflow stage for your resolution "${resolution.title}".`
    );

    const updated = await client.query('SELECT * FROM resolutions WHERE id = $1', [id]);
    const io = getIO();
    io.emit('resolutionWorkflowCorrected', updated.rows[0]);

    await client.query('COMMIT');
    return updated.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Stage 5: Secretary records Second Reading.
 * Transitions: RECORD_SECOND_SESSION → SECOND_READING
 */
exports.conductSecondReading = async (id, sessionId, discussionNotes, presidingOfficer, userId, selectedRecordingUrl = null) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await Resolution.findById(id);
    if (!existing.rows.length) { await client.query('ROLLBACK'); const e = new Error('Resolution not found'); e.status = 404; throw e; }
    const resolution = existing.rows[0];
    const stage = String(resolution.reading_stage || '').toUpperCase();
    const hasAssignedSecondSession = Number.isInteger(Number(resolution.session_id_second_reading));
    const canProceedFromLegacyCommitteeReport = stage === 'COMMITTEE_REPORT_SUBMITTED' && hasAssignedSecondSession;
    const canProceedFromAssignSecondSession = stage === 'ASSIGN_SECOND_SESSION' && hasAssignedSecondSession;
    if (stage !== 'RECORD_SECOND_SESSION' && !canProceedFromLegacyCommitteeReport && !canProceedFromAssignSecondSession) {
      await client.query('ROLLBACK');
      const e = new Error('Second Reading requires resolution to be in RECORD_SECOND_SESSION stage'); e.status = 400; throw e;
    }

    const normalizedSessionId = Number(sessionId || resolution.session_id_second_reading);
    if (!Number.isInteger(normalizedSessionId) || normalizedSessionId <= 0) {
      await client.query('ROLLBACK');
      const e = new Error('Assign a session first before recording second reading'); e.status = 400; throw e;
    }

    const resolvedDiscussionNotes = buildReadingNotesWithRecording(discussionNotes, selectedRecordingUrl);

    await client.query(
      `UPDATE resolutions
       SET session_id_second_reading=$1,
           reading_stage='SECOND_READING',
           status='Under Review',
           updated_at=NOW()
       WHERE id=$2`,
      [normalizedSessionId, id]
    );
    const updated = await client.query('SELECT * FROM resolutions WHERE id=$1', [id]);
    await Resolution.insertReadingSession(client, id, normalizedSessionId, 2, resolvedDiscussionNotes, presidingOfficer);
    await Resolution.insertWorkflowAction(client, id, 'SECOND_READING', 'SECOND_READING', userId, resolvedDiscussionNotes || '');
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
      await createNotification(
        c.id,
        `Urgent action: Voting is now open for resolution "${resolution.title}". Cast your vote now.`,
        {
          type: 'warning',
          title: 'Urgent Vote Required',
          relatedId: Number(id),
          relatedType: 'resolution',
        }
      );
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
  const resolutionRes = await Resolution.findById(id);

  if (!resolutionRes.rows.length) {
    const e = new Error('Resolution not found'); e.status = 404; throw e;
  }

  const safeQuery = async (fn, fallbackRows = []) => {
    try {
      const result = await fn();
      return result.rows;
    } catch (err) {
      // 42P01: undefined_table (table not created yet in partially bootstrapped/demo DBs)
      if (err?.code === '42P01') {
        return fallbackRows;
      }
      throw err;
    }
  };

  const [readingsRows, historyRows] = await Promise.all([
    safeQuery(() => Resolution.findReadingSessions(id), []),
    safeQuery(() => Resolution.findHistory(id), []),
  ]);

  const res = resolutionRes.rows[0];
  let committeeReport = null;
  let postingRecords = [];
  let linkedSessionRecordings = [];

  // Fetch committee with members
  let committee = undefined;
  if (res.committee_id) {
    const { getCommitteeWithMembers } = require('../utils/committeesHelper');
    committee = await getCommitteeWithMembers(res.committee_id);
  }
  res.committee = committee;

  if (res.committee_report_id) {
    const reportRows = await safeQuery(() => Resolution.findCommitteeReport(id), []);
    committeeReport = reportRows[0] || null;
  }

  postingRecords = await safeQuery(() => Resolution.findPostingRecords(id), []);

  const linkedSessionId = Number(res?.session_id_first_reading);
  if (Number.isInteger(linkedSessionId) && linkedSessionId > 0) {
    const linkedRecordingRows = await safeQuery(
      () => SessionRecording.findBySessionId(linkedSessionId),
      []
    );
    linkedSessionRecordings = linkedRecordingRows;
  }

  return {
    resolution: res,
    readings: readingsRows,
    committeeReport,
    postingRecords,
    linkedSessionRecordings,
    history: historyRows,
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
