const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const messageController = require('../controllers/messageController');

router.post('/', authenticateToken, messageController.send);
router.get('/inbox', authenticateToken, messageController.getInbox);
router.get('/sent', authenticateToken, messageController.getSent);
router.get('/count/unread', authenticateToken, messageController.getUnreadCount);
router.get('/:id', authenticateToken, messageController.getById);
router.patch('/:id/read', authenticateToken, messageController.markRead);
router.delete('/:id', authenticateToken, messageController.remove);

module.exports = router;
