const Ordinance = require('../models/Ordinance');

/**
 * Get all ordinances with committee reports at COMMITTEE_REPORT_SUBMITTED stage.
 * Returns an array of { ordinance, committeeReport }
 */
exports.getOrdinancesWithCommitteeReportsSubmitted = async () => {
  // Get all ordinances at the correct stage
  const ordinancesRes = await Ordinance.findAll();
  const ordinances = ordinancesRes.rows.filter(o => o.reading_stage === 'COMMITTEE_REPORT_SUBMITTED');
  const results = [];

  for (const ord of ordinances) {
    const reportRes = await Ordinance.findCommitteeReport(ord.id);
    const committeeReport = reportRes.rows[0] || null;
    if (committeeReport) {
      results.push({
        ordinance: ord,
        committeeReport
      });
    }
  }
  return results;
};
