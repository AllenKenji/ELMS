/**
 * Committee Service - Business logic for committee operations.
 */
const pool = require('../db');
const Committee = require('../models/Committee');
const AuditLog = require('../models/AuditLog');
const { createNotification } = require('../utils/notifications');
const { getCommitteeWithMembers, validateCommitteeChair } = require('../utils/committeesHelper');
const { getIO } = require('../socket');

const VALID_MEMBER_ROLES = ['Chair', 'Member', 'Secretary'];

/**
 * Create a new committee.
 * @param {object} data
 * @param {number} userId
 * @returns {Promise<object>}
 */
exports.createCommittee = async ({ name, description, chair_id, status }, userId) => {
  if (!name) {
    const err = new Error('Committee name is required');
    err.status = 400;
    throw err;
  }

  if (chair_id) {
    const chair = await validateCommitteeChair(chair_id);
    if (!chair) {
      const err = new Error('Chair user not found');
      err.status = 400;
      throw err;
    }
  }

  const result = await Committee.create(name, description, chair_id, status);
  const committee = result.rows[0];

  await AuditLog.create(null, userId, 'COMMITTEE_CREATE', `Committee "${name}" created`);

  const io = getIO();
  io.emit('committeeCreated', committee);

  return committee;
};

/**
 * Retrieve all committees with optional status filter.
 * @param {string} [status]
 * @returns {Promise<Array>}
 */
exports.getAllCommittees = async (status) => {
  const result = await Committee.findAll(status);
  return result.rows;
};

/**
 * Retrieve a single committee with its members.
 * @param {string|number} id
 * @returns {Promise<object>}
 */
exports.getCommitteeById = async (id) => {
  const committee = await getCommitteeWithMembers(id);
  if (!committee) {
    const err = new Error('Committee not found');
    err.status = 404;
    throw err;
  }
  return committee;
};

/**
 * Update a committee.
 * @param {string|number} id
 * @param {object} data
 * @param {number} userId
 * @returns {Promise<object>}
 */
exports.updateCommittee = async (id, { name, description, chair_id, status }, userId) => {
  const existing = await Committee.findById(id);
  if (existing.rows.length === 0) {
    const err = new Error('Committee not found');
    err.status = 404;
    throw err;
  }

  if (chair_id) {
    const chair = await validateCommitteeChair(chair_id);
    if (!chair) {
      const err = new Error('Chair user not found');
      err.status = 400;
      throw err;
    }
  }

  const current = existing.rows[0];
  const result = await Committee.update(
    id,
    name || current.name,
    description !== undefined ? description : current.description,
    chair_id !== undefined ? chair_id : current.chair_id,
    status || current.status
  );

  const committee = result.rows[0];
  await AuditLog.create(null, userId, 'COMMITTEE_UPDATE', `Committee "${committee.name}" updated`);

  const io = getIO();
  io.emit('committeeUpdated', committee);

  return committee;
};

/**
 * Delete a committee.
 * @param {string|number} id
 * @param {number} userId
 * @returns {Promise<void>}
 */
exports.deleteCommittee = async (id, userId) => {
  const existing = await Committee.findById(id);
  if (existing.rows.length === 0) {
    const err = new Error('Committee not found');
    err.status = 404;
    throw err;
  }

  const committeeName = existing.rows[0].name;
  await Committee.deleteById(id);
  await AuditLog.create(null, userId, 'COMMITTEE_DELETE', `Committee "${committeeName}" deleted`);

  const io = getIO();
  io.emit('committeeDeleted', { id: Number(id), name: committeeName });
};

/**
 * Get members of a committee.
 * @param {string|number} committeeId
 * @returns {Promise<Array>}
 */
exports.getMembers = async (committeeId) => {
  const existing = await Committee.findById(committeeId);
  if (existing.rows.length === 0) {
    const err = new Error('Committee not found');
    err.status = 404;
    throw err;
  }

  const result = await Committee.findMembers(committeeId);
  return result.rows;
};

/**
 * Add a member to a committee.
 * @param {string|number} committeeId
 * @param {object} data
 * @param {number} actingUserId
 * @returns {Promise<object>}
 */
exports.addMember = async (committeeId, { user_id, role }, actingUserId) => {
  if (!user_id) {
    const err = new Error('user_id is required');
    err.status = 400;
    throw err;
  }

  const memberRole = role || 'Member';
  if (!VALID_MEMBER_ROLES.includes(memberRole)) {
    const err = new Error('Invalid role. Must be Chair, Member, or Secretary');
    err.status = 400;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const committeeResult = await client.query('SELECT * FROM committees WHERE id = $1', [committeeId]);
    if (committeeResult.rows.length === 0) {
      await client.query('ROLLBACK');
      const err = new Error('Committee not found');
      err.status = 404;
      throw err;
    }

    const userResult = await client.query('SELECT id, name FROM users WHERE id = $1', [user_id]);
    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      const err = new Error('User not found');
      err.status = 400;
      throw err;
    }

    const existingMember = await Committee.findExistingMember(client, committeeId, user_id);
    if (existingMember.rows.length > 0) {
      await client.query('ROLLBACK');
      const err = new Error('User is already a member of this committee');
      err.status = 409;
      throw err;
    }

    const result = await Committee.addMember(client, committeeId, user_id, memberRole);
    const member = result.rows[0];
    member.user_name = userResult.rows[0].name;

    await AuditLog.create(
      client,
      actingUserId,
      'COMMITTEE_MEMBER_ADD',
      `User "${userResult.rows[0].name}" added to committee "${committeeResult.rows[0].name}" as ${memberRole}`
    );

    await client.query('COMMIT');

    await createNotification(user_id, `You have been added to committee "${committeeResult.rows[0].name}" as ${memberRole}.`);

    const io = getIO();
    io.emit('committeeMemberAdded', { committeeId: Number(committeeId), member });

    return member;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Remove a member from a committee.
 * @param {string|number} committeeId
 * @param {string|number} memberId
 * @param {number} actingUserId
 * @returns {Promise<void>}
 */
exports.removeMember = async (committeeId, memberId, actingUserId) => {
  const committeeResult = await Committee.findById(committeeId);
  if (committeeResult.rows.length === 0) {
    const err = new Error('Committee not found');
    err.status = 404;
    throw err;
  }

  const memberResult = await Committee.findMemberById(memberId, committeeId);
  if (memberResult.rows.length === 0) {
    const err = new Error('Committee member not found');
    err.status = 404;
    throw err;
  }

  const memberRow = memberResult.rows[0];
  await Committee.removeMember(memberId);

  await AuditLog.create(
    null,
    actingUserId,
    'COMMITTEE_MEMBER_REMOVE',
    `User "${memberRow.user_name}" removed from committee "${committeeResult.rows[0].name}"`
  );

  await createNotification(memberRow.user_id, `You have been removed from committee "${committeeResult.rows[0].name}".`);

  const io = getIO();
  io.emit('committeeMemberRemoved', { committeeId: Number(committeeId), memberId: Number(memberId) });
};
