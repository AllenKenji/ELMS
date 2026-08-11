const fs = require('fs/promises');
const path = require('path');
const pool = require('../db');
const Session = require('../models/Session');
const SessionMinutes = require('../models/SessionMinutes');
const SessionRecording = require('../models/SessionRecording');
const AuditLog = require('../models/AuditLog');
const Ordinance = require('../models/Ordinance');
const Committee = require('../models/Committee');
const { createNotification } = require('../utils/notifications');
const { getIO } = require('../socket');

const ROLES = ['Secretary', 'Admin', 'Councilor', 'Vice Mayor', 'Resident'];
const SESSION_RECORDING_UPLOAD_PREFIX = '/uploads/session-recordings/';

function emitSessionParticipantsUpdated(sessionId) {
  try {
    const io = getIO();
    io.emit('sessionParticipantsUpdated', { sessionId: Number(sessionId) });
  } catch {
    // Non-fatal: live participant refresh events should not block workflow operations.
  }
}

async function inviteAllCouncilorsToSession(sessionId, sessionTitle, trackedUserIds = null) {
  const councilorsResult = await pool.query(
    `SELECT u.id
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE LOWER(r.role_name) = 'councilor'`
  );

  const invitedUserIds = [];

  for (const councilor of councilorsResult.rows || []) {
    const councilorUserId = Number(councilor.id);
    if (!Number.isInteger(councilorUserId) || councilorUserId <= 0) {
      continue;
    }
    if (trackedUserIds?.has(councilorUserId)) {
      continue;
    }

    const addResult = await Session.addParticipant(sessionId, councilorUserId);
    if (!addResult.rows.length) {
      continue;
    }

    invitedUserIds.push(councilorUserId);
    if (trackedUserIds) {
      trackedUserIds.add(councilorUserId);
    }

    await createNotification(
      councilorUserId,
      `You have been invited to session: "${sessionTitle}"`,
      {
        type: 'session',
        title: 'Session Invitation',
        relatedId: Number(sessionId),
        relatedType: 'session',
      }
    );
  }

  return invitedUserIds;
}

function normalizeSessionSchedule(dateValue, timeValue) {
  const rawDate = dateValue == null ? '' : String(dateValue).trim();
  let normalizedDate = rawDate;
  let normalizedTime = timeValue == null ? null : String(timeValue).trim();

  if (rawDate.includes('T')) {
    const [datePart, timePart] = rawDate.split('T');
    if (datePart) {
      normalizedDate = datePart;
    }
    if (!normalizedTime && timePart) {
      const hhmm = timePart.match(/^(\d{2}:\d{2})/);
      normalizedTime = hhmm?.[1] || null;
    }
  }

  if (normalizedTime && /^\d{2}:\d{2}:\d{2}$/.test(normalizedTime)) {
    normalizedTime = normalizedTime.slice(0, 5);
  }

  return {
    date: normalizedDate,
    sessionTime: normalizedTime || null,
  };
}

/**
 * Utility: broadcast session updates to all roles
 */
const broadcast = (event, payload) => {
  const io = getIO();
  ROLES.forEach(role => io.to(role).emit(event, payload));
};

/**
 * Utility: ensure rows exist
 */
const ensureFound = (rows, message = 'Record not found', status = 404) => {
  if (!rows || rows.length === 0) {
    const err = new Error(message);
    err.status = status;
    throw err;
  }
};

