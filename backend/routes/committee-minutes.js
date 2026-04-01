const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const authorizeRoles = require('../middleware/roles');
const committeeMinutesController = require('../controllers/committeeMinutesController');

// Committee Minutes CRUD
router.get('/', authenticateToken, committeeMinutesController.getAll); // ?committee_id=123
router.post('/', authenticateToken, committeeMinutesController.create);
router.get('/:id', authenticateToken, committeeMinutesController.getById);
router.put('/:id', authenticateToken, committeeMinutesController.update);
router.delete('/:id', authenticateToken, committeeMinutesController.remove);

module.exports = router;
