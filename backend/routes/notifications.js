const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const notificationController = require('../controllers/notificationController');

router.post('/', authenticateToken, notificationController.create);
router.get('/', authenticateToken, notificationController.getAll);
router.patch('/mark-all/read', authenticateToken, notificationController.markAllRead);
router.get('/count/unread', authenticateToken, notificationController.getUnreadCount);
router.get('/:id', authenticateToken, notificationController.getById);
router.patch('/:id/read', authenticateToken, notificationController.markRead);
router.delete('/:id', authenticateToken, notificationController.remove);

module.exports = router;
