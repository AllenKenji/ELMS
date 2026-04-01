/**
 * Resolution Service - Business logic for resolution operations.
 */
const pool = require('../db');
const Resolution = require('../models/Resolution');
const AuditLog = require('../models/AuditLog');
const { getIO } = require('../socket');

const VALID_STATUSES = ['Draft', 'Submitted', 'Under Review', 'Approved', 'Published', 'Rejected'];

async function normalizeCouncilorCoAuthors(coAuthorIds) {
  if (!Array.isArray(coAuthorIds) || coAuthorIds.length === 0) {
    const err = new Error('At least one co-author / sponsor is required');
    err.status = 400;
    throw err;
  }

  const normalized = [...new Set(coAuthorIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
  if (normalized.length !== coAuthorIds.length) {
    const err = new Error('Co-authors must be valid user IDs');
    err.status = 400;
    throw err;
  }

  const result = await pool.query(
    `SELECT u.id, r.role_name
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.id = ANY($1::int[])`,
    [normalized]
  );

  if (result.rows.length !== normalized.length) {
    const err = new Error('One or more selected co-authors do not exist');
    err.status = 400;
    throw err;
  }

  const hasNonCouncilor = result.rows.some(
    (row) => String(row.role_name || '').toLowerCase() !== 'councilor'
  );
  if (hasNonCouncilor) {
    const err = new Error('Co-authors / sponsors must be users with Councilor role');
    err.status = 400;
    throw err;
  }

  return normalized.join(',');
}

/**
 * Create a new resolution.
 * @param {object} data
 * @param {object} user
 * @returns {Promise<object>}
 */
exports.createResolution = async ({
  title,
  resolution_number,
  description,
  content,
  remarks,
  status,
  co_authors,
  whereas_clauses,
  effectivity_clause,
  attachments,
}, user) => {
  const normalizedCoAuthors = await normalizeCouncilorCoAuthors(co_authors);
  const initialStatus = status || 'Draft';
  const result = await Resolution.create(
    title,
    resolution_number,
    description,
    content,
    remarks,
    user.id,
    user.name,
    initialStatus,
    normalizedCoAuthors,
    whereas_clauses,
    effectivity_clause,
    attachments
  );
  const resolution = result.rows[0];

  await AuditLog.create(null, user.id, 'RESOLUTION_CREATE', `Resolution "${title}" created`);

  const io = getIO();
  io.emit('resolutionCreated', resolution);

  return resolution;
};

/**
 * Retrieve all resolutions with optional filters.
 * @param {string} [status]
 * @param {string|number} [proposerId]
 * @returns {Promise<Array>}
 */
exports.getAllResolutions = async (status, proposerId) => {
  const result = await Resolution.findAll(status, proposerId);
  return result.rows;
};

/**
 * Retrieve a single resolution by ID.
 * @param {string|number} id
 * @returns {Promise<object>}
 */
exports.getResolutionById = async (id) => {
  const result = await Resolution.findById(id);
  if (result.rows.length === 0) {
    const err = new Error('Resolution not found');
    err.status = 404;
    throw err;
  }
  return result.rows[0];
};

/**
 * Update a resolution.
 * @param {string|number} id
 * @param {object} data
 * @param {number} userId
 * @returns {Promise<object>}
 */
exports.updateResolution = async (
  id,
  {
    title,
    resolution_number,
    description,
    content,
    remarks,
    status,
    co_authors,
    whereas_clauses,
    effectivity_clause,
    attachments,
  },
  userId,
  userRole
) => {
  const existing = await Resolution.findById(id);
  if (existing.rows.length === 0) {
    const err = new Error('Resolution not found');
    err.status = 404;
    throw err;
  }

  if (userRole === 'Secretary' && existing.rows[0].status === 'Draft' && status === 'Submitted') {
    const err = new Error('Secretary is not allowed to submit draft resolutions as proposed measures');
    err.status = 403;
    throw err;
  }

  const normalizedCoAuthors = co_authors === undefined
    ? undefined
    : await normalizeCouncilorCoAuthors(co_authors);

  const result = await Resolution.update(
    id,
    title,
    resolution_number,
    description,
    content,
    remarks,
    status,
    normalizedCoAuthors,
    whereas_clauses,
    effectivity_clause,
    attachments
  );
  if (result.rows.length === 0) {
    const err = new Error('Resolution not found');
    err.status = 404;
    throw err;
  }

  const resolution = result.rows[0];
  await AuditLog.create(null, userId, 'RESOLUTION_UPDATE', `Resolution "${title}" updated`);

  const io = getIO();
  io.emit('resolutionUpdated', resolution);

  return resolution;
};

/**
 * Delete a resolution.
 * @param {string|number} id
 * @param {number} userId
 * @returns {Promise<void>}
 */
exports.deleteResolution = async (id, userId) => {
  const existing = await Resolution.findById(id);
  if (existing.rows.length === 0) {
    const err = new Error('Resolution not found');
    err.status = 404;
    throw err;
  }

  await Resolution.deleteById(id);
  await AuditLog.create(null, userId, 'RESOLUTION_DELETE', `Resolution "${existing.rows[0].title}" deleted`);
};

/**
 * Change the status of a resolution.
 * @param {string|number} id
 * @param {string} status
 * @returns {Promise<object>}
 */
exports.changeStatus = async (id, status, user) => {
  if (!VALID_STATUSES.includes(status)) {
    const err = new Error('Invalid status');
    err.status = 400;
    throw err;
  }

  const existing = await Resolution.findById(id);
  if (existing.rows.length === 0) {
    const err = new Error('Resolution not found');
    err.status = 404;
    throw err;
  }

  if (user?.role === 'Secretary' && existing.rows[0].status === 'Draft' && status === 'Submitted') {
    const err = new Error('Secretary is not allowed to submit draft resolutions as proposed measures');
    err.status = 403;
    throw err;
  }

  const result = await Resolution.updateStatus(id, status);
  if (result.rows.length === 0) {
    const err = new Error('Resolution not found');
    err.status = 404;
    throw err;
  }

  const resolution = result.rows[0];
  const io = getIO();
  io.emit('resolutionStatusChanged', resolution);

  return resolution;
};
