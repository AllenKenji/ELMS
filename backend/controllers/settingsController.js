/**
 * Settings Controller - Handles system settings HTTP requests.
 */
const settingsService = require('../services/settingsService');

/**
 * Get system settings.
 * GET /settings
 */
exports.getSettings = async (req, res) => {
  try {
    const settings = await settingsService.getSettings();
    res.json(settings);
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
};

/**
 * Update system settings.
 * PUT /settings
 */
exports.updateSettings = async (req, res) => {
  try {
    const { barangayName, notificationsEnabled } = req.body;
    const settings = await settingsService.updateSettings(barangayName, notificationsEnabled);
    res.json(settings);
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
};
