/**
 * OrderOfBusiness Model - Data access layer for order of business operations.
 */
const pool = require('../db');

/**
 * Retrieve all order-of-business items for a session, ordered by item_number.
 * Joins ordinance/resolution titles when a related document is linked.
 * @param {number|string} sessionId
 * @returns {Promise<import('pg').QueryResult>}
 */
exports.findBySessionId = async (sessionId) => {
  return pool.query(
    `SELECT oob.*,
            o.title  AS ordinance_title,
            o.ordinance_number,
            r.title  AS resolution_title,
            r.resolution_number
       FROM order_of_business oob
       LEFT JOIN ordinances o
              ON oob.related_document_type = 'ordinance'
             AND oob.related_document_id = o.id
       LEFT JOIN resolutions r
              ON oob.related_document_type = 'resolution'
             AND oob.related_document_id = r.id
      WHERE oob.session_id = $1
      ORDER BY oob.item_number ASC, oob.id ASC`,
    [sessionId]
  );
};

/**
 * Retrieve a single order-of-business item by ID.
 * @param {number|string} id
 * @returns {Promise<import('pg').QueryResult>}
 */
exports.findById = async (id) => {
  return pool.query(
    'SELECT * FROM order_of_business WHERE id = $1',
    [id]
  );
};

/**
 * Get the next available item_number for a session.
 * @param {number|string} sessionId
 * @returns {Promise<number>}
 */
exports.nextItemNumber = async (sessionId) => {
  const result = await pool.query(
    'SELECT COALESCE(MAX(item_number), 0) + 1 AS next_num FROM order_of_business WHERE session_id = $1',
    [sessionId]
  );
  return result.rows[0].next_num;
};

/**
 * Create a new order-of-business item.
 * @param {object} data
 * @returns {Promise<import('pg').QueryResult>}
 */
exports.create = async ({
  session_id,
  item_number,
  title,
  item_type,
  related_document_id,
  related_document_type,
  duration_minutes,
  priority,
  status,
  notes,
}) => {
  return pool.query(
    `INSERT INTO order_of_business
       (session_id, item_number, title, item_type,
        related_document_id, related_document_type,
        duration_minutes, priority, status, notes,
        created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())
     RETURNING *`,
    [
      session_id,
      item_number,
      title,
      item_type || 'Other',
      related_document_id || null,
      related_document_type || null,
      duration_minutes || null,
      priority || 0,
      status || 'Scheduled',
      notes || null,
    ]
  );
};

/**
 * Update an existing order-of-business item.
 * @param {number|string} id
 * @param {object} data
 * @returns {Promise<import('pg').QueryResult>}
 */
exports.update = async (id, {
  item_number,
  title,
  item_type,
  related_document_id,
  related_document_type,
  duration_minutes,
  priority,
  status,
  notes,
}) => {
  return pool.query(
    `UPDATE order_of_business
        SET item_number           = COALESCE($1, item_number),
            title                 = COALESCE($2, title),
            item_type             = COALESCE($3, item_type),
            related_document_id   = $4,
            related_document_type = $5,
            duration_minutes      = $6,
            priority              = COALESCE($7, priority),
            status                = COALESCE($8, status),
            notes                 = $9,
            updated_at            = NOW()
      WHERE id = $10
      RETURNING *`,
    [
      item_number !== undefined ? item_number : null,
      title,
      item_type,
      related_document_id !== undefined ? related_document_id : null,
      related_document_type !== undefined ? related_document_type : null,
      duration_minutes !== undefined ? duration_minutes : null,
      priority !== undefined ? priority : null,
      status,
      notes !== undefined ? notes : null,
      id,
    ]
  );
};

/**
 * Update only the status of an order-of-business item.
 * @param {number|string} id
 * @param {string} status
 * @returns {Promise<import('pg').QueryResult>}
 */
exports.updateStatus = async (id, status) => {
  return pool.query(
    `UPDATE order_of_business
        SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *`,
    [status, id]
  );
};

/**
 * Delete an order-of-business item.
 * @param {number|string} id
 * @returns {Promise<import('pg').QueryResult>}
 */
exports.deleteById = async (id) => {
  return pool.query(
    'DELETE FROM order_of_business WHERE id = $1 RETURNING *',
    [id]
  );
};

/**
 * Bulk-update item_number values for reordering.
 * Expects an array of { id, item_number } objects.
 * Uses a transaction internally.
 * @param {Array<{id: number, item_number: number}>} items
 * @returns {Promise<void>}
 */
exports.reorder = async (items) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const { id, item_number } of items) {
      await client.query(
        'UPDATE order_of_business SET item_number = $1, updated_at = NOW() WHERE id = $2',
        [item_number, id]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
