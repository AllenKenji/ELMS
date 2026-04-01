/**
 * Notification Controller - Handles notification HTTP requests.
 */
const notificationService = require('../services/notificationService');

/**
 * Create a notification.
 * POST /notifications
 */
exports.create = async (req, res) => {
  try {
    const notification = await notificationService.createNotification(req.body, req.user.id, req.user.role);
    res.status(201).json(notification);
  } catch (err) {
    console.error('Create notification error:', err);
    if (err.status === 400) return res.status(400).json({ error: err.message });
    if (err.status === 403) return res.status(403).json({ error: err.message });
    res.status(500).json({ error: 'Error creating notification' });
  }
};

/**
 * Get notifications for the current user.
 * GET /notifications
 */
exports.getAll = async (req, res) => {
  try {
    const notifications = await notificationService.getNotifications(req.user.id, req.query.type, req.query.unread);
    res.json(notifications);
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ error: 'Error fetching notifications' });
  }
};

/**
 * Get a single notification.
 * GET /notifications/:id
 */
exports.getById = async (req, res) => {
  try {
    const notification = await notificationService.getNotificationById(req.params.id, req.user.id);
    res.json(notification);
  } catch (err) {
    console.error('Get notification error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error fetching notification' });
  }
};

/**
 * Mark a notification as read or unread.
 * PATCH /notifications/:id/read
 */
exports.markRead = async (req, res) => {
  try {
    const notification = await notificationService.updateReadStatus(req.params.id, req.user.id, req.body.is_read);
    res.json(notification);
  } catch (err) {
    console.error('Mark read error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error updating notification' });
  }
};

/**
 * Mark all notifications as read.
 * PATCH /notifications/mark-all/read
 */
exports.markAllRead = async (req, res) => {
  try {
    await notificationService.markAllRead(req.user.id);
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('Mark all read error:', err);
    res.status(500).json({ error: 'Error updating notifications' });
  }
};

/**
 * Delete a notification (soft delete).
 * DELETE /notifications/:id
 */
exports.remove = async (req, res) => {
  try {
    await notificationService.deleteNotification(req.params.id, req.user.id);
    res.json({ message: 'Notification deleted' });
  } catch (err) {
    console.error('Delete notification error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error deleting notification' });
  }
};

/**
 * Get unread notification count.
 * GET /notifications/count/unread
 */
exports.getUnreadCount = async (req, res) => {
  try {
    const unread = await notificationService.getUnreadCount(req.user.id);
    res.json({ unread });
  } catch (err) {
    console.error('Unread count error:', err);
    res.status(500).json({ error: 'Error fetching count' });
  }
};
