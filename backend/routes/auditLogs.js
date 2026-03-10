// routes/auditLogs.js
const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET all audit logs
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM audit_logs ORDER BY timestamp DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Get audit logs error:', err);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

module.exports = router;
