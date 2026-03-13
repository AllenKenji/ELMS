/**
 * Message Service - Business logic for messaging operations.
 */
const Message = require('../models/Message');
const AuditLog = require('../models/AuditLog');
const { getIO } = require('../socket');

/**
 * Send a message to another user.
 * @param {object} data
 * @param {object} sender
 * @returns {Promise<object>}
 */
exports.sendMessage = async ({ receiver_id, subject, body }, sender) => {
  if (!receiver_id || !subject?.trim() || !body?.trim()) {
    const err = new Error('Missing required fields');
    err.status = 400;
    throw err;
  }

  if (subject.trim().length < 3) {
    const err = new Error('Subject must be at least 3 characters');
    err.status = 400;
    throw err;
  }

  if (body.trim().length < 5) {
    const err = new Error('Message body must be at least 5 characters');
    err.status = 400;
    throw err;
  }

  if (receiver_id === sender.id) {
    const err = new Error('Cannot message yourself');
    err.status = 400;
    throw err;
  }

  const receiverCheck = await Message.findReceiverById(receiver_id);
  if (receiverCheck.rows.length === 0) {
    const err = new Error('Recipient not found');
    err.status = 404;
    throw err;
  }

  const result = await Message.create(sender.id, receiver_id, subject.trim(), body.trim());
  const message = result.rows[0];

  const io = getIO();
  io.to(`user_${receiver_id}`).emit('newMessage', {
    id: message.id,
    sender_id: message.sender_id,
    sender_name: sender.name,
    subject: message.subject,
    created_at: message.created_at,
  });

  await AuditLog.create(null, sender.id, 'MESSAGE_SEND', `Message sent to user ${receiver_id}`);

  return message;
};

/**
 * Get inbox messages for a user.
 * @param {number} userId
 * @param {string} [search]
 * @param {string} [unread]
 * @returns {Promise<Array>}
 */
exports.getInbox = async (userId, search, unread) => {
  const result = await Message.findInbox(userId, search, unread);
  return result.rows;
};

/**
 * Get sent messages for a user.
 * @param {number} userId
 * @param {string} [search]
 * @returns {Promise<Array>}
 */
exports.getSentMessages = async (userId, search) => {
  const result = await Message.findSent(userId, search);
  return result.rows;
};

/**
 * Get a single message by ID, marking it as read if applicable.
 * @param {string|number} id
 * @param {number} userId
 * @returns {Promise<object>}
 */
exports.getMessageById = async (id, userId) => {
  const result = await Message.findById(id);
  if (result.rows.length === 0) {
    const err = new Error('Message not found');
    err.status = 404;
    throw err;
  }

  const message = result.rows[0];
  if (message.sender_id !== userId && message.receiver_id !== userId) {
    const err = new Error('Unauthorized');
    err.status = 403;
    throw err;
  }

  if (message.receiver_id === userId && !message.is_read) {
    await Message.markRead(id);
    message.is_read = true;
  }

  return message;
};

/**
 * Update the read status of a message.
 * @param {string|number} id
 * @param {number} receiverId
 * @param {boolean} isRead
 * @returns {Promise<object>}
 */
exports.updateReadStatus = async (id, receiverId, isRead) => {
  const result = await Message.updateReadStatus(id, receiverId, isRead);
  if (result.rows.length === 0) {
    const err = new Error('Message not found');
    err.status = 404;
    throw err;
  }
  return result.rows[0];
};

/**
 * Soft-delete a message (hard-deletes when both parties have deleted).
 * @param {string|number} id
 * @param {number} userId
 * @returns {Promise<void>}
 */
exports.deleteMessage = async (id, userId) => {
  const result = await Message.findById(id);
  if (result.rows.length === 0) {
    const err = new Error('Message not found');
    err.status = 404;
    throw err;
  }

  const msg = result.rows[0];
  if (msg.sender_id === userId) {
    await Message.softDeleteBySender(id);
  } else if (msg.receiver_id === userId) {
    await Message.softDeleteByReceiver(id);
  } else {
    const err = new Error('Unauthorized');
    err.status = 403;
    throw err;
  }

  await Message.hardDeleteIfBothDeleted(id);
};

/**
 * Get unread message count for a user.
 * @param {number} userId
 * @returns {Promise<number>}
 */
exports.getUnreadCount = async (userId) => {
  const result = await Message.getUnreadCount(userId);
  return parseInt(result.rows[0].count);
};
