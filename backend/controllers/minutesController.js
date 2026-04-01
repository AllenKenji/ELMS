/**
 * Minutes Controller - Handles meeting minutes HTTP requests.
 */
const minutesService = require('../services/minutesService'); // Now uses SessionMinutes

/**
 * Create a new meeting minutes record.
 * POST /minutes
 */
exports.create = async (req, res) => {
  try {
    const minutes = await minutesService.createMinutes(req.body, req.user.id);
    res.status(201).json(minutes);
  } catch (err) {
    console.error('Minutes create error:', err);
    if (err.status === 400) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: 'Error creating meeting minutes' });
  }
};

/**
 * Trigger AI generation for an existing minutes record.
 * POST /minutes/:id/generate
 */
exports.generate = async (req, res) => {
  try {
    const minutes = await minutesService.generateMinutes(req.params.id, req.user.id);
    res.json(minutes);
  } catch (err) {
    console.error('Minutes generate error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    if (err.status === 502) return res.status(502).json({ error: err.message });
    if (err.status === 503) return res.status(503).json({ error: err.message });
    res.status(500).json({ error: 'Error generating meeting minutes' });
  }
};

/**
 * Get all meeting minutes with pagination and filtering.
 * GET /minutes
 */
exports.getAll = async (req, res) => {
  try {
    const result = await minutesService.getAllMinutes(req.query);
    res.json(result);
  } catch (err) {
    console.error('Get minutes error:', err);
    res.status(500).json({ error: 'Error fetching meeting minutes' });
  }
};

/**
 * Get a single meeting minutes record by ID.
 * GET /minutes/:id
 */
exports.getById = async (req, res) => {
  try {
    const minutes = await minutesService.getMinutesById(req.params.id);
    res.json(minutes);
  } catch (err) {
    console.error('Get minutes error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error fetching meeting minutes' });
  }
};

/**
 * Update a meeting minutes record.
 * PUT /minutes/:id
 */
exports.update = async (req, res) => {
  try {
    const minutes = await minutesService.updateMinutes(req.params.id, req.body, req.user.id);
    res.json(minutes);
  } catch (err) {
    console.error('Minutes update error:', err);
    if (err.status === 400) return res.status(400).json({ error: err.message });
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error updating meeting minutes' });
  }
};

/**
 * Delete a meeting minutes record.
 * DELETE /minutes/:id
 */
exports.remove = async (req, res) => {
  try {
    await minutesService.deleteMinutes(req.params.id, req.user.id);
    res.json({ message: 'Meeting minutes deleted successfully' });
  } catch (err) {
    console.error('Minutes delete error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error deleting meeting minutes' });
  }
};

/**
 * Export meeting minutes as plain text.
 * GET /minutes/:id/export/text
 */
exports.exportText = async (req, res) => {
  try {
    const { textContent, filename } = await minutesService.exportText(req.params.id);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(textContent);
  } catch (err) {
    console.error('Minutes text export error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error exporting meeting minutes' });
  }
};
