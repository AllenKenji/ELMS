/**
 * Resolution Controller - Handles resolution HTTP requests.
 */
const resolutionService = require('../services/resolutionService');

/**
 * Create a new resolution.
 * POST /resolutions
 */
exports.create = async (req, res) => {
  try {
    const resolution = await resolutionService.createResolution(req.body, req.user);
    res.json(resolution);
  } catch (err) {
    console.error('Resolution create error:', err);
    res.status(500).json({ error: 'Error creating resolution' });
  }
};

/**
 * Get all resolutions.
 * GET /resolutions
 */
exports.getAll = async (req, res) => {
  try {
    const resolutions = await resolutionService.getAllResolutions(req.query.status, req.query.proposer);
    res.json(resolutions);
  } catch (err) {
    console.error('Get resolutions error:', err);
    res.status(500).json({ error: 'Error fetching resolutions' });
  }
};

/**
 * Get a single resolution by ID.
 * GET /resolutions/:id
 */
exports.getById = async (req, res) => {
  try {
    const resolution = await resolutionService.getResolutionById(req.params.id);
    res.json(resolution);
  } catch (err) {
    console.error('Get resolution error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error fetching resolution' });
  }
};

/**
 * Update a resolution.
 * PUT /resolutions/:id
 */
exports.update = async (req, res) => {
  try {
    const resolution = await resolutionService.updateResolution(req.params.id, req.body, req.user.id);
    res.json(resolution);
  } catch (err) {
    console.error('Update resolution error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error updating resolution' });
  }
};

/**
 * Delete a resolution.
 * DELETE /resolutions/:id
 */
exports.remove = async (req, res) => {
  try {
    await resolutionService.deleteResolution(req.params.id, req.user.id);
    res.json({ message: 'Resolution deleted successfully' });
  } catch (err) {
    console.error('Delete resolution error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error deleting resolution' });
  }
};

/**
 * Change the status of a resolution.
 * PATCH /resolutions/:id/status
 */
exports.changeStatus = async (req, res) => {
  try {
    const resolution = await resolutionService.changeStatus(req.params.id, req.body.status);
    res.json(resolution);
  } catch (err) {
    console.error('Status change error:', err);
    if (err.status === 400) return res.status(400).json({ error: err.message });
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error updating status' });
  }
};
