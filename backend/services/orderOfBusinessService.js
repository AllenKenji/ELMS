/**
 * OrderOfBusiness Service - Business logic for order of business operations.
 */
const OrderOfBusiness = require('../models/OrderOfBusiness');
const AuditLog = require('../models/AuditLog');
const { getIO } = require('../socket');
const pool = require('../db');

/**
 * Retrieve all order-of-business items for a session.
 * @param {number|string} sessionId
 * @returns {Promise<Array>}
 */
exports.getBySession = async (sessionId) => {
  const result = await OrderOfBusiness.findBySessionId(sessionId);
  return result.rows;
};

/**
 * Create a new order-of-business item, auto-assigning item_number if not provided.
 * @param {object} data
 * @param {number} userId
 * @returns {Promise<object>}
 */
exports.createItem = async (data, userId) => {
  // Validate that the session exists
  const sessionCheck = await pool.query('SELECT id, title FROM sessions WHERE id = $1', [data.session_id]);
  if (sessionCheck.rows.length === 0) {
    const err = new Error('Session not found');
    err.status = 404;
    throw err;
  }

  // Auto-assign item_number if not provided
  if (!data.item_number) {
    data.item_number = await OrderOfBusiness.nextItemNumber(data.session_id);
  }

  const result = await OrderOfBusiness.create(data);
  const item = result.rows[0];

  await AuditLog.create(null, userId, 'ORDER_OF_BUSINESS_CREATE',
    `Order of business item "${item.title}" created for session ${data.session_id}`);

  const io = getIO();
  io.to('Secretary').emit('orderOfBusinessUpdated', { sessionId: data.session_id, item });
  io.to('Admin').emit('orderOfBusinessUpdated', { sessionId: data.session_id, item });
  io.to('Councilor').emit('orderOfBusinessUpdated', { sessionId: data.session_id, item });
  io.to('Captain').emit('orderOfBusinessUpdated', { sessionId: data.session_id, item });

  return item;
};

/**
 * Update an existing order-of-business item.
 * @param {number|string} id
 * @param {object} data
 * @param {number} userId
 * @returns {Promise<object>}
 */
exports.updateItem = async (id, data, userId) => {
  const existing = await OrderOfBusiness.findById(id);
  if (existing.rows.length === 0) {
    const err = new Error('Order of business item not found');
    err.status = 404;
    throw err;
  }

  const result = await OrderOfBusiness.update(id, data);
  if (result.rows.length === 0) {
    const err = new Error('Order of business item not found');
    err.status = 404;
    throw err;
  }
  const item = result.rows[0];

  await AuditLog.create(null, userId, 'ORDER_OF_BUSINESS_UPDATE',
    `Order of business item "${item.title}" updated`);

  const io = getIO();
  io.to('Secretary').emit('orderOfBusinessUpdated', { sessionId: item.session_id, item });
  io.to('Admin').emit('orderOfBusinessUpdated', { sessionId: item.session_id, item });
  io.to('Councilor').emit('orderOfBusinessUpdated', { sessionId: item.session_id, item });
  io.to('Captain').emit('orderOfBusinessUpdated', { sessionId: item.session_id, item });

  return item;
};

/**
 * Delete an order-of-business item.
 * @param {number|string} id
 * @param {number} userId
 * @returns {Promise<void>}
 */
exports.deleteItem = async (id, userId) => {
  const existing = await OrderOfBusiness.findById(id);
  if (existing.rows.length === 0) {
    const err = new Error('Order of business item not found');
    err.status = 404;
    throw err;
  }
  const item = existing.rows[0];

  await OrderOfBusiness.deleteById(id);
  await AuditLog.create(null, userId, 'ORDER_OF_BUSINESS_DELETE',
    `Order of business item "${item.title}" deleted`);

  const io = getIO();
  io.to('Secretary').emit('orderOfBusinessUpdated', { sessionId: item.session_id, deleted: id });
  io.to('Admin').emit('orderOfBusinessUpdated', { sessionId: item.session_id, deleted: id });
  io.to('Councilor').emit('orderOfBusinessUpdated', { sessionId: item.session_id, deleted: id });
  io.to('Captain').emit('orderOfBusinessUpdated', { sessionId: item.session_id, deleted: id });
};

/**
 * Reorder order-of-business items within a session.
 * @param {Array<{id: number, item_number: number}>} items
 * @param {number} userId
 * @returns {Promise<void>}
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
 * @param {number|string} id
 * @param {string} status
 * @param {number} userId
 * @returns {Promise<object>}
 */
exports.updateStatus = async (id, status, userId) => {
  const valid = ['Scheduled', 'In Progress', 'Completed', 'Postponed', 'Skipped'];
  if (!valid.includes(status)) {
    const err = new Error(`Invalid status. Must be one of: ${valid.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const result = await OrderOfBusiness.updateStatus(id, status);
  if (result.rows.length === 0) {
    const err = new Error('Order of business item not found');
    err.status = 404;
    throw err;
  }
  const item = result.rows[0];

  await AuditLog.create(null, userId, 'ORDER_OF_BUSINESS_STATUS',
    `Order of business item "${item.title}" status changed to "${status}"`);

  const io = getIO();
  io.to('Secretary').emit('orderOfBusinessUpdated', { sessionId: item.session_id, item });
  io.to('Admin').emit('orderOfBusinessUpdated', { sessionId: item.session_id, item });
  io.to('Councilor').emit('orderOfBusinessUpdated', { sessionId: item.session_id, item });
  io.to('Captain').emit('orderOfBusinessUpdated', { sessionId: item.session_id, item });

  return item;
};
