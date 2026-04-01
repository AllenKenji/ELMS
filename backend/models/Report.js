/**
 * Report Model - Data access layer for report operations.
 */
const pool = require('../db');

/**
 * Aggregate legislative data for a report based on type and date range.
 * @param {string} reportType
 * @param {string|null} startDate
 * @param {string|null} endDate
 * @returns {Promise<{data: object, billCount: number}>}
 */
exports.aggregateData = async (reportType, startDate, endDate) => {
  const buildFilter = (col) => {
    const params = [];
    const conditions = [];
    if (startDate) {
      params.push(startDate);
      conditions.push(`${col} >= $${params.length}`);
    }
    if (endDate) {
      params.push(endDate);
      conditions.push(`${col} <= $${params.length}`);
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return { whereClause, params };
  };

  const data = {};
  let billCount = 0;

  if (reportType === 'all' || reportType === 'ordinances') {
    const { whereClause, params } = buildFilter('created_at');
    const res = await pool.query(
      `SELECT id, title, ordinance_number, status, proposer_name, created_at
       FROM ordinances ${whereClause} ORDER BY created_at DESC`,
      params
    );
    data.ordinances = res.rows;
    billCount += res.rows.length;
  }

  if (reportType === 'all' || reportType === 'resolutions') {
    const { whereClause, params } = buildFilter('created_at');
    const res = await pool.query(
      `SELECT id, title, resolution_number, status, proposer_name, created_at
       FROM resolutions ${whereClause} ORDER BY created_at DESC`,
      params
    );
    data.resolutions = res.rows;
    billCount += res.rows.length;
  }

  if (reportType === 'all' || reportType === 'sessions') {
    const { whereClause, params } = buildFilter('date');
    const res = await pool.query(
      `SELECT id, title, date, location, agenda, created_at
       FROM sessions ${whereClause} ORDER BY date DESC`,
      params
    );
    data.sessions = res.rows;
    billCount += res.rows.length;
  }

  return { data, billCount };
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.create = async (title, description, reportType, dateRangeStart, dateRangeEnd, billCount, generatedData, createdBy) => {
  return pool.query(
    `INSERT INTO reports
       (title, description, report_type, date_range_start, date_range_end, bill_count, status, generated_data, created_by, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'Generated', $7, $8, NOW(), NOW())
     RETURNING *`,
    [title, description || null, reportType, dateRangeStart || null, dateRangeEnd || null, billCount, JSON.stringify(generatedData), createdBy]
  );
};

/** @returns {Promise<{reports: Array, total: number}>} */
exports.findAll = async (status, reportType, pageNum, limitNum, safeSort, safeOrder) => {
  const conditions = [];
  const params = [];

  if (status) {
    params.push(status);
    conditions.push(`r.status = $${params.length}`);
  }
  if (reportType) {
    params.push(reportType);
    conditions.push(`r.report_type = $${params.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (pageNum - 1) * limitNum;

  const countRes = await pool.query(
    `SELECT COUNT(*) FROM reports r ${whereClause}`,
    params
  );
  const total = parseInt(countRes.rows[0].count, 10);

  params.push(limitNum, offset);
  const result = await pool.query(
    `SELECT r.*, u.name AS created_by_name
     FROM reports r
     LEFT JOIN users u ON u.id = r.created_by
     ${whereClause}
     ORDER BY ${safeSort} ${safeOrder}
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return { reports: result.rows, total };
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.findById = async (id) => {
  return pool.query(
    `SELECT r.*, u.name AS created_by_name
     FROM reports r
     LEFT JOIN users u ON u.id = r.created_by
     WHERE r.id = $1`,
    [id]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.findByIdRaw = async (id) => {
  return pool.query('SELECT * FROM reports WHERE id = $1', [id]);
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.update = async (id, title, description, status) => {
  return pool.query(
    `UPDATE reports
     SET title = $1, description = $2, status = $3, updated_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [title, description, status, id]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.deleteById = async (id) => {
  return pool.query('DELETE FROM reports WHERE id = $1', [id]);
};
