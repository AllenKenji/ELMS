/**
 * Ordinance Service - Business logic for ordinance operations.
 */
const pool = require('../db');
const Ordinance = require('../models/Ordinance');
const Resolution = require('../models/Resolution');
const SessionRecording = require('../models/SessionRecording');
const Vote = require('../models/Vote');
const AuditLog = require('../models/AuditLog');
const { createNotification } = require('../utils/notifications');
const { getIO } = require('../socket');

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

async function resolveOrdinanceProposer(data, user) {
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

async function getLatestEndedCommitteeMeetingForOrdinance(client, ordinanceId, committeeId) {
  const result = await client.query(
    `SELECT cm.meeting_date,
            cm.recording_url,
            COALESCE(minutes.attendees, minutes.participants) AS meeting_attendees
     FROM committee_meetings cm
     LEFT JOIN committee_minutes minutes ON minutes.id = cm.minutes_id
     WHERE cm.ordinance_id = $1
       AND cm.committee_id = $2
       AND cm.ended = TRUE
     ORDER BY cm.meeting_date DESC, cm.updated_at DESC, cm.created_at DESC
     LIMIT 1`,
    [ordinanceId, committeeId]
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

async function autoPostLegacyOrdinanceIfNeeded(ordinance, payload, actorUser) {
  const isLegacyImport = parseBooleanInput(payload?.is_legacy_import);
  const autoPostPublicly = parseBooleanInput(payload?.auto_post_publicly);

  if (!isLegacyImport || !autoPostPublicly) {
    return ordinance;
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

    await Ordinance.recordApproval(
      client,
      ordinance.id,
      approvedBy,
      approvalRemarks || 'Legacy ordinance import approved during electronic encoding.'
    );
    await Ordinance.setApprovedDate(client, ordinance.id);

    const postedResult = await Ordinance.recordPosting(client, ordinance.id, postingEndDate);
    await Ordinance.setPublishedDate(client, ordinance.id);

    await Ordinance.insertPostingRecord(client, {
      ordinanceId: ordinance.id,
      postedBy: actorUser.id,
      postingDurationDays,
      postingLocation,
      effectiveDate: postingEndDate,
      notes: String(payload?.posting_notes || payload?.notes || '').trim() || 'Auto-posted from legacy ordinance import.',
    });

    await Ordinance.insertWorkflowAction(
      client,
      ordinance.id,
      'LEGACY_IMPORT_APPROVAL',
      'APPROVED',
      actorUser.id,
      'Legacy ordinance import auto-approved for public posting.'
    );
    await Ordinance.insertWorkflowAction(
      client,
      ordinance.id,
      'POST_PUBLICLY',
      'POSTED',
      actorUser.id,
      `Legacy ordinance import auto-posted publicly for ${postingDurationDays} day(s) at: ${postingLocation || 'N/A'}`
    );

    await AuditLog.create(
      client,
      actorUser.id,
      'ORDINANCE_LEGACY_AUTO_POSTED',
      `Legacy ordinance "${ordinance.title}" was auto-posted publicly after import.`
    );
    await createNotification(
      ordinance.proposer_id,
      `Your legacy ordinance "${ordinance.title}" was auto-posted publicly after electronic import.`
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

async function generateNextOrdinanceNumber() {
  const year = new Date().getFullYear();
  const extractPattern = `^ORD-${year}-(\\d+)$`;
  const matchPattern = `^ORD-${year}-\\d+$`;

  const { rows } = await pool.query(
    `SELECT COALESCE(MAX((regexp_match(ordinance_number, $1))[1]::int), 0) + 1 AS next_seq
     FROM ordinances
     WHERE ordinance_number ~ $2`,
    [extractPattern, matchPattern]
  );

  const nextSeq = Number(rows[0]?.next_seq || 1);
  return `ORD-${year}-${String(nextSeq).padStart(3, '0')}`;
}

function parseCoAuthorIds(value) {
  if (Array.isArray(value)) {
    return [...new Set(value
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0))];
  }

  if (value === null || value === undefined) {
    return [];
  }

  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 ? [value] : [];
  }

  const text = String(value).trim();
  if (!text) {
    return [];
  }

  // Support JSON array payloads stored as strings, e.g. "[3,4]"
  if (text.startsWith('[') && text.endsWith(']')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return [...new Set(parsed
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && id > 0))];
      }
    } catch {
      // Fallback to regex extraction below.
    }
  }

  // Fallback for legacy/mixed formats: "1, 2", "[1,2]", "1|2", etc.
  const matches = text.match(/\d+/g) || [];
  return [...new Set(matches
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0))];
}

async function ensureSessionParticipant(sessionId, userId) {
  const normalizedSessionId = Number(sessionId);
  const normalizedUserId = Number(userId);

  if (!Number.isInteger(normalizedSessionId) || normalizedSessionId <= 0) return;
  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) return;

  await pool.query(
    `INSERT INTO session_participants (session_id, user_id, attendance_status, added_at)
     SELECT $1, $2, 'Pending', NOW()
     WHERE EXISTS (SELECT 1 FROM sessions WHERE id = $1)
       AND EXISTS (SELECT 1 FROM users WHERE id = $2)
       AND NOT EXISTS (
         SELECT 1 FROM session_participants
         WHERE session_id = $1 AND user_id = $2
       )`,
    [normalizedSessionId, normalizedUserId]
  );
}

