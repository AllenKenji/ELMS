/**
 * Message Controller - Handles messaging HTTP requests.
 */
const messageService = require('../services/messageService');

/**
 * Send a message.
 * POST /messages
 */
exports.send = async (req, res) => {
  try {
    const message = await messageService.sendMessage(req.body, req.user);
    res.status(201).json(message);
  } catch (err) {
    console.error('Send message error:', err);
    if (err.status === 400) return res.status(400).json({ error: err.message });
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error sending message' });
  }
};

/**
 * Get inbox messages.
 * GET /messages/inbox
 */
exports.getInbox = async (req, res) => {
  try {
    const messages = await messageService.getInbox(req.user.id, req.query.search, req.query.unread);
    res.json(messages);
  } catch (err) {
    console.error('Get inbox error:', err);
    res.status(500).json({ error: 'Error fetching inbox' });
  }
};

/**
 * Get sent messages.
 * GET /messages/sent
 */
exports.getSent = async (req, res) => {
  try {
    const messages = await messageService.getSentMessages(req.user.id, req.query.search);
    res.json(messages);
  } catch (err) {
    console.error('Get sent error:', err);
    res.status(500).json({ error: 'Error fetching sent messages' });
  }
};

/**
 * Get a single message.
 * GET /messages/:id
 */
exports.getById = async (req, res) => {
  try {
    const message = await messageService.getMessageById(req.params.id, req.user.id);
    res.json(message);
  } catch (err) {
    console.error('Get message error:', err);
    if (err.status === 403) return res.status(403).json({ error: err.message });
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error fetching message' });
  }
};

/**
 * Mark a message as read or unread.
 * PATCH /messages/:id/read
 */
exports.markRead = async (req, res) => {
  try {
    const message = await messageService.updateReadStatus(req.params.id, req.user.id, req.body.is_read);
    res.json(message);
  } catch (err) {
    console.error('Mark read error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error updating message' });
  }
};

/**
 * Delete a message (soft delete).
 * DELETE /messages/:id
 */
exports.remove = async (req, res) => {
  try {
    await messageService.deleteMessage(req.params.id, req.user.id);
    res.json({ message: 'Message deleted' });
  } catch (err) {
    console.error('Delete message error:', err);
    if (err.status === 403) return res.status(403).json({ error: err.message });
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error deleting message' });
  }
};

/**
 * Get unread message count.
 * GET /messages/count/unread
 */
exports.getUnreadCount = async (req, res) => {
  try {
    const unread = await messageService.getUnreadCount(req.user.id);
    res.json({ unread });
  } catch (err) {
    console.error('Unread count error:', err);
    res.status(500).json({ error: 'Error fetching count' });
  }
};
