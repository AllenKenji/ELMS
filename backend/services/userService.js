/**
 * User Service - Business logic for user operations.
 */
const pool = require('../db');
const fs = require('fs/promises');
const path = require('path');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

let ensureSignatureSchemaPromise = null;

async function ensureSignatureSchema() {
  if (!ensureSignatureSchemaPromise) {
    ensureSignatureSchemaPromise = User.ensureSignatureColumn().catch((err) => {
      ensureSignatureSchemaPromise = null;
      throw err;
    });
  }

  await ensureSignatureSchemaPromise;
}

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

async function setSignatureForUser(targetUserId, signatureAsset, actorUserId, actionLabel) {
  const existing = await User.findSignatureById(targetUserId);
  if (existing.rowCount === 0) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const previousUrl = existing.rows[0].e_signature_url;
  const nextSignatureUrl = signatureAsset?.url || null;
  const nextSignatureData = signatureAsset?.data || null;
  const nextSignatureMimeType = signatureAsset?.mimeType || null;

  const result = await User.updateSignatureAsset(
    targetUserId,
    nextSignatureUrl,
    nextSignatureData,
    nextSignatureMimeType,
  );

  if (previousUrl && previousUrl !== nextSignatureUrl) {
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

async function setProfilePhotoForUser(targetUserId, photoAsset, actorUserId, actionLabel) {
  const existing = await User.findProfilePhotoById(targetUserId);
  if (existing.rowCount === 0) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const previousUrl = existing.rows[0].e_profile_photo_url;
  const nextPhotoUrl = photoAsset?.url || null;
  const nextPhotoData = photoAsset?.data || null;
  const nextPhotoMimeType = photoAsset?.mimeType || null;

  const result = await User.updateProfilePhotoAsset(
    targetUserId,
    nextPhotoUrl,
    nextPhotoData,
    nextPhotoMimeType,
  );

  if (previousUrl && previousUrl !== nextPhotoUrl) {
    await removeFileIfExists(previousUrl);
  }

  await AuditLog.create(
    null,
    actorUserId,
    actionLabel,
    `Updated profile photo for user ID ${targetUserId}`
  );

  return result.rows[0];
}

/**
 * Retrieve all users.
 * @returns {Promise<Array>}
 */
exports.getAllUsers = async () => {
  await ensureSignatureSchema();
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
  await ensureSignatureSchema();
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
exports.updateOwnSignature = async (userId, signatureAsset) => {
  await ensureSignatureSchema();
  return setSignatureForUser(userId, signatureAsset, userId, 'UPDATE_SIGNATURE');
};

/**
 * Get current user's signature info.
 * @param {number|string} userId
 */
exports.getOwnSignature = async (userId) => {
  await ensureSignatureSchema();
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
  await ensureSignatureSchema();
  const existing = await User.findSignatureById(userId);
  if (existing.rowCount === 0) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const previousUrl = existing.rows[0].e_signature_url;
  await User.updateSignatureAsset(userId, null, null, null);
  if (previousUrl) {
    await removeFileIfExists(previousUrl);
  }

  await AuditLog.create(null, userId, 'DELETE_SIGNATURE', 'Deleted account e-signature');
  return { success: true };
};

exports.updateOwnProfilePhoto = async (userId, photoAsset) => {
  await ensureSignatureSchema();
  return setProfilePhotoForUser(userId, photoAsset, userId, 'UPDATE_PROFILE_PHOTO');
};

exports.getOwnProfilePhoto = async (userId) => {
  await ensureSignatureSchema();
  const result = await User.findProfilePhotoById(userId);
  if (result.rowCount === 0) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  return result.rows[0];
};

exports.deleteOwnProfilePhoto = async (userId) => {
  await ensureSignatureSchema();
  const existing = await User.findProfilePhotoById(userId);
  if (existing.rowCount === 0) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const previousUrl = existing.rows[0].e_profile_photo_url;
  await User.updateProfilePhotoAsset(userId, null, null, null);
  if (previousUrl) {
    await removeFileIfExists(previousUrl);
  }

  await AuditLog.create(null, userId, 'DELETE_PROFILE_PHOTO', 'Deleted account profile photo');
  return { success: true };
};

exports.updateUserSignatureByAdmin = async (targetUserId, signatureAsset, adminUserId) => {
  await ensureSignatureSchema();
  return setSignatureForUser(targetUserId, signatureAsset, adminUserId, 'ADMIN_UPDATE_SIGNATURE');
};

exports.deleteUserSignatureByAdmin = async (targetUserId, adminUserId) => {
  await ensureSignatureSchema();
  const existing = await User.findSignatureById(targetUserId);
  if (existing.rowCount === 0) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const previousUrl = existing.rows[0].e_signature_url;
  await User.updateSignatureAsset(targetUserId, null, null, null);
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

exports.updateUserProfilePhotoByAdmin = async (targetUserId, photoAsset, adminUserId) => {
  await ensureSignatureSchema();
  return setProfilePhotoForUser(targetUserId, photoAsset, adminUserId, 'ADMIN_UPDATE_PROFILE_PHOTO');
};

exports.deleteUserProfilePhotoByAdmin = async (targetUserId, adminUserId) => {
  await ensureSignatureSchema();
  const existing = await User.findProfilePhotoById(targetUserId);
  if (existing.rowCount === 0) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const previousUrl = existing.rows[0].e_profile_photo_url;
  await User.updateProfilePhotoAsset(targetUserId, null, null, null);
  if (previousUrl) {
    await removeFileIfExists(previousUrl);
  }

  await AuditLog.create(
    null,
    adminUserId,
    'ADMIN_DELETE_PROFILE_PHOTO',
    `Deleted profile photo for user ID ${targetUserId}`
  );

  return { success: true };
};

exports.findSignatureByName = async (name) => {
  await ensureSignatureSchema();
  if (!name) return null;
  const result = await User.findSignatureByName(name);
  return result.rows[0] || null;
};

exports.findSignatureByRoleNames = async (roleNames) => {
  await ensureSignatureSchema();
  if (!Array.isArray(roleNames) || roleNames.length === 0) return null;
  const result = await User.findSignatureByRoleNames(roleNames);
  return result.rows[0] || null;
};

exports.findSignatureById = async (id) => {
  await ensureSignatureSchema();
  if (!id) return null;
  const result = await User.findSignatureById(id);
  return result.rows[0] || null;
};

exports.findProfilePhotoById = async (id) => {
  await ensureSignatureSchema();
  if (!id) return null;
  const result = await User.findProfilePhotoById(id);
  return result.rows[0] || null;
};
