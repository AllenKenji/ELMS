/**
 * User Service - Business logic for user operations.
 */
const pool = require('../db');
const fs = require('fs/promises');
const path = require('path');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

function resolveAbsoluteUploadPath(fileUrl) {
  if (!fileUrl || typeof fileUrl !== 'string') return null;
  if (!fileUrl.startsWith('/uploads/')) return null;
  return path.join(__dirname, '..', fileUrl.replace(/^\//, '').replace(/\//g, path.sep));
}

async function removeFileIfExists(fileUrl) {
  const absolutePath = resolveAbsoluteUploadPath(fileUrl);
  if (!absolutePath) return;
  try {
    await fs.unlink(absolutePath);
  } catch {
    // Ignore missing or already-deleted files.
  }
}

async function setSignatureForUser(targetUserId, signatureUrl, actorUserId, actionLabel) {
  const existing = await User.findSignatureById(targetUserId);
  if (existing.rowCount === 0) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const previousUrl = existing.rows[0].e_signature_url;
  const result = await User.updateSignatureUrl(targetUserId, signatureUrl);

  if (previousUrl && previousUrl !== signatureUrl) {
    await removeFileIfExists(previousUrl);
  }

  await AuditLog.create(
    null,
    actorUserId,
    actionLabel,
    `Updated e-signature for user ID ${targetUserId}`
  );

  return result.rows[0];
}

/**
 * Retrieve all users.
 * @returns {Promise<Array>}
 */
exports.getAllUsers = async () => {
  const result = await User.findAll();
  return result.rows;
};

/**
 * Delete a user by ID within a transaction, logging the action.
 * @param {string|number} id
 * @returns {Promise<void>}
 */
exports.deleteUser = async (id) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userResult = await client.query('SELECT id, email FROM users WHERE id = $1', [id]);
    if (userResult.rowCount === 0) {
      await client.query('ROLLBACK');
      const err = new Error('User not found');
      err.status = 404;
      throw err;
    }

    await AuditLog.create(
      client,
      id,
      'DELETE_USER',
      `User ${userResult.rows[0].email} (ID ${id}) deleted by Admin`
    );

    await User.deleteById(client, id);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Update a user's role and log the action.
 * @param {string|number} id
 * @param {string|number} roleId
 * @returns {Promise<object>}
 */
exports.updateUserRole = async (id, roleId) => {
  const result = await User.updateRole(id, roleId);
  if (result.rowCount === 0) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  await AuditLog.create(null, id, 'CHANGE_ROLE', `User role changed to ${roleId} by Admin`);
  return result.rows[0];
};

/**
 * Save or replace current user's signature image URL.
 * @param {number|string} userId
 * @param {string} signatureUrl
 */
exports.updateOwnSignature = async (userId, signatureUrl) => {
  return setSignatureForUser(userId, signatureUrl, userId, 'UPDATE_SIGNATURE');
};

/**
 * Get current user's signature info.
 * @param {number|string} userId
 */
exports.getOwnSignature = async (userId) => {
  const result = await User.findSignatureById(userId);
  if (result.rowCount === 0) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  return result.rows[0];
};

/**
 * Delete current user's signature.
 * @param {number|string} userId
 */
exports.deleteOwnSignature = async (userId) => {
  const existing = await User.findSignatureById(userId);
  if (existing.rowCount === 0) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const previousUrl = existing.rows[0].e_signature_url;
  await User.updateSignatureUrl(userId, null);
  if (previousUrl) {
    await removeFileIfExists(previousUrl);
  }

  await AuditLog.create(null, userId, 'DELETE_SIGNATURE', 'Deleted account e-signature');
  return { success: true };
};

exports.updateUserSignatureByAdmin = async (targetUserId, signatureUrl, adminUserId) => {
  return setSignatureForUser(targetUserId, signatureUrl, adminUserId, 'ADMIN_UPDATE_SIGNATURE');
};

exports.deleteUserSignatureByAdmin = async (targetUserId, adminUserId) => {
  const existing = await User.findSignatureById(targetUserId);
  if (existing.rowCount === 0) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const previousUrl = existing.rows[0].e_signature_url;
  await User.updateSignatureUrl(targetUserId, null);
  if (previousUrl) {
    await removeFileIfExists(previousUrl);
  }

  await AuditLog.create(
    null,
    adminUserId,
    'ADMIN_DELETE_SIGNATURE',
    `Deleted e-signature for user ID ${targetUserId}`
  );

  return { success: true };
};

exports.findSignatureByName = async (name) => {
  if (!name) return null;
  const result = await User.findSignatureByName(name);
  return result.rows[0] || null;
};

exports.findSignatureByRoleNames = async (roleNames) => {
  if (!Array.isArray(roleNames) || roleNames.length === 0) return null;
  const result = await User.findSignatureByRoleNames(roleNames);
  return result.rows[0] || null;
};

exports.findSignatureById = async (id) => {
  if (!id) return null;
  const result = await User.findSignatureById(id);
  return result.rows[0] || null;
};
