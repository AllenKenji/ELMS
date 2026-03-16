/**
 * Session Service - Business logic for legislative session operations.
 */
const pool = require('../db');
const Session = require('../models/Session');
const AuditLog = require('../models/AuditLog');
const { createNotification } = require('../utils/notifications');
const { getIO } = require('../socket');

/**
 * Create a new legislative session.
 * @param {object} data
 * @param {number} userId
 * @returns {Promise<object>}
 */
exports.createSession = async ({ title, date, location, agenda, notes }, userId) => {
  const result = await Session.create(title, date, location, agenda, notes, userId);
  const session = result.rows[0];

  await AuditLog.create(null, userId, 'SESSION_CREATE', `Session "${title}" created`);
  await createNotification(userId, `Session "${title}" has been created.`);

  const io = getIO();
  io.to('Secretary').emit('sessionCreated', session);
  io.to('Admin').emit('sessionCreated', session);
  io.to('Councilor').emit('newSession', session);
  io.to('Captain').emit('newSession', session);
  io.to('DILG').emit('newSession', session);
  io.to('Resident').emit('newSession', session);

  return session;
};

/**
 * Retrieve all sessions.
 * @returns {Promise<Array>}
 */
exports.getAllSessions = async () => {
  const result = await Session.findAll();
  return result.rows;
};

/**
 * Retrieve a single session by ID.
 * @param {string|number} id
 * @returns {Promise<object>}
 */
exports.getSessionById = async (id) => {
  const result = await Session.findById(id);
  if (result.rows.length === 0) {
    const err = new Error('Session not found');
    err.status = 404;
    throw err;
  }
  return result.rows[0];
};

/**
 * Update a session.
 * @param {string|number} id
 * @param {object} data
 * @param {number} userId
 * @returns {Promise<object>}
 */
exports.updateSession = async (id, { title, date, location, agenda, notes }, userId) => {
  const result = await Session.update(id, title, date, location, agenda, notes);
  if (result.rows.length === 0) {
    const err = new Error('Session not found');
    err.status = 404;
    throw err;
  }

  const session = result.rows[0];
  await AuditLog.create(null, userId, 'SESSION_UPDATE', `Session "${title}" updated`);
  await createNotification(userId, `Session "${title}" has been updated.`);

  const io = getIO();
  io.to('Secretary').emit('sessionUpdated', session);
  io.to('Admin').emit('sessionUpdated', session);
  io.to('Councilor').emit('sessionUpdated', session);
  io.to('Captain').emit('sessionUpdated', session);
  io.to('DILG').emit('sessionUpdated', session);

  return session;
};

/**
 * Delete a session and its related records.
 * @param {string|number} id
 * @param {number} userId
 * @returns {Promise<void>}
 */
exports.deleteSession = async (id, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT * FROM sessions WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      const err = new Error('Session not found');
      err.status = 404;
      throw err;
    }

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
 * @param {string|number} sessionId
 * @returns {Promise<Array>}
 */
exports.getSessionOrdinances = async (sessionId) => {
  const result = await Session.findOrdinancesBySessionId(sessionId);
  return result.rows;
};

/**
 * Get participants for a session.
 * @param {string|number} sessionId
 * @returns {Promise<Array>}
 */
exports.getParticipants = async (sessionId) => {
  const result = await Session.findParticipants(sessionId);
  return result.rows;
};

/**
 * Add a participant to a session.
 * @param {string|number} sessionId
 * @param {number} userId
 * @returns {Promise<object>}
 */
exports.addParticipant = async (sessionId, userId) => {
  const result = await Session.addParticipant(sessionId, userId);
  if (result.rows.length === 0) {
    const err = new Error('Participant already added');
    err.status = 400;
    throw err;
  }

  const sessionResult = await pool.query('SELECT title FROM sessions WHERE id = $1', [sessionId]);
  await createNotification(userId, `You have been added to session: "${sessionResult.rows[0]?.title}"`);

  return result.rows[0];
};

/**
 * Update a participant's attendance status.
 * @param {string|number} sessionId
 * @param {string|number} userId
 * @param {string} attendanceStatus
 * @returns {Promise<object>}
 */
exports.updateParticipantAttendance = async (sessionId, userId, attendanceStatus) => {
  const result = await Session.updateParticipantAttendance(sessionId, userId, attendanceStatus);
  if (result.rows.length === 0) {
    const err = new Error('Participant not found');
    err.status = 404;
    throw err;
  }
  return result.rows[0];
};

/**
 * Get all meeting minutes for a session.
 * @param {string|number} sessionId
 * @returns {Promise<Array>}
 */
exports.getSessionMinutes = async (sessionId) => {
  const result = await Session.findMinutesBySessionId(sessionId);
  return result.rows;
};
