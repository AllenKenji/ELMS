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
 * session_id is optional — items can be created before a session exists.
 */
exports.createItem = async (data, userId) => {
  if (data.session_id) {
    const sessionCheck = await pool.query('SELECT id, title FROM sessions WHERE id = $1', [data.session_id]);
    ensureFound(sessionCheck.rows, 'Session not found');
  }

  if (!data.item_number) {
    data.item_number = data.session_id
      ? await OrderOfBusiness.nextItemNumber(data.session_id)
      : await OrderOfBusiness.nextUnassignedItemNumber();
  }

  const result = await OrderOfBusiness.create(data);
  const item = result.rows[0];

  await AuditLog.create(null, userId, 'ORDER_OF_BUSINESS_CREATE',
    `Order of business item "${item.title}" created${data.session_id ? ` for session ${data.session_id}` : ' (unassigned)'}`);

  if (data.session_id) {
    broadcastUpdate(data.session_id, { item });
  }
  return item;
};

/**
 * Get all unassigned (no session) order-of-business items.
 */
exports.getUnassigned = async () => {
  const result = await OrderOfBusiness.findUnassigned();
  return result.rows;
};

/**
 * Assign multiple OOB items to a session.
 */
exports.assignToSession = async (sessionId, itemIds, userId) => {
  const sessionCheck = await pool.query('SELECT id, title FROM sessions WHERE id = $1', [sessionId]);
  ensureFound(sessionCheck.rows, 'Session not found');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let nextNum = await OrderOfBusiness.nextItemNumber(sessionId);
    for (const id of itemIds) {
      await client.query(
        `UPDATE order_of_business SET session_id = $1, item_number = $2, updated_at = NOW() WHERE id = $3 AND session_id IS NULL`,
        [sessionId, nextNum++, id]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  await AuditLog.create(null, userId, 'ORDER_OF_BUSINESS_ASSIGN',
    `${itemIds.length} order of business item(s) assigned to session ${sessionId}`);

  broadcastUpdate(sessionId, { assigned: itemIds });
};

/**
 * Batch-create multiple order-of-business items (e.g. full agenda).
 * Each item in the array follows the same shape as createItem data.
 * Returns the created items in order.
 */
exports.batchCreate = async (items, userId) => {
  if (!Array.isArray(items) || items.length === 0) {
    const err = new Error('Items array is required and must not be empty.');
    err.status = 400;
    throw err;
  }

  const sessionId = items[0].session_id || null;
  if (sessionId) {
    const sessionCheck = await pool.query('SELECT id FROM sessions WHERE id = $1', [sessionId]);
    ensureFound(sessionCheck.rows, 'Session not found');
  }

  const client = await pool.connect();
  const created = [];
  try {
    await client.query('BEGIN');
    let nextNum = sessionId
      ? await OrderOfBusiness.nextItemNumber(sessionId)
      : await OrderOfBusiness.nextUnassignedItemNumber();

    for (const item of items) {
      const result = await client.query(
        `INSERT INTO order_of_business
           (session_id, item_number, title, item_type, related_document_id, related_document_type,
            duration_minutes, priority, status, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [
          sessionId,
          nextNum++,
          item.title,
          item.item_type || 'Other',
          item.related_document_id || null,
          item.related_document_type || null,
          item.duration_minutes || null,
          item.priority || 0,
          item.status || 'Scheduled',
          item.notes || null,
        ]
      );
      created.push(result.rows[0]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  await AuditLog.create(null, userId, 'ORDER_OF_BUSINESS_BATCH_CREATE',
    `${created.length} order of business items created${sessionId ? ` for session ${sessionId}` : ' (unassigned)'}`);

  if (sessionId) {
    broadcastUpdate(sessionId, { items: created });
  }
  return created;
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
