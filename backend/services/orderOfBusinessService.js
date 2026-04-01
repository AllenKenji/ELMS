/**
 * OrderOfBusiness Service - Business logic for order of business operations.
 */
const OrderOfBusiness = require('../models/OrderOfBusiness');
const AuditLog = require('../models/AuditLog');
const { getIO } = require('../socket');
const pool = require('../db');

const ROLES = ['Secretary', 'Admin', 'Councilor', 'Vice Mayor'];

/**
 * Utility: broadcast updates to all roles
 */
const broadcastUpdate = (sessionId, payload) => {
  const io = getIO();
  ROLES.forEach(role => io.to(role).emit('orderOfBusinessUpdated', { sessionId, ...payload }));
};

/**
 * Utility: throw error if condition fails
 */
const ensureFound = (rows, message = 'Item not found') => {
  if (!rows || rows.length === 0) {
    const err = new Error(message);
    err.status = 404;
    throw err;
  }
};

/**
 * Retrieve all order-of-business items for a session.
 */
exports.getBySession = async (sessionId) => {
  const result = await OrderOfBusiness.findBySessionId(sessionId);
  return result.rows;
};

/**
 * Create a new order-of-business item.
 */
exports.createItem = async (data, userId) => {
  const sessionCheck = await pool.query('SELECT id, title FROM sessions WHERE id = $1', [data.session_id]);
  ensureFound(sessionCheck.rows, 'Session not found');

  if (!data.item_number) {
    data.item_number = await OrderOfBusiness.nextItemNumber(data.session_id);
  }

  const result = await OrderOfBusiness.create(data);
  const item = result.rows[0];

  await AuditLog.create(null, userId, 'ORDER_OF_BUSINESS_CREATE',
    `Order of business item "${item.title}" created for session ${data.session_id}`);

  broadcastUpdate(data.session_id, { item });
  return item;
};

/**
 * Update an existing order-of-business item.
 */
exports.updateItem = async (id, data, userId) => {
  const existing = await OrderOfBusiness.findById(id);
  ensureFound(existing.rows);

  const result = await OrderOfBusiness.update(id, data);
  ensureFound(result.rows);

  const item = result.rows[0];
  await AuditLog.create(null, userId, 'ORDER_OF_BUSINESS_UPDATE',
    `Order of business item "${item.title}" updated`);

  broadcastUpdate(item.session_id, { item });
  return item;
};

/**
 * Delete an order-of-business item.
 */
exports.deleteItem = async (id, userId) => {
  const existing = await OrderOfBusiness.findById(id);
  ensureFound(existing.rows);

  const item = existing.rows[0];
  await OrderOfBusiness.deleteById(id);

  await AuditLog.create(null, userId, 'ORDER_OF_BUSINESS_DELETE',
    `Order of business item "${item.title}" deleted`);

  broadcastUpdate(item.session_id, { deleted: id });
};

/**
 * Reorder order-of-business items within a session.
 */
exports.reorderItems = async (items, userId) => {
  if (!Array.isArray(items) || items.length === 0) {
    const err = new Error('Items array is required');
    err.status = 400;
    throw err;
  }

  await OrderOfBusiness.reorder(items);
  await AuditLog.create(null, userId, 'ORDER_OF_BUSINESS_REORDER',
    `Order of business items reordered`);
};

/**
 * Update the status of a single order-of-business item.
 */
exports.updateStatus = async (id, status, userId) => {
  const validStatuses = ['Scheduled', 'In Progress', 'Completed', 'Postponed', 'Skipped'];
  if (!validStatuses.includes(status)) {
    const err = new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const result = await OrderOfBusiness.updateStatus(id, status);
  ensureFound(result.rows);

  const item = result.rows[0];
  await AuditLog.create(null, userId, 'ORDER_OF_BUSINESS_STATUS',
    `Order of business item "${item.title}" status changed to "${status}"`);

  broadcastUpdate(item.session_id, { item });
  return item;
};
