/**
 * Auth Controller - Handles authentication HTTP requests.
 */
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const AuditLog = require('../models/AuditLog');
const { getIO } = require('../socket');

/**
 * Register a new user.
 * POST /auth/register
 */
exports.register = async (req, res) => {
  try {
    const { name, email, password, roleId } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, email, hashedPassword, roleId]
    );

    const user = result.rows[0];
    await AuditLog.create(null, user.id, 'REGISTER', `User ${user.email} registered with role ID ${roleId}`);

    res.json(user);
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
};

/**
 * Log in a user and issue tokens.
 * POST /auth/login
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    const user = result.rows[0];

    if (!user) return res.status(400).json({ error: 'User not found' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(400).json({ error: 'Invalid password' });

    const roleResult = await pool.query('SELECT role_name FROM roles WHERE id=$1', [user.role_id]);
    const roleName = roleResult.rows[0]?.role_name || 'Unknown';

    const accessToken = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: roleName },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { id: user.id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    await AuditLog.create(null, user.id, 'LOGIN', `User ${user.email} logged in as ${roleName}`);

    const io = getIO();
    io.to(roleName).emit('userLogin', { id: user.id, name: user.name, role: roleName });

    res.json({
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: roleName },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
};

/**
 * Refresh the access token using a refresh token.
 * POST /auth/refresh
 */
exports.refresh = (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ error: 'Missing refresh token' });

  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    pool.query(
      `SELECT u.id, u.name, u.email, r.role_name
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
        if (!user) return res.status(404).json({ error: 'User not found' });

        const newAccessToken = jwt.sign(
          { id: user.id, name: user.name, email: user.email, role: user.role_name || 'Unknown' },
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
};

/**
 * Log out a user.
 * POST /auth/logout
 */
exports.logout = async (req, res) => {
  try {
    const { userId } = req.body;

    const result = await pool.query('SELECT * FROM users WHERE id=$1', [userId]);
    const user = result.rows[0];
    if (!user) return res.status(400).json({ error: 'User not found' });

    const roleResult = await pool.query('SELECT role_name FROM roles WHERE id=$1', [user.role_id]);
    const roleName = roleResult.rows[0]?.role_name || 'Unknown';

    await AuditLog.create(null, user.id, 'LOGOUT', `User ${user.email} logged out as ${roleName}`);

    const io = getIO();
    io.to(roleName).emit('userLogout', { id: user.id, name: user.name, role: roleName });

    res.json({ message: 'Logout successful' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Logout failed' });
  }
};
