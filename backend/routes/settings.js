// routes/settings.js
const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET system settings
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM system_settings LIMIT 1');
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// UPDATE system settings
router.put('/', async (req, res) => {
  try {
    const { barangayName, notificationsEnabled } = req.body;
    const result = await pool.query(
      `UPDATE system_settings
       SET barangay_name = $1, notifications_enabled = $2
       RETURNING *`,
      [barangayName, notificationsEnabled]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;
