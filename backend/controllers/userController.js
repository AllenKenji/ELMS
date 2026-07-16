/**
 * User Controller - Handles user management HTTP requests.
 */
const userService = require('../services/userService');
const fs = require('fs/promises');
const path = require('path');

function signatureDataToBuffer(signatureData) {
  if (!signatureData) return null;
  if (Buffer.isBuffer(signatureData)) return signatureData;
  if (typeof signatureData !== 'string') return null;

  const trimmed = signatureData.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('\\x')) {
    try {
      return Buffer.from(trimmed.slice(2), 'hex');
    } catch {
      return null;
    }
  }

  try {
    return Buffer.from(trimmed, 'base64');
  } catch {
    return null;
  }
}

function photoDataToBuffer(photoData) {
  return signatureDataToBuffer(photoData);
}

async function sendSignaturePreview(res, signatureRecord) {
  const signatureBuffer = signatureDataToBuffer(signatureRecord?.e_signature_data);
  if (signatureBuffer?.length) {
    res.setHeader('Content-Type', signatureRecord?.e_signature_mime_type || 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    res.send(signatureBuffer);
    return;
  }

  const signatureUrl = signatureRecord?.e_signature_url;
  if (signatureUrl && signatureUrl.startsWith('/uploads/')) {
    const absolutePath = path.join(__dirname, '..', signatureUrl.replace(/^\//, '').replace(/\//g, path.sep));
    try {
      await fs.access(absolutePath);
      res.sendFile(absolutePath);
      return;
    } catch {
      // Fall through to 404 when file no longer exists.
    }
  }

  res.status(404).json({ error: 'E-signature preview not available' });
}

async function sendPhotoPreview(res, photoRecord) {
  const photoBuffer = photoDataToBuffer(photoRecord?.e_profile_photo_data);
  if (photoBuffer?.length) {
    res.setHeader('Content-Type', photoRecord?.e_profile_photo_mime_type || 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    res.send(photoBuffer);
    return;
  }

  const photoUrl = photoRecord?.e_profile_photo_url;
  if (photoUrl && photoUrl.startsWith('/uploads/')) {
    const absolutePath = path.join(__dirname, '..', photoUrl.replace(/^\//, '').replace(/\//g, path.sep));
    try {
      await fs.access(absolutePath);
      res.sendFile(absolutePath);
      return;
    } catch {
      // Fall through to 404 when file no longer exists.
    }
  }

  res.status(404).json({ error: 'Profile photo preview not available' });
}

/**
 * Get all users.
 * GET /users
 */
exports.getAll = async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    res.json(users);
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

/**
 * Delete a user by ID.
 * DELETE /users/:id
 */
exports.deleteUser = async (req, res) => {
  try {
    await userService.deleteUser(req.params.id);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    if (err.code === '23503') return res.status(409).json({ error: 'Cannot delete user because related records exist' });
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

/**
 * Update a user's role.
 * PATCH /users/:id/role
 */
exports.updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role_id } = req.body;

    if (!role_id) return res.status(400).json({ error: 'role_id is required' });

    const user = await userService.updateUserRole(id, role_id);
    res.json(user);
  } catch (err) {
    console.error('Change role error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Failed to change user role' });
  }
};

/**
 * Upload or replace current user's profile photo.
 * POST /users/me/photo
 */
exports.uploadMyProfilePhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Profile photo image file is required' });
    }

    const photoUrl = `/uploads/profile-photos/${req.file.filename}`;
    const photoData = await fs.readFile(req.file.path);
    const user = await userService.updateOwnProfilePhoto(req.user.id, {
      url: photoUrl,
      data: photoData,
      mimeType: req.file.mimetype,
    });
    res.json({
      message: 'Profile photo uploaded successfully',
      photo_url: user.e_profile_photo_url,
    });
  } catch (err) {
    console.error('Upload profile photo error:', err);
    if (err.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: 'Failed to upload profile photo' });
  }
};

/**
 * Get current user's profile photo.
 * GET /users/me/photo
 */
exports.getMyProfilePhoto = async (req, res) => {
  try {
    const user = await userService.getOwnProfilePhoto(req.user.id);
    res.json({
      user_id: user.id,
      name: user.name,
      photo_url: user.e_profile_photo_url || null,
    });
  } catch (err) {
    console.error('Get profile photo error:', err);
    if (err.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: 'Failed to fetch profile photo' });
  }
};

/**
 * Preview current user's profile photo.
 * GET /users/me/photo/preview
 */
exports.getMyProfilePhotoPreview = async (req, res) => {
  try {
    const user = await userService.getOwnProfilePhoto(req.user.id);
    await sendPhotoPreview(res, user);
  } catch (err) {
    console.error('Get my profile photo preview error:', err);
    if (err.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: 'Failed to fetch profile photo preview' });
  }
};

/**
 * Delete current user's profile photo.
 * DELETE /users/me/photo
 */
exports.deleteMyProfilePhoto = async (req, res) => {
  try {
    await userService.deleteOwnProfilePhoto(req.user.id);
    res.json({ message: 'Profile photo deleted successfully' });
  } catch (err) {
    console.error('Delete profile photo error:', err);
    if (err.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: 'Failed to delete profile photo' });
  }
};

/**
 * Upload or replace current user's e-signature.
 * POST /users/me/signature
 */
