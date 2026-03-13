/**
 * User Controller - Handles user management HTTP requests.
 */
const userService = require('../services/userService');

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
