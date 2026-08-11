const Ordinance = require('../models/Ordinance');
const Resolution = require('../models/Resolution');

/**
 * Get all ordinances with committee reports regardless of workflow stage.
 * Returns an array of { ordinance, committeeReport }
 */
exports.getOrdinancesWithCommitteeReportsSubmitted = async () => {
  const ordinancesRes = await Ordinance.findAll();
  const ordinances = ordinancesRes.rows || [];
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

  results.sort((a, b) => {
    const aTime = new Date(a?.committeeReport?.submitted_at || 0).getTime();
    const bTime = new Date(b?.committeeReport?.submitted_at || 0).getTime();
    return bTime - aTime;
  });

  return results;
};

/**
 * Get all resolutions with committee reports regardless of workflow stage.
 * Returns an array of { resolution, committeeReport }
 */
exports.getResolutionsWithCommitteeReportsSubmitted = async () => {
  const resolutionsRes = await Resolution.findAll();
  const resolutions = resolutionsRes.rows || [];
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

  results.sort((a, b) => {
    const aTime = new Date(a?.committeeReport?.submitted_at || 0).getTime();
    const bTime = new Date(b?.committeeReport?.submitted_at || 0).getTime();
    return bTime - aTime;
  });

  return results;
};
