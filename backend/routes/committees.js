const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const authorizeRoles = require('../middleware/roles');
const committeeController = require('../controllers/committeeController');

router.post('/', authenticateToken, authorizeRoles('Admin', 'Secretary'), committeeController.create);
router.get('/', authenticateToken, committeeController.getAll);
router.get('/:id', authenticateToken, committeeController.getById);
router.put('/:id', authenticateToken, authorizeRoles('Admin', 'Secretary'), committeeController.update);
router.delete('/:id', authenticateToken, authorizeRoles('Admin'), committeeController.remove);
router.get('/:id/members', authenticateToken, committeeController.getMembers);
router.post('/:id/members', authenticateToken, authorizeRoles('Admin', 'Secretary'), committeeController.addMember);
router.delete('/:id/members/:memberId', authenticateToken, authorizeRoles('Admin', 'Secretary'), committeeController.removeMember);

module.exports = router;
