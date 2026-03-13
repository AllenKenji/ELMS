// routes/auditLogs.js
const express = require('express');
const router = express.Router();
const auditLogController = require('../controllers/auditLogController');

router.get('/', auditLogController.getAll);

module.exports = router;
