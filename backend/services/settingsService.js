/**
 * Settings Service - Business logic for system settings.
 */
const pool = require('../db');

/**
 * Retrieve system settings.
 * @returns {Promise<object>}
 */
exports.getSettings = async () => {
  const result = await pool.query('SELECT * FROM system_settings LIMIT 1');
  return result.rows[0];
};

/**
 * Update system settings.
 * @param {string} barangayName
 * @param {boolean} notificationsEnabled
 * @returns {Promise<object>}
 */
exports.updateSettings = async (barangayName, notificationsEnabled) => {
  const result = await pool.query(
    `UPDATE system_settings
     SET barangay_name = $1, notifications_enabled = $2
     RETURNING *`,
    [barangayName, notificationsEnabled]
  );
  return result.rows[0];
};
