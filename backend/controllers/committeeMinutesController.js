/**
 * CommitteeMinutes Controller - Handles committee meeting minutes HTTP requests.
 */
const CommitteeMinutes = require('../models/CommitteeMinutes');

exports.getAll = async (req, res) => {
  try {
    const { committee_id } = req.query;
    if (!committee_id) return res.status(400).json({ error: 'committee_id is required' });
    const { minutes } = await CommitteeMinutes.findByCommitteeId(committee_id);
    res.json({ minutes });
  } catch (err) {
    console.error('Get committee minutes error:', err);
    res.status(500).json({ error: 'Error fetching committee minutes' });
  }
};

exports.create = async (req, res) => {
  try {
    const { title, meeting_date, participants, transcript, committee_id } = req.body;
    if (!committee_id) return res.status(400).json({ error: 'committee_id is required' });
    const result = await CommitteeMinutes.create(
      title,
      meeting_date,
      participants,
      transcript,
      req.user.id,
      committee_id
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create committee minutes error:', err);
    res.status(500).json({ error: 'Error creating committee minutes' });
  }
};

exports.getById = async (req, res) => {
  try {
    const result = await CommitteeMinutes.findById(req.params.id);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Committee minutes not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get committee minutes by id error:', err);
    res.status(500).json({ error: 'Error fetching committee minutes' });
  }
};

exports.update = async (req, res) => {
  try {
    const { title, meeting_date, participants, status } = req.body;
    const result = await CommitteeMinutes.update(
      req.params.id,
      title,
      meeting_date,
      participants,
      status
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Committee minutes not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update committee minutes error:', err);
    res.status(500).json({ error: 'Error updating committee minutes' });
  }
};

exports.remove = async (req, res) => {
  try {
    await CommitteeMinutes.deleteById(req.params.id);
    res.status(204).end();
  } catch (err) {
    console.error('Delete committee minutes error:', err);
    res.status(500).json({ error: 'Error deleting committee minutes' });
  }
};
