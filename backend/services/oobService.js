const Ordinance = require('../models/Ordinance');
const Resolution = require('../models/Resolution');

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

/**
 * Get all resolutions with committee reports at COMMITTEE_REPORT_SUBMITTED stage.
 * Returns an array of { resolution, committeeReport }
 */
exports.getResolutionsWithCommitteeReportsSubmitted = async () => {
  const resolutionsRes = await Resolution.findAll();
  const resolutions = resolutionsRes.rows.filter(r => r.reading_stage === 'COMMITTEE_REPORT_SUBMITTED');
  const results = [];

  for (const res of resolutions) {
    const reportRes = await Resolution.findCommitteeReport(res.id);
    const committeeReport = reportRes.rows[0] || null;
    if (committeeReport) {
      results.push({
        resolution: res,
        committeeReport
      });
    }
  }
  return results;
};
