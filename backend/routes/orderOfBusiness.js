const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const authorizeRoles = require('../middleware/roles');
const ctrl = require('../controllers/orderOfBusinessController');

// Reorder agenda items — must appear before /:id routes to prevent "reorder"
// being treated as an :id parameter value.
router.post('/reorder', authenticateToken, authorizeRoles('Secretary', 'Admin'), ctrl.reorder);

// Get full order of business for a session
router.get('/:sessionId', authenticateToken, ctrl.getBySession);

// Create a new order-of-business item (Secretary and Admin only)
router.post('/', authenticateToken, authorizeRoles('Secretary', 'Admin'), ctrl.create);

// Update an order-of-business item (Secretary and Admin only)
router.put('/:id', authenticateToken, authorizeRoles('Secretary', 'Admin'), ctrl.update);

// Delete an order-of-business item (Secretary and Admin only)
router.delete('/:id', authenticateToken, authorizeRoles('Secretary', 'Admin'), ctrl.remove);

// Update item status (Secretary and Admin only)
router.patch('/:id/status', authenticateToken, authorizeRoles('Secretary', 'Admin'), ctrl.updateStatus);

module.exports = router;
