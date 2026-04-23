
const oobService = require('../services/oobService');

exports.getOrdinancesWithCommitteeReports = async (req, res) => {
  try {
    // Fetch all ordinances at COMMITTEE_REPORT_SUBMITTED stage
    const ordinances = await oobService.getOrdinancesWithCommitteeReportsSubmitted();
    res.json(ordinances);
  } catch (err) {
    console.error('Get ordinances with committee reports error:', err);
    res.status(500).json({ error: 'Error fetching ordinances with committee reports' });
  }
};

exports.getResolutionsWithCommitteeReports = async (req, res) => {
  try {
    const resolutions = await oobService.getResolutionsWithCommitteeReportsSubmitted();
    res.json(resolutions);
  } catch (err) {
    console.error('Get resolutions with committee reports error:', err);
    res.status(500).json({ error: 'Error fetching resolutions with committee reports' });
  }
};