exports.uploadMySignature = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Signature image file is required' });
    }

    const signatureUrl = `/uploads/signatures/${req.file.filename}`;
    const signatureData = await fs.readFile(req.file.path);
    const user = await userService.updateOwnSignature(req.user.id, {
      url: signatureUrl,
      data: signatureData,
      mimeType: req.file.mimetype,
    });
    res.json({
      message: 'E-signature uploaded successfully',
      signature_url: user.e_signature_url,
    });
  } catch (err) {
    console.error('Upload signature error:', err);
    if (err.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: 'Failed to upload e-signature' });
  }
};

/**
 * Get current user's e-signature.
 * GET /users/me/signature
 */
exports.getMySignature = async (req, res) => {
  try {
    const user = await userService.getOwnSignature(req.user.id);
    res.json({
      user_id: user.id,
      name: user.name,
      signature_url: user.e_signature_url || null,
    });
  } catch (err) {
    console.error('Get signature error:', err);
    if (err.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: 'Failed to fetch e-signature' });
  }
};

/**
 * Preview current user's e-signature image.
 * GET /users/me/signature/preview
 */
exports.getMySignaturePreview = async (req, res) => {
  try {
    const user = await userService.getOwnSignature(req.user.id);
    await sendSignaturePreview(res, user);
  } catch (err) {
    console.error('Get my signature preview error:', err);
    if (err.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: 'Failed to fetch e-signature preview' });
  }
};

/**
 * Delete current user's e-signature.
 * DELETE /users/me/signature
 */
exports.deleteMySignature = async (req, res) => {
  try {
    await userService.deleteOwnSignature(req.user.id);
    res.json({ message: 'E-signature deleted successfully' });
  } catch (err) {
    console.error('Delete signature error:', err);
    if (err.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: 'Failed to delete e-signature' });
  }
};

/**
 * Admin: upload or replace signature for any user account.
 * POST /users/:id/signature
 */
exports.adminUploadUserSignature = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Signature image file is required' });
    }

    const signatureUrl = `/uploads/signatures/${req.file.filename}`;
    const signatureData = await fs.readFile(req.file.path);
    const user = await userService.updateUserSignatureByAdmin(req.params.id, {
      url: signatureUrl,
      data: signatureData,
      mimeType: req.file.mimetype,
    }, req.user.id);
    res.json({
      message: 'User e-signature uploaded successfully',
      user_id: user.id,
      signature_url: user.e_signature_url,
    });
  } catch (err) {
    console.error('Admin upload signature error:', err);
    if (req.file?.path) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    if (err.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: 'Failed to upload user e-signature' });
  }
};

/**
 * Admin: get signature metadata for any user account.
 * GET /users/:id/signature
 */
exports.adminGetUserSignature = async (req, res) => {
  try {
    const user = await userService.getOwnSignature(req.params.id);
    res.json({
      user_id: user.id,
      name: user.name,
      signature_url: user.e_signature_url || null,
    });
  } catch (err) {
    console.error('Admin get signature error:', err);
    if (err.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: 'Failed to fetch user e-signature' });
  }
};

/**
 * Admin: preview signature image for any user account.
 * GET /users/:id/signature/preview
 */
exports.adminGetUserSignaturePreview = async (req, res) => {
  try {
    const user = await userService.getOwnSignature(req.params.id);
    await sendSignaturePreview(res, user);
  } catch (err) {
    console.error('Admin get signature preview error:', err);
    if (err.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: 'Failed to fetch user e-signature preview' });
  }
};

/**
 * Admin: delete signature for any user account.
 * DELETE /users/:id/signature
 */
exports.adminDeleteUserSignature = async (req, res) => {
  try {
    await userService.deleteUserSignatureByAdmin(req.params.id, req.user.id);
    res.json({ message: 'User e-signature deleted successfully' });
  } catch (err) {
    console.error('Admin delete signature error:', err);
    if (err.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: 'Failed to delete user e-signature' });
  }
};

/**
 * Admin: upload or replace profile photo for any user account.
 * POST /users/:id/photo
 */
exports.adminUploadUserProfilePhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Profile photo image file is required' });
    }

    const photoUrl = `/uploads/profile-photos/${req.file.filename}`;
    const photoData = await fs.readFile(req.file.path);
    const user = await userService.updateUserProfilePhotoByAdmin(req.params.id, {
      url: photoUrl,
      data: photoData,
      mimeType: req.file.mimetype,
    }, req.user.id);
    res.json({
      message: 'User profile photo uploaded successfully',
      user_id: user.id,
      photo_url: user.e_profile_photo_url,
    });
  } catch (err) {
    console.error('Admin upload profile photo error:', err);
    if (req.file?.path) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    if (err.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: 'Failed to upload user profile photo' });
  }
};

/**
 * Admin: preview profile photo for any user account.
 * GET /users/:id/photo/preview
 */
exports.adminGetUserProfilePhotoPreview = async (req, res) => {
  try {
    const user = await userService.getOwnProfilePhoto(req.params.id);
    await sendPhotoPreview(res, user);
  } catch (err) {
    console.error('Admin get profile photo preview error:', err);
    if (err.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: 'Failed to fetch user profile photo preview' });
  }
};

/**
 * Admin: delete profile photo for any user account.
 * DELETE /users/:id/photo
 */
exports.adminDeleteUserProfilePhoto = async (req, res) => {
  try {
    await userService.deleteUserProfilePhotoByAdmin(req.params.id, req.user.id);
    res.json({ message: 'User profile photo deleted successfully' });
  } catch (err) {
    console.error('Admin delete profile photo error:', err);
    if (err.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: 'Failed to delete user profile photo' });
  }
};
