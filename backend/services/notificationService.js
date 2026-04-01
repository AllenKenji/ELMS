/**
 * Notification Service - Business logic for notification operations.
 */
const Notification = require('../models/Notification');
const { getIO } = require('../socket');

/**
 * Create a notification for a user.
 * @param {object} data
 * @param {number} requestingUserId
 * @param {string} requestingUserRole
 * @returns {Promise<object>}
 */
exports.createNotification = async ({ user_id, type, title, message, related_id, related_type }, requestingUserId, requestingUserRole) => {
  if (user_id !== requestingUserId && requestingUserRole !== 'Admin') {
    const err = new Error('Unauthorized');
    err.status = 403;
    throw err;
  }

  if (!user_id || !type || !title || !message) {
    const err = new Error('Missing required fields');
    err.status = 400;
    throw err;
  }

  const result = await Notification.create(user_id, type, title, message, related_id, related_type);
  const notification = result.rows[0];

  const io = getIO();
  io.to(`user_${user_id}`).emit('notificationCreated', notification);

  return notification;
};

/**
 * Retrieve notifications for a user with optional filters.
 * @param {number} userId
 * @param {string} [type]
 * @param {string} [unread]
 * @returns {Promise<Array>}
 */
exports.getNotifications = async (userId, type, unread) => {
  const result = await Notification.findByUser(userId, type, unread);
  return result.rows;
};

/**
 * Get a single notification by ID, marking it as read.
 * @param {string|number} id
 * @param {number} userId
 * @returns {Promise<object>}
 */
exports.getNotificationById = async (id, userId) => {
  const result = await Notification.findById(id, userId);
  if (result.rows.length === 0) {
    const err = new Error('Notification not found');
    err.status = 404;
    throw err;
  }

  const notification = result.rows[0];
  if (!notification.is_read) {
    await Notification.markRead(id);
    notification.is_read = true;
  }

  return notification;
};

/**
 * Update the read status of a notification.
 * @param {string|number} id
 * @param {number} userId
 * @param {boolean} isRead
 * @returns {Promise<object>}
 */
exports.updateReadStatus = async (id, userId, isRead) => {
  const result = await Notification.updateReadStatus(id, userId, isRead);
  if (result.rows.length === 0) {
    const err = new Error('Notification not found');
    err.status = 404;
    throw err;
  }
  return result.rows[0];
};

/**
 * Mark all notifications as read for a user.
 * @param {number} userId
 * @returns {Promise<void>}
 */
exports.markAllRead = async (userId) => {
  await Notification.markAllRead(userId);
};

/**
 * Soft-delete a notification.
 * @param {string|number} id
 * @param {number} userId
 * @returns {Promise<void>}
 */
exports.deleteNotification = async (id, userId) => {
  const result = await Notification.softDelete(id, userId);
  if (result.rowCount === 0) {
    const err = new Error('Notification not found');
    err.status = 404;
    throw err;
  }
};

/**
 * Get unread notification count for a user.
 * @param {number} userId
 * @returns {Promise<number>}
 */
exports.getUnreadCount = async (userId) => {
  const result = await Notification.getUnreadCount(userId);
  return parseInt(result.rows[0].count);
};
