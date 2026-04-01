// routes/committeeWorkflow.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/committeeWorkflowController');
const authenticateToken = require('../middleware/auth');
const authorizeRoles = require('../middleware/roles');

// Create a new workflow entry (Admin or Vice Mayor can assign)
router.post('/', authenticateToken, authorizeRoles('Admin', 'Vice Mayor'), controller.createWorkflow);

// Get all workflows for a specific item (ordinance/resolution)
router.get('/item/:item_type/:item_id', controller.getWorkflowsForItem);

// Update workflow status
router.put('/:id/status', controller.updateWorkflowStatus);

// Get all workflows for a committee
router.get('/committee/:committee_id', controller.getCommitteeWorkflows);

module.exports = router;
