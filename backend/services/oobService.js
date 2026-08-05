const Ordinance = require('../models/Ordinance');
const Resolution = require('../models/Resolution');

/**
 * Get all ordinances with submitted committee reports before second reading.
 * Returns an array of { ordinance, committeeReport }
 */
exports.getOrdinancesWithCommitteeReportsSubmitted = async () => {
  // Include legacy + new stage names used before second reading.
  const ordinancesRes = await Ordinance.findAll();
  const allowedStages = new Set(['COMMITTEE_REPORT_SUBMITTED', 'ASSIGN_SECOND_SESSION', 'RECORD_SECOND_SESSION']);
  const ordinances = ordinancesRes.rows.filter(o => allowedStages.has(String(o.reading_stage || '').toUpperCase()));
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
 * Get all resolutions with submitted committee reports before second reading.
 * Returns an array of { resolution, committeeReport }
 */
exports.getResolutionsWithCommitteeReportsSubmitted = async () => {
  const resolutionsRes = await Resolution.findAll();
  const allowedStages = new Set(['COMMITTEE_REPORT_SUBMITTED', 'ASSIGN_SECOND_SESSION', 'RECORD_SECOND_SESSION']);
  const resolutions = resolutionsRes.rows.filter(r => allowedStages.has(String(r.reading_stage || '').toUpperCase()));
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
