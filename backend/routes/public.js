const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');

router.get('/overview', publicController.getOverview);
router.get('/councilors/:id', publicController.getCouncilorDetails);
router.get('/committees/:id', publicController.getCommitteeDetails);
router.get('/documents/:type/:id', publicController.getDocumentDetails);

module.exports = router;
