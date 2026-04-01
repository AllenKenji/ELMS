const pool = require('../db');
const Session = require('../models/Session');
const AuditLog = require('../models/AuditLog');
const Ordinance = require('../models/Ordinance');
const { createNotification } = require('../utils/notifications');
const { getIO } = require('../socket');

const ROLES = ['Secretary', 'Admin', 'Councilor', 'Vice Mayor', 'Resident'];

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
exports.createSession = async ({ title, date, location, agenda, notes }, userId) => {
  const result = await Session.create(title, date, location, agenda, notes, userId);
  const session = result.rows[0];

  await AuditLog.create(null, userId, 'SESSION_CREATE', `Session "${title}" created`);
  await createNotification(userId, `Session "${title}" has been created.`);

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
exports.updateSession = async (id, { title, date, location, agenda, notes }, userId) => {
  const result = await Session.update(id, title, date, location, agenda, notes);
  ensureFound(result.rows, 'Session not found');

  const session = result.rows[0];
  await AuditLog.create(null, userId, 'SESSION_UPDATE', `Session "${title}" updated`);
  await createNotification(userId, `Session "${title}" has been updated.`);

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

  return result.rows[0];
};

/**
 * Update a participant's attendance status.
 */
exports.updateParticipantAttendance = async (sessionId, userId, attendanceStatus) => {
  const result = await Session.updateParticipantAttendance(sessionId, userId, attendanceStatus);
  ensureFound(result.rows, 'Participant not found');
  return result.rows[0];
};

/**
 * Get all meeting minutes for a session.
 */
exports.getSessionMinutes = async (sessionId) => {
  const result = await Session.findMinutesBySessionId(sessionId);
  return result.rows;
};
