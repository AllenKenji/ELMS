const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const messageController = require('../controllers/messageController');
const { validateBody, validateQuery } = require('../middleware/validation');
const { sendMessageSchema, messageSearchSchema } = require('../validators/schemas');

router.post('/', authenticateToken, validateBody(sendMessageSchema), messageController.send);
router.get('/inbox', authenticateToken, validateQuery(messageSearchSchema), messageController.getInbox);
router.get('/sent', authenticateToken, validateQuery(messageSearchSchema), messageController.getSent);
router.get('/count/unread', authenticateToken, messageController.getUnreadCount);
router.get('/:id', authenticateToken, messageController.getById);
router.patch('/:id/read', authenticateToken, messageController.markRead);
router.delete('/:id', authenticateToken, messageController.remove);

module.exports = router;
