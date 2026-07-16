/**
 * User Controller - Handles user management HTTP requests.
 */
const userService = require('../services/userService');
const fs = require('fs/promises');

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
 * Upload or replace current user's e-signature.
 * POST /users/me/signature
 */
exports.uploadMySignature = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Signature image file is required' });
    }

    const signatureUrl = `/uploads/signatures/${req.file.filename}`;
    const user = await userService.updateOwnSignature(req.user.id, signatureUrl);
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
    const user = await userService.updateUserSignatureByAdmin(req.params.id, signatureUrl, req.user.id);
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