function resolveUploadAbsolutePath(relativePath) {
  if (!relativePath || !String(relativePath).startsWith(SESSION_RECORDING_UPLOAD_PREFIX)) {
    return null;
  }

  const relativeFilePath = String(relativePath).replace(/^\/uploads\//, 'uploads/');
  return path.join(__dirname, '..', relativeFilePath);
}

async function deleteSessionRecordingFile(relativePath) {
  const absolutePath = resolveUploadAbsolutePath(relativePath);
  if (!absolutePath) {
    return;
  }

  await fs.unlink(absolutePath).catch(() => {});
}

/**
 * Get all committee reports for a session: show all committee reports for all ordinances, regardless of agenda.
 */
exports.getSessionCommitteeReports = async (sessionId) => {
  // Get all ordinances
  const allOrdinancesRes = await Ordinance.findAll();
  const ordinances = allOrdinancesRes.rows || [];
  const reports = [];

  for (const ord of ordinances) {
    const repRes = await Ordinance.findCommitteeReport(ord.id);
    if (repRes.rows?.length) {
      reports.push({
        ...repRes.rows[0],
        ordinance: {
          id: ord.id,
          title: ord.title,
          ordinance_number: ord.ordinance_number,
          reading_stage: ord.reading_stage,
          status: ord.status,
          proposer_name: ord.proposer_name,
          description: ord.description
        }
      });
    }
  }

  return reports;
};

/**
 * Create a new legislative session.
 */
exports.createSession = async ({ title, date, time, session_time, location, agenda, notes }, userId) => {
  const schedule = normalizeSessionSchedule(date, time ?? session_time);
  const result = await Session.create(
    title,
    schedule.date,
    schedule.sessionTime,
    location,
    agenda,
    notes,
    userId
  );
  const session = result.rows[0];

  await AuditLog.create(null, userId, 'SESSION_CREATE', `Session "${title}" created`);
  await createNotification(userId, `Session "${title}" has been created.`);
  await inviteAllCouncilorsToSession(session.id, session.title);
  emitSessionParticipantsUpdated(session.id);

  broadcast('newSession', session);
  broadcast('sessionCreated', session);

  return session;
};

/**
 * Retrieve all sessions.
 */
exports.getAllSessions = async () => {
  const result = await Session.findAll();
  return result.rows;
};

/**
 * Retrieve a single session by ID.
 */
exports.getSessionById = async (id) => {
  const result = await Session.findById(id);
  ensureFound(result.rows, 'Session not found');
  return result.rows[0];
};

/**
 * Update a session.
 */
exports.updateSession = async (id, { title, date, time, session_time, location, agenda, notes }, userId) => {
  const schedule = normalizeSessionSchedule(date, time ?? session_time);
  const result = await Session.update(id, title, schedule.date, schedule.sessionTime, location, agenda, notes);
  ensureFound(result.rows, 'Session not found');

  const session = result.rows[0];
  await AuditLog.create(null, userId, 'SESSION_UPDATE', `Session "${title}" updated`);
  await createNotification(userId, `Session "${title}" has been updated.`);

  const participantsResult = await Session.findParticipants(id);
  const participantIds = new Set(
    (participantsResult.rows || [])
      .map((participant) => Number(participant.id))
      .filter((participantId) => Number.isInteger(participantId) && participantId > 0 && participantId !== Number(userId))
  );

  for (const participantId of participantIds) {
    await createNotification(
      participantId,
      `Session "${session.title}" has been updated. Please review the latest schedule and agenda.`,
      {
        type: 'session',
        title: 'Session Updated',
        relatedId: Number(id),
        relatedType: 'session',
      }
    );
  }

  broadcast('sessionUpdated', session);
  return session;
};

/**
 * Delete a session and its related records.
 */
exports.deleteSession = async (id, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT * FROM sessions WHERE id = $1', [id]);
    ensureFound(existing.rows, 'Session not found');

    await client.query('DELETE FROM session_minutes WHERE session_id = $1', [id]);
    await Session.deleteParticipants(client, id);
    await Session.deleteById(client, id);
    await AuditLog.create(client, userId, 'SESSION_DELETE', `Session "${existing.rows[0].title}" deleted`);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Get all ordinances for a session.
 */
exports.getSessionOrdinances = async (sessionId) => {
  const result = await Session.findOrdinancesBySessionId(sessionId);
  return result.rows;
};

/**
 * Get participants for a session.
 */
exports.getParticipants = async (sessionId) => {
  const result = await Session.findParticipants(sessionId);
  return result.rows;
};

/**
 * Add a participant to a session.
 */
exports.addParticipant = async (sessionId, userId) => {
  const result = await Session.addParticipant(sessionId, userId);
  ensureFound(result.rows, 'Participant already added', 400);

  const sessionResult = await pool.query('SELECT title FROM sessions WHERE id = $1', [sessionId]);
  await createNotification(userId, `You have been added to session: "${sessionResult.rows[0]?.title}"`);

  emitSessionParticipantsUpdated(sessionId);

  return result.rows[0];
};

/**
 * Allow the authenticated user to join a session as a participant.
 */
exports.joinSession = async (sessionId, userId) => {
  const sessionResult = await pool.query('SELECT id, title FROM sessions WHERE id = $1', [sessionId]);
  ensureFound(sessionResult.rows, 'Session not found');

  const existingParticipantResult = await pool.query(
    'SELECT * FROM session_participants WHERE session_id = $1 AND user_id = $2',
    [sessionId, userId]
  );

  if (existingParticipantResult.rows.length > 0) {
    const existingParticipant = existingParticipantResult.rows[0];
    const currentStatus = String(existingParticipant.attendance_status || '').trim().toLowerCase();

    if (currentStatus === 'pending') {
      const updated = await Session.updateParticipantAttendance(sessionId, userId, 'Present');
      ensureFound(updated.rows, 'Participant not found');

      await createNotification(userId, `You have joined session: "${sessionResult.rows[0].title}"`);
      emitSessionParticipantsUpdated(sessionId);
      return updated.rows[0];
    }

    const alreadyJoinedErr = new Error('You are already a participant in this session');
    alreadyJoinedErr.status = 400;
    throw alreadyJoinedErr;
  }

  const result = await Session.addParticipant(sessionId, userId);
  ensureFound(result.rows, 'You are already a participant in this session', 400);

  const updated = await Session.updateParticipantAttendance(sessionId, userId, 'Present');
  ensureFound(updated.rows, 'Participant not found');

  await createNotification(userId, `You have joined session: "${sessionResult.rows[0].title}"`);
  emitSessionParticipantsUpdated(sessionId);

  return updated.rows[0];
};

/**
 * Update a participant's attendance status.
 */
exports.updateParticipantAttendance = async (sessionId, userId, attendanceStatus) => {
  const result = await Session.updateParticipantAttendance(sessionId, userId, attendanceStatus);
  ensureFound(result.rows, 'Participant not found');
  emitSessionParticipantsUpdated(sessionId);
  return result.rows[0];
};

/**
 * Get all meeting minutes for a session.
 */
exports.getSessionMinutes = async (sessionId) => {
  const result = await Session.findMinutesBySessionId(sessionId);
  return result.rows;
};

exports.getSessionRecordings = async (sessionId) => {
  const normalizedSessionId = Number(sessionId);
  if (!Number.isInteger(normalizedSessionId) || normalizedSessionId <= 0) {
    const err = new Error('A valid session id is required');
    err.status = 400;
    throw err;
  }

  const result = await SessionRecording.findBySessionId(normalizedSessionId);
  return result.rows || [];
};

exports.saveSessionRecording = async (sessionId, file, userId, minutesId = null) => {
  const relativePath = file ? `${SESSION_RECORDING_UPLOAD_PREFIX}${file.filename}` : null;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const sessionResult = await client.query(
      'SELECT id, title, date FROM sessions WHERE id = $1',
      [sessionId]
    );
    ensureFound(sessionResult.rows, 'Session not found');
    const session = sessionResult.rows[0];

    let minutesRecord = null;

    if (minutesId) {
      const selectedMinutesResult = await client.query(
        'SELECT * FROM session_minutes WHERE id = $1 AND session_id = $2 FOR UPDATE',
        [minutesId, sessionId]
      );
      ensureFound(selectedMinutesResult.rows, 'Selected session minutes record was not found for this session', 400);
      minutesRecord = selectedMinutesResult.rows[0];
    } else {
      const minutesResult = await SessionMinutes.findLatestBySessionId(sessionId, client);
      minutesRecord = minutesResult.rows[0] || null;
    }

    if (!minutesRecord) {
      const createdMinutes = await SessionMinutes.create(
        `${session.title} Minutes`,
        session.date || null,
        null,
        '',
        userId,
        sessionId
      );
      minutesRecord = createdMinutes.rows[0];
    }

    await SessionRecording.create(
      {
        sessionId,
        minutesId: minutesRecord.id,
        recordingUrl: relativePath,
        recordingOriginalName: file?.originalname || null,
        uploadedBy: userId,
      },
      client
    );

    await SessionMinutes.updateRecording(
      minutesRecord.id,
      relativePath,
      file?.originalname || null,
      userId,
      client
    );

    await AuditLog.create(client, userId, 'SESSION_RECORDING_UPLOADED', `Recording uploaded for session ID ${sessionId}`);
    await client.query('COMMIT');

    const updatedMinutesResult = await SessionMinutes.findById(minutesRecord.id);
    return updatedMinutesResult.rows[0] || null;
  } catch (err) {
    await client.query('ROLLBACK');
    if (relativePath) {
      await deleteSessionRecordingFile(relativePath);
    }
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Auto-populate session participants from an OOB document.
 * Adds: presiding officer, secretary (by name match), and all members
 * of committees referenced in committee report items.
 * Sends notifications to each added participant.
 */
exports.addParticipantsFromOobDocument = async (sessionId, oobDocumentId, requestUserId) => {
  // 1. Fetch OOB document
  const docResult = await pool.query('SELECT * FROM order_of_business_documents WHERE id = $1', [oobDocumentId]);
  if (!docResult.rows.length) {
    const err = new Error('Order of Business document not found');
    err.status = 404;
    throw err;
  }
  const doc = docResult.rows[0];

  // 2. Fetch session title
  const sessionResult = await pool.query('SELECT title FROM sessions WHERE id = $1', [sessionId]);
  if (!sessionResult.rows.length) {
    const err = new Error('Session not found');
    err.status = 404;
    throw err;
  }
  const sessionTitle = sessionResult.rows[0].title;

  const addedUserIds = new Set();

  // Helper: add a participant and notify
  const addAndNotify = async (userId, role) => {
    if (!userId || addedUserIds.has(userId)) return;
    try {
      const result = await Session.addParticipant(sessionId, userId);
      if (result.rows.length > 0) {
        addedUserIds.add(userId);
        await createNotification(userId,
          `You have been added as ${role} to session: "${sessionTitle}"`,
          {
            type: 'session',
            title: 'Session Participation',
            relatedId: sessionId,
            relatedType: 'session',
          }
        );
      }
    } catch {
      // ON CONFLICT DO NOTHING — participant may already exist
    }
  };

  // 3. Add presiding officer by name match
  if (doc.presiding_officer) {
    const userRes = await pool.query(
      'SELECT id FROM users WHERE LOWER(name) = LOWER($1) LIMIT 1',
      [doc.presiding_officer.trim()]
    );
    if (userRes.rows.length) {
      await addAndNotify(userRes.rows[0].id, 'Presiding Officer');
    }
  }

  // 4. Add secretary by name match
  if (doc.secretary) {
    const userRes = await pool.query(
      'SELECT id FROM users WHERE LOWER(name) = LOWER($1) LIMIT 1',
      [doc.secretary.trim()]
    );
    if (userRes.rows.length) {
      await addAndNotify(userRes.rows[0].id, 'Secretary');
    }
  }

  // Ensure all councilor accounts are invited participants for the session.
  await inviteAllCouncilorsToSession(sessionId, sessionTitle, addedUserIds);

  // 5. Get committee report items from the document
  const itemsResult = await pool.query(
    `SELECT related_document_id, related_document_type
     FROM order_of_business
     WHERE document_id = $1
       AND item_type = 'Committee Reports'
       AND related_document_type = 'ordinance'
       AND related_document_id IS NOT NULL`,
    [oobDocumentId]
  );

  // 6. For each referenced ordinance, find its committee and add all members
  const processedCommittees = new Set();
  for (const item of itemsResult.rows) {
    // Get committee report to find committee_id
    const crResult = await Ordinance.findCommitteeReport(item.related_document_id);
    if (!crResult.rows.length) continue;

    const committeeId = crResult.rows[0].committee_id;
    if (!committeeId || processedCommittees.has(committeeId)) continue;
    processedCommittees.add(committeeId);

    // Get all members of this committee
    const membersResult = await Committee.findMembers(committeeId);
    for (const member of membersResult.rows) {
      await addAndNotify(member.user_id, `Committee Member (${member.role})`);
    }
  }

  // 7. Also add the user who initiated this
  await addAndNotify(requestUserId, 'Session Creator');

  await AuditLog.create(null, requestUserId, 'SESSION_PARTICIPANTS_AUTO',
    `Auto-added ${addedUserIds.size} participants to session "${sessionTitle}" from OOB document "${doc.title}"`);

  emitSessionParticipantsUpdated(sessionId);

  return { added_count: addedUserIds.size, user_ids: Array.from(addedUserIds) };
};

/**
 * One-time backfill: ensure all councilor accounts are participants
 * for all existing sessions.
 */
exports.backfillCouncilorsForExistingSessions = async (requestUserId) => {
  const normalizedRequestUserId = Number(requestUserId);
  if (!Number.isInteger(normalizedRequestUserId) || normalizedRequestUserId <= 0) {
    const err = new Error('A valid request user id is required for backfill');
    err.status = 400;
    throw err;
  }

  const sessionsResult = await pool.query(
    `SELECT id, title
     FROM sessions
     ORDER BY id ASC`
  );

  let totalAdded = 0;
  const sessionsUpdated = [];

  for (const session of sessionsResult.rows || []) {
    const sessionId = Number(session.id);
    if (!Number.isInteger(sessionId) || sessionId <= 0) {
      continue;
    }

    const invitedUserIds = await inviteAllCouncilorsToSession(
      sessionId,
      session.title || `Session #${sessionId}`
    );

    if (invitedUserIds.length > 0) {
      totalAdded += invitedUserIds.length;
      sessionsUpdated.push({
        session_id: sessionId,
        session_title: session.title || null,
        added_count: invitedUserIds.length,
      });
      emitSessionParticipantsUpdated(sessionId);
    }
  }

  await AuditLog.create(
    null,
    normalizedRequestUserId,
    'SESSION_COUNCILOR_PARTICIPANTS_BACKFILL',
    `Backfilled councilor participants for ${sessionsUpdated.length} sessions; total participants added: ${totalAdded}`
  );

  return {
    sessions_checked: sessionsResult.rows.length,
    sessions_updated: sessionsUpdated.length,
    participants_added: totalAdded,
    details: sessionsUpdated,
  };
};
