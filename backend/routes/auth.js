// routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { getIO } = require('../socket');
const router = express.Router();

// --- Register ---
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, roleId } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, email, hashedPassword, roleId]
    );

    const user = result.rows[0];

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details, timestamp)
       VALUES ($1, $2, $3, NOW())`,
      [user.id, 'REGISTER', `User ${user.email} registered with role ID ${roleId}`]
    );

    res.json(user);
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// --- Refresh ---
router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ error: 'Missing refresh token' });

  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    pool.query(
      `SELECT u.id, u.email, r.role_name
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1`,
      [payload.id],
      (dbErr, result) => {
        if (dbErr) {
          console.error('Refresh DB lookup error:', dbErr);
          return res.status(500).json({ error: 'Failed to refresh token' });
        }

        const user = result.rows[0];
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }

        const newAccessToken = jwt.sign(
          { id: user.id, email: user.email, role: user.role_name || 'Unknown' },
          process.env.JWT_SECRET,
          { expiresIn: '15m' }
        );

        return res.json({ accessToken: newAccessToken });
      }
    );
  } catch (err) {
    console.error('Refresh error:', err);
    res.status(403).json({ error: 'Invalid or expired refresh token' });
  }
});


// --- Login ---
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query(`SELECT * FROM users WHERE email=$1`, [email]);
    const user = result.rows[0];

    if (!user) return res.status(400).json({ error: 'User not found' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(400).json({ error: 'Invalid password' });

    const roleResult = await pool.query(`SELECT role_name FROM roles WHERE id=$1`, [user.role_id]);
    const roleName = roleResult.rows[0]?.role_name || 'Unknown';

    // Access token (short-lived)
    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: roleName },
      process.env.JWT_SECRET,
      { expiresIn: '15m' } // shorter lifespan
    );

    // Refresh token (long-lived)
    const refreshToken = jwt.sign(
      { id: user.id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    // Optionally store refresh token in DB for revocation
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details, timestamp)
       VALUES ($1, $2, $3, NOW())`,
      [user.id, 'LOGIN', `User ${user.email} logged in as ${roleName}`]
    );

    const io = getIO();
    io.to(roleName).emit('userLogin', { id: user.id, name: user.name, role: roleName });

    res.json({ accessToken, refreshToken });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});


// --- Logout ---
router.post('/logout', async (req, res) => {
  try {
    const { userId } = req.body;

    const result = await pool.query(`SELECT * FROM users WHERE id=$1`, [userId]);
    const user = result.rows[0];
    if (!user) return res.status(400).json({ error: 'User not found' });

    const roleResult = await pool.query(`SELECT role_name FROM roles WHERE id=$1`, [user.role_id]);
    const roleName = roleResult.rows[0]?.role_name || 'Unknown';

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details, timestamp)
       VALUES ($1, $2, $3, NOW())`,
      [user.id, 'LOGOUT', `User ${user.email} logged out as ${roleName}`]
    );

    const io = getIO(); // <-- FIX: get the instance
    io.to(roleName).emit('userLogout', { id: user.id, name: user.name, role: roleName });

    res.json({ message: 'Logout successful' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Logout failed' });
  }
});

module.exports = router;
