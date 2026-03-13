/**
 * User Service - Business logic for user operations.
 */
const pool = require('../db');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

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
