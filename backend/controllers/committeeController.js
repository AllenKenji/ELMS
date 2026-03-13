/**
 * Committee Controller - Handles committee HTTP requests.
 */
const committeeService = require('../services/committeeService');

/**
 * Create a new committee.
 * POST /committees
 */
exports.create = async (req, res) => {
  try {
    const committee = await committeeService.createCommittee(req.body, req.user.id);
    res.status(201).json(committee);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A committee with that name already exists' });
    console.error('Committee create error:', err);
    if (err.status === 400) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: 'Error creating committee' });
  }
};

/**
 * Get all committees.
 * GET /committees
 */
exports.getAll = async (req, res) => {
  try {
    const committees = await committeeService.getAllCommittees(req.query.status);
    res.json(committees);
  } catch (err) {
    console.error('Get committees error:', err);
    res.status(500).json({ error: 'Error fetching committees' });
  }
};

/**
 * Get a single committee with its members.
 * GET /committees/:id
 */
exports.getById = async (req, res) => {
  try {
    const committee = await committeeService.getCommitteeById(req.params.id);
    res.json(committee);
  } catch (err) {
    console.error('Get committee error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error fetching committee' });
  }
};

/**
 * Update a committee.
 * PUT /committees/:id
 */
exports.update = async (req, res) => {
  try {
    const committee = await committeeService.updateCommittee(req.params.id, req.body, req.user.id);
    res.json(committee);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A committee with that name already exists' });
    console.error('Update committee error:', err);
    if (err.status === 400) return res.status(400).json({ error: err.message });
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error updating committee' });
  }
};

/**
 * Delete a committee.
 * DELETE /committees/:id
 */
exports.remove = async (req, res) => {
  try {
    await committeeService.deleteCommittee(req.params.id, req.user.id);
    res.json({ message: 'Committee deleted successfully' });
  } catch (err) {
    console.error('Delete committee error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error deleting committee' });
  }
};

/**
 * Get members of a committee.
 * GET /committees/:id/members
 */
exports.getMembers = async (req, res) => {
  try {
    const members = await committeeService.getMembers(req.params.id);
    res.json(members);
  } catch (err) {
    console.error('Get committee members error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error fetching committee members' });
  }
};

/**
 * Add a member to a committee.
 * POST /committees/:id/members
 */
exports.addMember = async (req, res) => {
  try {
    const member = await committeeService.addMember(req.params.id, req.body, req.user.id);
    res.status(201).json(member);
  } catch (err) {
    if (err.code === '23505' || err.status === 409) return res.status(409).json({ error: err.message || 'User is already a member of this committee' });
    console.error('Add committee member error:', err);
    if (err.status === 400) return res.status(400).json({ error: err.message });
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error adding committee member' });
  }
};

/**
 * Remove a member from a committee.
 * DELETE /committees/:id/members/:memberId
 */
exports.removeMember = async (req, res) => {
  try {
    await committeeService.removeMember(req.params.id, req.params.memberId, req.user.id);
    res.json({ message: 'Committee member removed successfully' });
  } catch (err) {
    console.error('Remove committee member error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error removing committee member' });
  }
};
