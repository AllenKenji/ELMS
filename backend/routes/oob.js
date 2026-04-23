const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const oobController = require('../controllers/oobController');

// Get all ordinances with committee reports at COMMITTEE_REPORT_SUBMITTED stage
router.get('/ordinances-with-committee-reports', authenticateToken, oobController.getOrdinancesWithCommitteeReports);

// Get all resolutions with committee reports at COMMITTEE_REPORT_SUBMITTED stage
router.get('/resolutions-with-committee-reports', authenticateToken, oobController.getResolutionsWithCommitteeReports);

module.exports = router;
