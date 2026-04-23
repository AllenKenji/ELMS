/**
 * OrderOfBusinessDocument Model - Data access layer for OOB document records.
 */
const pool = require('../db');

/**
 * List all OOB documents, ordered by date descending.
 */
exports.findAll = async () => {
  return pool.query(
    `SELECT d.*,
            u.name AS created_by_name,
            COUNT(o.id)::int AS item_count
       FROM order_of_business_documents d
       LEFT JOIN users u ON d.created_by = u.id
       LEFT JOIN order_of_business o ON o.document_id = d.id
      GROUP BY d.id, u.name
      ORDER BY d.date DESC NULLS LAST, d.created_at DESC`
  );
};

/**
 * Find a single OOB document by ID.
 */
exports.findById = async (id) => {
  return pool.query(
    `SELECT d.*, u.name AS created_by_name
       FROM order_of_business_documents d
       LEFT JOIN users u ON d.created_by = u.id
      WHERE d.id = $1`,
    [id]
  );
};

/**
 * Create a new OOB document.
 */
exports.create = async ({ session_id, title, date, time, venue, presiding_officer, secretary, status, created_by }) => {
  return pool.query(
    `INSERT INTO order_of_business_documents
       (session_id, title, date, time, venue, presiding_officer, secretary, status, created_by, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())
     RETURNING *`,
    [
      session_id || null,
      title,
      date || null,
      time || null,
      venue || null,
      presiding_officer || null,
      secretary || null,
      status || 'Draft',
      created_by || null,
    ]
  );
};

/**
 * Update an OOB document.
 */
exports.update = async (id, { title, date, time, venue, presiding_officer, secretary, status, session_id }) => {
  return pool.query(
    `UPDATE order_of_business_documents
        SET title             = COALESCE($1, title),
            date              = $2,
            time              = $3,
            venue             = $4,
            presiding_officer = $5,
            secretary         = $6,
            status            = COALESCE($7, status),
            session_id        = $8,
            updated_at        = NOW()
      WHERE id = $9
      RETURNING *`,
    [title, date || null, time || null, venue || null, presiding_officer || null, secretary || null, status, session_id || null, id]
  );
};

/**
 * Delete an OOB document (items cascade via FK).
 */
exports.deleteById = async (id) => {
  return pool.query(
    'DELETE FROM order_of_business_documents WHERE id = $1 RETURNING *',
    [id]
  );
};

/**
 * Get items belonging to a document.
 */
exports.getItems = async (documentId) => {
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
      WHERE oob.document_id = $1
      ORDER BY oob.item_number ASC, oob.id ASC`,
    [documentId]
  );
};