async function normalizeCouncilorCoAuthors(coAuthorIds, { allowEmpty = true, excludeIds = [] } = {}) {
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
    proposer_id,
    status = '',
    co_authors = [],
    whereas_clauses = '',
    effectivity_clause = '',
    attachments = [],
  } = data;

  const legacyImportRequested = parseBooleanInput(data?.is_legacy_import);
  const autoPostRequested = parseBooleanInput(data?.auto_post_publicly);
  const creatorRole = normalizeRoleName(user?.role || user?.role_name);
  const isSecretaryUploader = creatorRole === 'secretary' || creatorRole === 'committee secretary';

  if (isSecretaryUploader && !legacyImportRequested) {
    const err = new Error('Secretary accounts can only submit legacy ordinance scans/uploads. Enable legacy import before submitting.');
    err.status = 403;
    throw err;
  }

  if ((legacyImportRequested || autoPostRequested) && !canBypassWorkflowForLegacy(user?.role || user?.role_name)) {
    const err = new Error('Only Admin/Secretary/Committee Secretary can use legacy ordinance publish bypass options.');
    err.status = 403;
    throw err;
  }

  const proposer = await resolveOrdinanceProposer({ proposer_id }, user);
  const normalizedCoAuthors = await normalizeCouncilorCoAuthors(co_authors, {
    allowEmpty: true,
    excludeIds: proposer.id,
  });
  let finalOrdinanceNumber = ordinance_number;
  if (isCouncilorRole(user?.role) && isBlankInput(ordinance_number)) {
    finalOrdinanceNumber = await generateNextOrdinanceNumber();
  }
  const initialStatus = status || 'Draft';
  // Set initial reading_stage based on status
  let initialReadingStage = null;
  if (initialStatus && initialStatus.toLowerCase() === 'draft') {
    initialReadingStage = 'DRAFT';
  } else if (initialStatus && initialStatus.toLowerCase() === 'submitted') {
    initialReadingStage = 'SUBMITTED';
  } else {
    initialReadingStage = 'DRAFT'; // fallback to DRAFT if status is missing or unrecognized
  }
  const result = await Ordinance.create(
    title, finalOrdinanceNumber, description, content, remarks,
    proposer.id,
    proposer.name,
    initialStatus,
    normalizedCoAuthors,
    whereas_clauses,
    effectivity_clause,
    attachments,
    initialReadingStage // pass as last argument
  );
  let ordinance = result.rows[0];

  ordinance = await autoPostLegacyOrdinanceIfNeeded(ordinance, data, user);

  try {
    await AuditLog.create(null, user.id, 'ORDINANCE_CREATE', `Ordinance "${title}" created`);
  } catch (err) {
    console.warn('Non-fatal: failed to write ordinance create audit log', err?.message || err);
  }

  try {
    await createNotification(user.id, `Your ordinance "${title}" has been created.`);
  } catch (err) {
    console.warn('Non-fatal: failed to notify ordinance creator', err?.message || err);
  }

  // Persist notifications for Secretary users so they can see new measures in the notifications panel.
  try {
    const secretaryUsers = await pool.query(
      `SELECT u.id
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE r.role_name = 'Secretary'`
    );
    for (const secretary of secretaryUsers.rows) {
      try {
        await createNotification(
          secretary.id,
          `A new proposed ordinance "${title}" was created and is ready for review.`,
          {
            type: 'activity',
            title: 'New Proposed Measure',
            relatedId: ordinance.id,
            relatedType: 'ordinance',
          }
        );
      } catch (err) {
        console.warn('Non-fatal: failed to notify secretary for ordinance create', err?.message || err);
      }
    }
  } catch (err) {
    console.warn('Non-fatal: failed to query secretary users for ordinance notifications', err?.message || err);
  }

  // Notify all Vice Mayors if no committee is assigned
  if (!data.committee_id) {
    // Query all users with the 'Vice Mayor' role
    try {
      const { rows: viceMayors } = await require('../models/User').findAll();
      for (const vm of viceMayors) {
        if ((vm.role_name || '').toLowerCase() === 'vice mayor') {
          try {
            await createNotification(
              vm.id,
              `A proposed measure ("${title}") has been created and is not yet assigned to a committee.`,
              {
                type: 'warning',
                title: 'Unassigned Proposed Measure',
                relatedId: ordinance.id,
                relatedType: 'ordinance',
              }
            );
          } catch (err) {
            console.warn('Non-fatal: failed to notify vice mayor for ordinance create', err?.message || err);
          }
        }
      }
    } catch (err) {
      console.warn('Non-fatal: failed to query vice mayors for ordinance notifications', err?.message || err);
    }
  }

  try {
    const io = getIO();
    io.to('Secretary').emit('ordinanceCreated', ordinance);
    io.to('Councilor').emit('ordinanceCreated', ordinance);
  } catch (err) {
    console.warn('Non-fatal: failed to emit ordinanceCreated socket event', err?.message || err);
  }

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
    // Fetch and attach full committee object if committee_id is present
    let committee = undefined;
    if (ordinance.committee_id) {
      const Committee = require('../models/Committee');
      const committeeResult = await Committee.findById(ordinance.committee_id);
      if (committeeResult && committeeResult.rows && committeeResult.rows.length > 0) {
        committee = committeeResult.rows[0];
        // Fetch committee members
        if (committee && committee.id) {
          const membersResult = await Committee.findMembers(committee.id);
          committee.members = membersResult && membersResult.rows ? membersResult.rows : [];
        }
      }
    }

  return { ...ordinance, co_authors: coAuthors, committee };
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
  userId,
  userRole
) => {
  const existing = await Ordinance.findById(id);
  if (existing.rows.length === 0) {
    const err = new Error('Ordinance not found');
    err.status = 404;
    throw err;
  }

  const existingOrdinance = existing.rows[0];
  let finalOrdinanceNumber = ordinance_number;
  if (isCouncilorRole(userRole) && existingOrdinance.status === 'Draft' && isBlankInput(ordinance_number)) {
    finalOrdinanceNumber = isBlankInput(existingOrdinance.ordinance_number)
      ? await generateNextOrdinanceNumber()
      : existingOrdinance.ordinance_number;
  }

  const normalizedCoAuthors = co_authors === undefined
    ? undefined
    : await normalizeCouncilorCoAuthors(co_authors, { allowEmpty: true });

  const result = await Ordinance.update(
    id,
    title,
    finalOrdinanceNumber,
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
  const fs = require('fs');
  const path = require('path');
  const client = await pool.connect();
  const quoteIdentifier = (value) => `"${String(value).replace(/"/g, '""')}"`;

  const tableExists = async (tableName) => {
    const result = await client.query('SELECT to_regclass($1) AS table_name', [tableName]);
    return Boolean(result.rows[0]?.table_name);
  };

  const runIfTableExists = async (tableName, sql, params = []) => {
    if (await tableExists(tableName)) {
      await client.query(sql, params);
    }
  };

  const cleanupUnknownOrdinanceReferences = async (ordinanceId) => {
    const fkRefs = await client.query(
      `SELECT
         tc.table_schema,
         tc.table_name,
         kcu.column_name,
         c.is_nullable,
         rc.delete_rule
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
       JOIN information_schema.constraint_column_usage ccu
         ON tc.constraint_name = ccu.constraint_name
        AND tc.table_schema = ccu.table_schema
       JOIN information_schema.referential_constraints rc
         ON tc.constraint_name = rc.constraint_name
        AND tc.table_schema = rc.constraint_schema
       JOIN information_schema.columns c
         ON c.table_schema = kcu.table_schema
        AND c.table_name = kcu.table_name
        AND c.column_name = kcu.column_name
       WHERE tc.constraint_type = 'FOREIGN KEY'
         AND ccu.table_schema = 'public'
         AND ccu.table_name = 'ordinances'
         AND ccu.column_name = 'id'
         AND (
           SELECT COUNT(*)
           FROM information_schema.key_column_usage kcu2
           WHERE kcu2.constraint_name = tc.constraint_name
             AND kcu2.table_schema = tc.table_schema
         ) = 1`
    );

    for (const ref of fkRefs.rows) {
      if (ref.table_schema === 'public' && ref.table_name === 'ordinances') {
        continue;
      }

      if (ref.delete_rule === 'CASCADE' || ref.delete_rule === 'SET NULL') {
        continue;
      }

      const tableRef = `${quoteIdentifier(ref.table_schema)}.${quoteIdentifier(ref.table_name)}`;
      const columnRef = quoteIdentifier(ref.column_name);

      if (ref.is_nullable === 'YES') {
        await client.query(`UPDATE ${tableRef} SET ${columnRef} = NULL WHERE ${columnRef} = $1`, [ordinanceId]);
      } else {
        await client.query(`DELETE FROM ${tableRef} WHERE ${columnRef} = $1`, [ordinanceId]);
      }
    }
  };

  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT * FROM ordinances WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      const err = new Error('Ordinance not found');
      err.status = 404;
      throw err;
    }

    // Delete attachment files from disk
    const attachments = existing.rows[0].attachments || [];
    if (Array.isArray(attachments)) {
      attachments.forEach(att => {
        if (typeof att === 'string' && att.startsWith('/uploads/ordinances/')) {
          const filePath = path.join(__dirname, '..', att);
          fs.unlink(filePath, err => {
            if (err && err.code !== 'ENOENT') {
              console.error('Failed to delete attachment:', filePath, err);
            }
          });
        }
      });
    }

    // Legacy-safe cleanup for dependent references before hard delete.
    await runIfTableExists(
      'public.session_agenda_items',
      'DELETE FROM session_agenda_items WHERE ordinance_id = $1',
      [id]
    );
    await runIfTableExists(
      'public.voting_sessions',
      'UPDATE voting_sessions SET ordinance_id = NULL WHERE ordinance_id = $1',
      [id]
    );
    await runIfTableExists(
      'public.committee_meetings',
      'UPDATE committee_meetings SET ordinance_id = NULL WHERE ordinance_id = $1',
      [id]
    );

    await runIfTableExists(
      'public.reading_sessions',
      'DELETE FROM reading_sessions WHERE ordinance_id = $1',
      [id]
    );
    await runIfTableExists(
      'public.committee_reports',
      'DELETE FROM committee_reports WHERE ordinance_id = $1',
      [id]
    );
    await runIfTableExists(
      'public.posting_records',
      'DELETE FROM posting_records WHERE ordinance_id = $1',
      [id]
    );
    await runIfTableExists(
      'public.ordinance_workflow',
      'DELETE FROM ordinance_workflow WHERE ordinance_id = $1',
      [id]
    );
    await runIfTableExists(
      'public.ordinance_approvals',
      'DELETE FROM ordinance_approvals WHERE ordinance_id = $1',
      [id]
    );

    await cleanupUnknownOrdinanceReferences(id);

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

    if (status === 'Submitted') await Ordinance.setReadingStage(client, id, 'SUBMITTED', 'Submitted');
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
 * Stage 1: Councilor submits proposed measure to Vice Mayor.
 * Transitions: Draft → SUBMITTED
 */
exports.submitToViceMayor = async (id, comment, userId) => {
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
    await Ordinance.insertWorkflowAction(client, id, 'SUBMIT_TO_VICE_MAYOR', 'SUBMITTED', userId, comment || '');
    await AuditLog.create(client, userId, 'LEGISLATIVE_SUBMIT', `Ordinance "${ordinance.title}" submitted to Vice Mayor`);
    await createNotification(userId, `Ordinance "${ordinance.title}" submitted to Vice Mayor.`);

    // Persist a notification for all Secretary users so they still receive it even when offline.
    const secretaryUsers = await client.query(
      `SELECT u.id
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE r.role_name = 'Secretary'`
    );
    for (const secretary of secretaryUsers.rows) {
      await createNotification(
        secretary.id,
        `A proposed ordinance "${ordinance.title}" was submitted by a councilor and is ready for review.`,
        {
          type: 'activity',
          title: 'Proposed Measure Submitted',
          relatedId: Number(id),
          relatedType: 'ordinance',
        }
      );
    }

    const io = getIO();
    io.to('Secretary').emit('ordinanceSubmitted', updated.rows[0]);

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

    const existing = await Ordinance.findById(id);
    if (!existing.rows.length) {
      await client.query('ROLLBACK');
      const e = new Error('Ordinance not found');
      e.status = 404;
      throw e;
    }

    const ordinance = existing.rows[0];
    if ((ordinance.reading_stage || '').toUpperCase() !== 'SUBMITTED') {
      await client.query('ROLLBACK');
      const e = new Error('Session assignment requires ordinance to be in SUBMITTED stage');
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
      `UPDATE ordinances
       SET session_id_first_reading = $1,
           reading_stage = 'RECORD_SESSION',
           status = 'Under Review',
           updated_at = NOW()
       WHERE id = $2`,
      [normalizedSessionId, id]
    );

    await Ordinance.insertWorkflowAction(client, id, 'ASSIGN_SESSION', 'RECORD_SESSION', userId, `Assigned to session ${normalizedSessionId}`);
    await AuditLog.create(client, userId, 'ASSIGN_SESSION', `Session assigned for first reading of ordinance "${ordinance.title}"`);
    await createNotification(ordinance.proposer_id, `Your ordinance "${ordinance.title}" was assigned to a session for first reading.`);

    const updated = await client.query('SELECT * FROM ordinances WHERE id = $1', [id]);

    const io = getIO();
    io.emit('ordinanceSessionAssigned', updated.rows[0]);

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

    const existing = await Ordinance.findById(id);
    if (!existing.rows.length) { await client.query('ROLLBACK'); const e = new Error('Ordinance not found'); e.status = 404; throw e; }
    const ordinance = existing.rows[0];
    const stage = String(ordinance.reading_stage || '').toUpperCase();
    const hasAssignedSession = Number.isInteger(Number(ordinance.session_id_first_reading));
    const canProceedFromLegacySubmitted = stage === 'SUBMITTED' && hasAssignedSession;
    if (stage !== 'RECORD_SESSION' && !canProceedFromLegacySubmitted) {
      await client.query('ROLLBACK');
      const e = new Error('First Reading requires ordinance to be in RECORD_SESSION stage'); e.status = 400; throw e;
    }

    const normalizedSessionId = Number(sessionId || ordinance.session_id_first_reading);
    if (!Number.isInteger(normalizedSessionId) || normalizedSessionId <= 0) {
      await client.query('ROLLBACK');
      const e = new Error('Assign a session first before recording first reading'); e.status = 400; throw e;
    }

    const resolvedDiscussionNotes = buildReadingNotesWithRecording(discussionNotes, selectedRecordingUrl);

    await client.query(
      `UPDATE ordinances SET session_id_first_reading=$1, reading_stage='FIRST_READING', status='Under Review', updated_at=NOW() WHERE id=$2`,
      [normalizedSessionId, id]
    );
    const updated = await client.query('SELECT * FROM ordinances WHERE id=$1', [id]);
    await Ordinance.insertReadingSession(client, id, normalizedSessionId, 1, resolvedDiscussionNotes, presidingOfficer);
    await Ordinance.insertWorkflowAction(client, id, 'FIRST_READING', 'FIRST_READING', userId, resolvedDiscussionNotes || '');
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
exports.assignCommittee = async (id, committeeId, userId, meetingDetails = {}) => {
  // meetingDetails: { meeting_date, meeting_time, secretary_user_id, secretary_name, secretary_email }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await Ordinance.findById(id);
    if (!existing.rows.length) { await client.query('ROLLBACK'); const e = new Error('Ordinance not found'); e.status = 404; throw e; }
    const ordinance = existing.rows[0];
    const stage = (ordinance.reading_stage || '').toUpperCase();
    if (stage !== 'FIRST_READING') {
      await client.query('ROLLBACK');
      const currentStage = stage || 'DRAFT';
      const e = new Error(`Committee assignment requires ordinance to be in FIRST_READING stage. Current stage: ${currentStage}`); e.status = 400; throw e;
    }
    const targetStage = 'COMMITTEE_REVIEW';

    // 1. Ensure committee secretary exists (create if needed)
    let committeeSecretaryId = meetingDetails.secretary_user_id;
    if (!committeeSecretaryId && meetingDetails.secretary_email) {
      // Check if user exists
      const userRes = await client.query('SELECT id FROM users WHERE email=$1', [meetingDetails.secretary_email]);
      if (userRes.rows.length) {
        committeeSecretaryId = userRes.rows[0].id;
      } else {
        // Create new user with role 'Committee Secretary'
        const insertUser = await client.query(
          `INSERT INTO users (name, email, role_id, created_at) VALUES ($1, $2, (SELECT id FROM roles WHERE role_name='Committee Secretary' LIMIT 1), NOW()) RETURNING id`,
          [meetingDetails.secretary_name || 'Committee Secretary', meetingDetails.secretary_email]
        );
        committeeSecretaryId = insertUser.rows[0].id;
      }
      // Add as committee member if not already
      const cmRes = await client.query('SELECT id FROM committee_members WHERE committee_id=$1 AND user_id=$2', [committeeId, committeeSecretaryId]);
      if (!cmRes.rows.length) {
        await client.query(
          `INSERT INTO committee_members (committee_id, user_id, role, joined_at) VALUES ($1, $2, 'Committee Secretary', NOW())`,
          [committeeId, committeeSecretaryId]
        );
      }
    }

    // 2. Assign committee and set meeting details (store in ordinance or related table as needed)
    const updated = await Ordinance.assignCommittee(client, id, committeeId, userId, targetStage);

    await Ordinance.insertWorkflowAction(
      client, id, 'ASSIGN_COMMITTEE', targetStage, userId,
      `Assigned to committee ${committeeId}. Meeting: ${meetingDetails.meeting_date || ''} ${meetingDetails.meeting_time || ''}. Committee Secretary: ${committeeSecretaryId || ''}`
    );
    await AuditLog.create(client, userId, 'COMMITTEE_ASSIGNED', `Committee ${committeeId} assigned to "${ordinance.title}"`);
    const notifMsg = `Your ordinance "${ordinance.title}" has been assigned to a committee.`;
    await createNotification(ordinance.proposer_id, notifMsg);
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
  // Only committee chair or secretary can submit the report
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Automatically add ordinance to session agenda if not already present
    if (reportData.session_id) {
      const agendaRes = await client.query('SELECT * FROM session_agenda_items WHERE session_id = $1 AND ordinance_id = $2', [reportData.session_id, id]);
      if (!agendaRes.rows.length) {
        // Find the next agenda order
        const orderRes = await client.query('SELECT MAX(agenda_order) as max_order FROM session_agenda_items WHERE session_id = $1', [reportData.session_id]);
        const nextOrder = (orderRes.rows[0]?.max_order || 0) + 1;
        await client.query('INSERT INTO session_agenda_items (session_id, ordinance_id, agenda_order, reading_number, created_at) VALUES ($1, $2, $3, $4, NOW())', [reportData.session_id, id, nextOrder, 1]);
      }
    }

    const existing = await Ordinance.findById(id);
    if (!existing.rows.length) { await client.query('ROLLBACK'); const e = new Error('Ordinance not found'); e.status = 404; throw e; }
    const ordinance = existing.rows[0];
    if (!['COMMITTEE_REVIEW', 'COMMITTEE_REPORT_SUBMITTED'].includes(ordinance.reading_stage)) {
      await client.query('ROLLBACK');
      const e = new Error('Committee report requires ordinance to be in COMMITTEE_REVIEW or COMMITTEE_REPORT_SUBMITTED stage'); e.status = 400; throw e;
    }
    const reportTargetStage = 'COMMITTEE_REPORT_SUBMITTED';

    // Debug logging for permission check
    const committeeId = reportData.committee_id || ordinance.committee_id;
    console.log('[DEBUG] submitCommitteeReport:', {
      userId,
      committeeId,
      query: `SELECT id FROM committee_members WHERE committee_id=${committeeId} AND user_id=${userId} AND role IN (\'Chair\', \'Committee Secretary\')`
    });
    const roleRes = await client.query(
      `SELECT id, role FROM committee_members WHERE committee_id=$1 AND user_id=$2 AND role IN ('Chair', 'Committee Secretary')`,
      [committeeId, userId]
    );
    console.log('[DEBUG] committee_members query result:', roleRes.rows);
    if (!roleRes.rows.length) {
      await client.query('ROLLBACK');
      console.log('[DEBUG] Permission denied: user is not chair or secretary for committee', committeeId);
      const e = new Error('Only the committee chair or committee secretary can submit the committee report'); e.status = 403; throw e;
    }

    const latestEndedMeeting = await getLatestEndedCommitteeMeetingForOrdinance(client, id, committeeId);
    const resolvedMeetingDate = latestEndedMeeting?.meeting_date || reportData.meeting_date || null;
    const resolvedAttendees = latestEndedMeeting
      ? normalizeAttendeesValue(latestEndedMeeting.meeting_attendees)
      : normalizeAttendeesValue(reportData.attendees);
    const resolvedReportContent = appendMeetingRecordingLine(
      reportData.report_content,
      latestEndedMeeting?.recording_url
    );

    const report = await Ordinance.insertCommitteeReport(client, {
      ordinanceId: id,
      committeeId: reportData.committee_id || ordinance.committee_id,
      submittedBy: userId,
      recommendation: reportData.recommendation,
      reportContent: resolvedReportContent,
      meetingDate: resolvedMeetingDate,
      meetingMinutes: reportData.meeting_minutes,
      attendees: resolvedAttendees,
    });

    await client.query(
      `UPDATE ordinances SET committee_report_id=$1, reading_stage=$3, updated_at=NOW() WHERE id=$2`,
      [report.rows[0].id, id, reportTargetStage]
    );
    const updated = await client.query('SELECT * FROM ordinances WHERE id=$1', [id]);
    await Ordinance.insertWorkflowAction(client, id, 'COMMITTEE_REPORT', reportTargetStage, userId, `Recommendation: ${reportData.recommendation}`);
    await AuditLog.create(client, userId, reportTargetStage, `Committee report submitted for "${ordinance.title}"`);

    // Notify proposer
    await createNotification(ordinance.proposer_id, `Committee report submitted for your ordinance "${ordinance.title}". Recommendation: ${reportData.recommendation}`);

    // Notify all secretaries and admins
    const usersRes = await client.query(`SELECT u.id, r.role_name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE r.role_name IN ('Secretary', 'Admin')`);
    for (const user of usersRes.rows) {
      await createNotification(
        user.id,
        `Committee report was submitted for ordinance "${ordinance.title}". Recommendation: ${reportData.recommendation}`,
        { type: 'activity', title: 'Committee Report Submitted', relatedId: id, relatedType: 'ordinance' }
      );
    }

    // Notify Secretary for scheduling reading (real-time)
    const io = getIO();
    io.to('Secretary').emit('committeeReportSubmitted', { ordinance: updated.rows[0], report: report.rows[0] });

    await client.query('COMMIT');
    return { ordinance: updated.rows[0], report: report.rows[0] };
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
};

/**
 * Stage 5A: Secretary assigns session details before second reading.
 * Transitions: COMMITTEE_REPORT_SUBMITTED -> RECORD_SECOND_SESSION
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

    const existing = await Ordinance.findById(id);
    if (!existing.rows.length) {
      await client.query('ROLLBACK');
      const e = new Error('Ordinance not found');
      e.status = 404;
      throw e;
    }

    const ordinance = existing.rows[0];
    const currentStage = String(ordinance.reading_stage || '').toUpperCase();
    if (currentStage !== 'COMMITTEE_REPORT_SUBMITTED' && currentStage !== 'RECORD_SECOND_SESSION') {
      await client.query('ROLLBACK');
      const e = new Error('Second session assignment requires ordinance to be in COMMITTEE_REPORT_SUBMITTED stage');
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
      `UPDATE ordinances
       SET session_id_second_reading = $1,
           reading_stage = 'RECORD_SECOND_SESSION',
           status = 'Under Review',
           updated_at = NOW()
       WHERE id = $2`,
      [normalizedSessionId, id]
    );

    await Ordinance.insertWorkflowAction(client, id, 'ASSIGN_SECOND_SESSION', 'RECORD_SECOND_SESSION', userId, `Assigned to session ${normalizedSessionId}`);
    await AuditLog.create(client, userId, 'ASSIGN_SECOND_SESSION', `Session assigned for second reading of ordinance "${ordinance.title}"`);
    await createNotification(ordinance.proposer_id, `Your ordinance "${ordinance.title}" was assigned to a session for second reading.`);

    const updated = await client.query('SELECT * FROM ordinances WHERE id = $1', [id]);
    const io = getIO();
    io.emit('ordinanceSecondSessionAssigned', updated.rows[0]);

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

    const existing = await client.query('SELECT * FROM ordinances WHERE id = $1 FOR UPDATE', [id]);
    if (!existing.rows.length) {
      await client.query('ROLLBACK');
      const e = new Error('Ordinance not found');
      e.status = 404;
      throw e;
    }

    const ordinance = existing.rows[0];
    const currentStage = normalizeReadingStage(ordinance.reading_stage);

    const stageRules = readingPhase === 'first'
      ? {
        allowedStages: ['SUBMITTED', 'RECORD_SESSION'],
        fieldName: 'session_id_first_reading',
        targetStage: currentStage === 'SUBMITTED' ? 'RECORD_SESSION' : currentStage,
      }
      : {
        allowedStages: ['COMMITTEE_REPORT_SUBMITTED', 'RECORD_SECOND_SESSION'],
        fieldName: 'session_id_second_reading',
        targetStage: currentStage === 'COMMITTEE_REPORT_SUBMITTED' ? 'RECORD_SECOND_SESSION' : currentStage,
      };

    if (!stageRules.allowedStages.includes(currentStage)) {
      await client.query('ROLLBACK');
      const e = new Error(`Cannot override ${readingPhase} reading session while ordinance is in ${currentStage} stage`);
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

    const previousSessionId = ordinance[stageRules.fieldName] || null;
    await client.query(
      `UPDATE ordinances
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

    await Ordinance.insertWorkflowAction(
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
      `Admin corrected ${readingPhase} reading session for ordinance "${ordinance.title}" from ${previousSessionId || 'none'} to ${normalizedSessionId}. Reason: ${reason}`
    );
    await createNotification(
      ordinance.proposer_id,
      `An administrator corrected the ${readingPhase} reading session assignment for your ordinance "${ordinance.title}".`
    );

    const updated = await client.query('SELECT * FROM ordinances WHERE id = $1', [id]);
    const io = getIO();
    io.emit('ordinanceWorkflowCorrected', updated.rows[0]);

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

    const existing = await client.query('SELECT * FROM ordinances WHERE id = $1 FOR UPDATE', [id]);
    if (!existing.rows.length) {
      await client.query('ROLLBACK');
      const e = new Error('Ordinance not found');
      e.status = 404;
      throw e;
    }

    const ordinance = existing.rows[0];
    const currentStage = normalizeReadingStage(ordinance.reading_stage);

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
      `UPDATE ordinances
       SET reading_stage = $1,
           status = $2,
           session_id_first_reading = CASE WHEN $3 THEN NULL ELSE session_id_first_reading END,
           session_id_second_reading = CASE WHEN $4 THEN NULL ELSE session_id_second_reading END,
           updated_at = NOW()
       WHERE id = $5`,
      [targetStage, resolveStatusForStage(targetStage), clearFirstSession, clearSecondSession, id]
    );

    await Ordinance.insertWorkflowAction(
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
      `Admin corrected workflow stage for ordinance "${ordinance.title}" from ${currentStage} to ${targetStage}. Reason: ${reason}`
    );
    await createNotification(
      ordinance.proposer_id,
      `An administrator corrected the workflow stage for your ordinance "${ordinance.title}".`
    );

    const updated = await client.query('SELECT * FROM ordinances WHERE id = $1', [id]);
    const io = getIO();
    io.emit('ordinanceWorkflowCorrected', updated.rows[0]);

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
exports.conductSecondReading = async (id, sessionId, discussionNotes, presidingOfficer, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await Ordinance.findById(id);
    if (!existing.rows.length) { await client.query('ROLLBACK'); const e = new Error('Ordinance not found'); e.status = 404; throw e; }
    const ordinance = existing.rows[0];
    const stage = String(ordinance.reading_stage || '').toUpperCase();
    const hasAssignedSecondSession = Number.isInteger(Number(ordinance.session_id_second_reading));
    const canProceedFromLegacyCommitteeReport = stage === 'COMMITTEE_REPORT_SUBMITTED' && hasAssignedSecondSession;
    if (stage !== 'RECORD_SECOND_SESSION' && !canProceedFromLegacyCommitteeReport) {
      await client.query('ROLLBACK');
      const e = new Error('Second Reading requires ordinance to be in RECORD_SECOND_SESSION stage'); e.status = 400; throw e;
    }

    const normalizedSessionId = Number(sessionId || ordinance.session_id_second_reading);
    if (!Number.isInteger(normalizedSessionId) || normalizedSessionId <= 0) {
      await client.query('ROLLBACK');
      const e = new Error('Assign a session first before recording second reading'); e.status = 400; throw e;
    }

    await client.query(
      `UPDATE ordinances SET session_id_second_reading=$1, reading_stage='SECOND_READING', updated_at=NOW() WHERE id=$2`,
      [normalizedSessionId, id]
    );
    const updated = await client.query('SELECT * FROM ordinances WHERE id=$1', [id]);
    await Ordinance.insertReadingSession(client, id, normalizedSessionId, 2, discussionNotes, presidingOfficer);
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
 * Stage 6a: Secretary opens electronic voting for third reading.
 * Transitions: SECOND_READING → THIRD_READING_VOTING
 */
exports.openThirdReadingVote = async (id, sessionId, presidingOfficer, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await Ordinance.findById(id);
    if (!existing.rows.length) { await client.query('ROLLBACK'); const e = new Error('Ordinance not found'); e.status = 404; throw e; }
    const ordinance = existing.rows[0];
    if (ordinance.reading_stage !== 'SECOND_READING') {
      await client.query('ROLLBACK');
      const e = new Error('Opening voting requires ordinance to be in SECOND_READING stage'); e.status = 400; throw e;
    }

    // Check if there's already an active voting session for this ordinance
    const existingSession = await client.query(
      `SELECT id FROM voting_sessions WHERE ordinance_id = $1 AND status = 'active'`, [id]
    );
    if (existingSession.rows.length) {
      await client.query('ROLLBACK');
      const e = new Error('There is already an active voting session for this ordinance'); e.status = 400; throw e;
    }

    // Create a voting session
    const vsRes = await client.query(
      `INSERT INTO voting_sessions (title, description, ordinance_id, question, voting_type, created_by, status, created_at)
       VALUES ($1, $2, $3, $4, 'yes_no_abstain', $5, 'active', NOW()) RETURNING *`,
      [
        `Third Reading Vote: ${ordinance.title}`,
        `Electronic voting for the third reading of "${ordinance.title}"`,
        id,
        `Do you approve the proposed ordinance "${ordinance.title}"?`,
        userId
      ]
    );
    const votingSession = vsRes.rows[0];

    // Transition ordinance to THIRD_READING_VOTING
    await client.query(
      `UPDATE ordinances SET reading_stage='THIRD_READING_VOTING', session_id_third_reading=$1, updated_at=NOW() WHERE id=$2`,
      [sessionId || null, id]
    );
    const updated = await client.query('SELECT * FROM ordinances WHERE id=$1', [id]);

    await Ordinance.insertWorkflowAction(client, id, 'OPEN_THIRD_READING_VOTE', 'THIRD_READING_VOTING', userId,
      `Electronic voting opened. Session: ${votingSession.id}`);
    await AuditLog.create(client, userId, 'OPEN_THIRD_READING_VOTE', `Third reading voting opened for "${ordinance.title}"`);

    // Notify all councilors
    const councilors = await client.query(
      `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.role_name = 'Councilor'`
    );
    for (const c of councilors.rows) {
      await createNotification(c.id, `Voting is now open for "${ordinance.title}". Please cast your vote.`);
    }

    const io = getIO();
    io.emit('thirdReadingVoteOpened', { ordinance: updated.rows[0], votingSession });

    await client.query('COMMIT');
    return { ordinance: updated.rows[0], votingSession };
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
};

/**
 * Stage 6b: Councilor casts their vote in the third reading.
 */
exports.castThirdReadingVote = async (ordinanceId, voteOption, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await Ordinance.findById(ordinanceId);
    if (!existing.rows.length) { await client.query('ROLLBACK'); const e = new Error('Ordinance not found'); e.status = 404; throw e; }
    const ordinance = existing.rows[0];
    if (ordinance.reading_stage !== 'THIRD_READING_VOTING') {
      await client.query('ROLLBACK');
      const e = new Error('Voting is not currently open for this ordinance'); e.status = 400; throw e;
    }

    // Find the active voting session
    const vsRes = await client.query(
      `SELECT * FROM voting_sessions WHERE ordinance_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1`, [ordinanceId]
    );
    if (!vsRes.rows.length) {
      await client.query('ROLLBACK');
      const e = new Error('No active voting session found'); e.status = 400; throw e;
    }
    const session = vsRes.rows[0];

    // Validate vote option
    const allowed = ['Yes', 'No', 'Abstain'];
    if (!allowed.includes(voteOption)) {
      await client.query('ROLLBACK');
      const e = new Error(`Invalid vote option. Allowed: ${allowed.join(', ')}`); e.status = 400; throw e;
    }

    // Check if already voted
    const existingVote = await client.query(
      'SELECT id FROM votes WHERE session_id = $1 AND user_id = $2', [session.id, userId]
    );
    if (existingVote.rows.length) {
      await client.query('ROLLBACK');
      const e = new Error('You have already cast your vote'); e.status = 400; throw e;
    }

    // Cast the vote
    await client.query(
      `INSERT INTO votes (session_id, user_id, vote_option, voted_at) VALUES ($1, $2, $3, NOW()) RETURNING *`,
      [session.id, userId, voteOption]
    );

    await AuditLog.create(client, userId, 'CAST_VOTE', `Voted "${voteOption}" on "${ordinance.title}"`);

    // Get updated results
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
    io.emit('thirdReadingVoteCast', {
      ordinance_id: ordinanceId,
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
 * Get current voting status for an ordinance's third reading.
 */
exports.getThirdReadingVotingStatus = async (ordinanceId, userId) => {
  const vsRes = await pool.query(
    `SELECT * FROM voting_sessions WHERE ordinance_id = $1 ORDER BY created_at DESC LIMIT 1`, [ordinanceId]
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
 * Stage 6c: Secretary closes electronic voting and records the result.
 * Transitions: THIRD_READING_VOTING → THIRD_READING_VOTED (or REJECTED)
 */
exports.closeThirdReadingVote = async (id, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await Ordinance.findById(id);
    if (!existing.rows.length) { await client.query('ROLLBACK'); const e = new Error('Ordinance not found'); e.status = 404; throw e; }
    const ordinance = existing.rows[0];
    if (ordinance.reading_stage !== 'THIRD_READING_VOTING') {
      await client.query('ROLLBACK');
      const e = new Error('Closing voting requires ordinance to be in THIRD_READING_VOTING stage'); e.status = 400; throw e;
    }

    // Find the active voting session
    const vsRes = await client.query(
      `SELECT * FROM voting_sessions WHERE ordinance_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1`, [id]
    );
    if (!vsRes.rows.length) {
      await client.query('ROLLBACK');
      const e = new Error('No active voting session found'); e.status = 400; throw e;
    }
    const session = vsRes.rows[0];

    // Close the voting session
    await client.query(`UPDATE voting_sessions SET status = 'closed', closed_at = NOW() WHERE id = $1`, [session.id]);

    // Tally the votes
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

    const sessionId = ordinance.session_id_third_reading;
    if (passed) {
      await Ordinance.recordVote(client, id, votingResults, sessionId);
    } else {
      await client.query(
        `UPDATE ordinances SET voting_results=$1, voted_at=NOW(),
         reading_stage='REJECTED', status='Rejected', updated_at=NOW() WHERE id=$2`,
        [JSON.stringify(votingResults), id]
      );
    }
    const updated = await client.query('SELECT * FROM ordinances WHERE id=$1', [id]);

    await Ordinance.insertReadingSession(client, id, sessionId, 3, `Yes:${yesCount} No:${noCount} Abstain:${abstainCount}`, null);
    await Ordinance.insertWorkflowAction(client, id, 'CLOSE_THIRD_READING_VOTE', passed ? 'THIRD_READING_VOTED' : 'REJECTED', userId,
      `Yes:${yesCount} No:${noCount} Abstain:${abstainCount} — ${passed ? 'PASSED' : 'FAILED'}`);
    await AuditLog.create(client, userId, 'CLOSE_THIRD_READING_VOTE', `Third reading vote for "${ordinance.title}": ${passed ? 'Passed' : 'Failed'} (Yes:${yesCount} No:${noCount} Abstain:${abstainCount})`);
    await createNotification(ordinance.proposer_id,
      `Third reading vote for your ordinance "${ordinance.title}" ${passed ? 'PASSED' : 'FAILED'} (Yes:${yesCount} No:${noCount} Abstain:${abstainCount}).`);

    const io = getIO();
    io.emit('thirdReadingVoteClosed', { ordinance: updated.rows[0], passed, votingResults });

    await client.query('COMMIT');
    return { ordinance: updated.rows[0], passed, votingResults };
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
};

/**
 * Stage 7a: Vice Mayor/Mayor approves ordinance.
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
 * Stage 7b: Vice Mayor/Mayor rejects ordinance.
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
  const ordinance = await Ordinance.findById(id);

  if (!ordinance.rows.length) {
    const e = new Error('Ordinance not found'); e.status = 404; throw e;
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
    safeQuery(() => Ordinance.findReadingSessions(id), []),
    safeQuery(() => Ordinance.findHistory(id), []),
  ]);

  const ord = ordinance.rows[0];
  let committeeReport = null;
  let postingRecords = [];
  let linkedSessionRecordings = [];

  // Fetch and attach full committee object if committee_id is present
  let committee = undefined;
  if (ord.committee_id) {
    // Use the helper to get committee with members and chair_id
    const { getCommitteeWithMembers } = require('../utils/committeesHelper');
    committee = await getCommitteeWithMembers(ord.committee_id);
  }
  ord.committee = committee;

  if (ord.committee_report_id) {
    const reportRows = await safeQuery(() => Ordinance.findCommitteeReport(id), []);
    committeeReport = reportRows[0] || null;
  }

  postingRecords = await safeQuery(() => Ordinance.findPostingRecords(id), []);

  const linkedSessionId = Number(ord?.session_id_first_reading);
  if (Number.isInteger(linkedSessionId) && linkedSessionId > 0) {
    const linkedRecordingRows = await safeQuery(
      () => SessionRecording.findBySessionId(linkedSessionId),
      []
    );
    linkedSessionRecordings = linkedRecordingRows;
  }

  return {
    ordinance: ord,
    readings: readingsRows,
    committeeReport,
    postingRecords,
    linkedSessionRecordings,
    history: historyRows,
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

  const [sessionRes, ordinanceRes] = await Promise.all([
    pool.query('SELECT title FROM sessions WHERE id = $1', [sessionId]),
    Ordinance.findById(ordinanceId),
  ]);

  const sessionTitle = sessionRes.rows[0]?.title || `Session #${sessionId}`;
  const ordinance = ordinanceRes.rows[0];

  if (ordinance) {
    const involvedUserIds = new Set([
      Number(ordinance.proposer_id),
      ...parseCoAuthorIds(ordinance.co_authors),
    ].filter((id) => Number.isInteger(id) && id > 0));

    for (const userId of involvedUserIds) {
      await ensureSessionParticipant(sessionId, userId);
    }

    for (const userId of involvedUserIds) {
      await createNotification(
        userId,
        `Your ordinance "${ordinance.title}" has been included in the agenda for "${sessionTitle}".`,
        {
          type: 'session',
          title: 'Scheduled In Session',
          relatedId: Number(sessionId),
          relatedType: 'session',
        }
      );
    }
  }

  return result.rows[0];
};

/**
 * Add a resolution to a session agenda.
 */
exports.addResolutionAgendaItem = async (sessionId, resolutionId, agendaOrder, readingNumber) => {
  const result = await Ordinance.upsertResolutionAgendaItem(sessionId, resolutionId, agendaOrder, readingNumber);

  const [sessionRes, resolutionRes] = await Promise.all([
    pool.query('SELECT title FROM sessions WHERE id = $1', [sessionId]),
    Resolution.findById(resolutionId),
  ]);

  const sessionTitle = sessionRes.rows[0]?.title || `Session #${sessionId}`;
  const resolution = resolutionRes.rows[0];

  if (resolution) {
    const involvedUserIds = new Set([
      Number(resolution.proposer_id),
      ...parseCoAuthorIds(resolution.co_authors),
    ].filter((id) => Number.isInteger(id) && id > 0));

    for (const userId of involvedUserIds) {
      await ensureSessionParticipant(sessionId, userId);
    }

    for (const userId of involvedUserIds) {
      await createNotification(
        userId,
        `Your resolution "${resolution.title}" has been included in the agenda for "${sessionTitle}".`,
        {
          type: 'session',
          title: 'Scheduled In Session',
          relatedId: Number(sessionId),
          relatedType: 'session',
        }
      );
    }
  }

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
 * Remove a resolution from a session agenda.
 */
exports.removeResolutionAgendaItem = async (sessionId, resolutionId) => {
  const result = await Ordinance.removeResolutionAgendaItem(sessionId, resolutionId);
  return result.rows[0] || null;
};

/**
 * Get all sessions an ordinance is scheduled in (via agenda items).
 */
exports.getOrdinanceSessions = async (ordinanceId) => {
  const result = await Ordinance.findSessionsByOrdinance(ordinanceId);
  return result.rows;
};
