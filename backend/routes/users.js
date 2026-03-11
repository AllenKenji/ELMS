// routes/users.js
const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET all users
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, role_id FROM users');
    res.json(result.rows);
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// DELETE user by ID
router.delete('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    await client.query('BEGIN');

    const userResult = await client.query('SELECT id, email FROM users WHERE id = $1', [id]);
    if (userResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    await client.query(
      `INSERT INTO audit_logs (user_id, action, details, timestamp)
       VALUES ($1, $2, $3, NOW())`,
      [id, 'DELETE_USER', `User ${userResult.rows[0].email} (ID ${id}) deleted by Admin`]
    );

    await client.query('DELETE FROM users WHERE id = $1', [id]);
    await client.query('COMMIT');

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Delete user error:', err);
    if (err.code === '23503') {
      return res.status(409).json({ error: 'Cannot delete user because related records exist' });
    }
    res.status(500).json({ error: 'Failed to delete user' });
  } finally {
    client.release();
  }
});

// PATCH: update user role
router.patch('/:id/role', async (req, res) => {
  try {
    const { id } = req.params;
    const { role_id } = req.body;

    if (!role_id) {
      return res.status(400).json({ error: 'role_id is required' });
    }

    const result = await pool.query(
      'UPDATE users SET role_id = $1 WHERE id = $2 RETURNING id, name, email, role_id',
      [role_id, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Log the role change in audit_logs
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details, timestamp)
       VALUES ($1, $2, $3, NOW())`,
      [id, 'CHANGE_ROLE', `User role changed to ${role_id} by Admin`]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Change role error:', err);
    res.status(500).json({ error: 'Failed to change user role' });
  }
});

module.exports = router;
