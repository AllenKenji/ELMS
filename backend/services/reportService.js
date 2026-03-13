/**
 * Report Service - Business logic for report operations.
 */
const Report = require('../models/Report');
const AuditLog = require('../models/AuditLog');
const { createNotification } = require('../utils/notifications');
const { getIO } = require('../socket');

const ALLOWED_SORT_FIELDS = ['created_at', 'title', 'bill_count', 'status', 'report_type'];
const ALLOWED_ORDERS = ['ASC', 'DESC'];
const ALLOWED_STATUSES = ['Draft', 'Generated', 'Archived'];

/**
 * Create a new report with aggregated data.
 * @param {object} data
 * @param {number} userId
 * @returns {Promise<object>}
 */
exports.createReport = async ({ title, description, report_type = 'all', date_range_start, date_range_end }, userId) => {
  if (!title || !title.trim()) {
    const err = new Error('Title is required');
    err.status = 400;
    throw err;
  }

  const { data, billCount } = await Report.aggregateData(report_type, date_range_start || null, date_range_end || null);

  const result = await Report.create(
    title.trim(), description ? description.trim() : null,
    report_type, date_range_start || null, date_range_end || null,
    billCount, data, userId
  );
  const report = result.rows[0];

  await AuditLog.create(null, userId, 'REPORT_CREATE', `Report "${title}" generated`);
  await createNotification(userId, `Report "${title}" has been generated.`);

  const io = getIO();
  io.to('Admin').emit('reportCreated', report);
  io.to('Secretary').emit('reportCreated', report);

  return report;
};

/**
 * Retrieve all reports with filtering and pagination.
 * @param {object} query
 * @returns {Promise<{reports: Array, pagination: object}>}
 */
exports.getAllReports = async ({ status, report_type, page = 1, limit = 10, sort = 'created_at', order = 'DESC' }) => {
  const safeSort = ALLOWED_SORT_FIELDS.includes(sort) ? `r.${sort}` : 'r.created_at';
  const safeOrder = ALLOWED_ORDERS.includes(order.toUpperCase()) ? order.toUpperCase() : 'DESC';
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));

  const { reports, total } = await Report.findAll(status, report_type, pageNum, limitNum, safeSort, safeOrder);

  return {
    reports,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    },
  };
};

/**
 * Retrieve a single report by ID.
 * @param {string|number} id
 * @returns {Promise<object>}
 */
exports.getReportById = async (id) => {
  const result = await Report.findById(id);
  if (result.rows.length === 0) {
    const err = new Error('Report not found');
    err.status = 404;
    throw err;
  }
  return result.rows[0];
};

/**
 * Update a report.
 * @param {string|number} id
 * @param {object} data
 * @param {number} userId
 * @returns {Promise<object>}
 */
exports.updateReport = async (id, { title, description, status }, userId) => {
  if (status && !ALLOWED_STATUSES.includes(status)) {
    const err = new Error(`Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const existing = await Report.findByIdRaw(id);
  if (existing.rows.length === 0) {
    const err = new Error('Report not found');
    err.status = 404;
    throw err;
  }

  const current = existing.rows[0];
  const result = await Report.update(
    id,
    title ? title.trim() : current.title,
    description !== undefined ? (description ? description.trim() : null) : current.description,
    status || current.status
  );
  const report = result.rows[0];

  await AuditLog.create(null, userId, 'REPORT_UPDATE', `Report "${report.title}" updated`);

  const io = getIO();
  io.to('Admin').emit('reportUpdated', report);
  io.to('Secretary').emit('reportUpdated', report);

  return report;
};

/**
 * Delete a report.
 * @param {string|number} id
 * @param {number} userId
 * @returns {Promise<void>}
 */
exports.deleteReport = async (id, userId) => {
  const existing = await Report.findByIdRaw(id);
  if (existing.rows.length === 0) {
    const err = new Error('Report not found');
    err.status = 404;
    throw err;
  }

  await Report.deleteById(id);
  await AuditLog.create(null, userId, 'REPORT_DELETE', `Report "${existing.rows[0].title}" deleted`);

  const io = getIO();
  io.to('Admin').emit('reportDeleted', { id });
  io.to('Secretary').emit('reportDeleted', { id });
};

/**
 * Export a report as CSV content.
 * @param {string|number} id
 * @returns {Promise<{csvContent: string, filename: string}>}
 */
exports.exportCsv = async (id) => {
  const result = await Report.findByIdRaw(id);
  if (result.rows.length === 0) {
    const err = new Error('Report not found');
    err.status = 404;
    throw err;
  }

  const report = result.rows[0];
  const generatedData = report.generated_data || {};
  const csvRows = [];

  csvRows.push(['Report Title', report.title]);
  csvRows.push(['Description', report.description || '']);
  csvRows.push(['Report Type', report.report_type]);
  csvRows.push(['Status', report.status]);
  csvRows.push(['Date Range Start', report.date_range_start || '']);
  csvRows.push(['Date Range End', report.date_range_end || '']);
  csvRows.push(['Bill Count', report.bill_count]);
  csvRows.push(['Generated At', new Date(report.created_at).toLocaleString()]);
  csvRows.push([]);

  if (generatedData.ordinances && generatedData.ordinances.length > 0) {
    csvRows.push(['--- Ordinances ---']);
    csvRows.push(['ID', 'Title', 'Number', 'Status', 'Proposer', 'Created At']);
    generatedData.ordinances.forEach((o) => {
      csvRows.push([o.id, o.title, o.ordinance_number || '', o.status, o.proposer_name || '', new Date(o.created_at).toLocaleDateString()]);
    });
    csvRows.push([]);
  }

  if (generatedData.resolutions && generatedData.resolutions.length > 0) {
    csvRows.push(['--- Resolutions ---']);
    csvRows.push(['ID', 'Title', 'Number', 'Status', 'Proposer', 'Created At']);
    generatedData.resolutions.forEach((r) => {
      csvRows.push([r.id, r.title, r.resolution_number || '', r.status, r.proposer_name || '', new Date(r.created_at).toLocaleDateString()]);
    });
    csvRows.push([]);
  }

  if (generatedData.sessions && generatedData.sessions.length > 0) {
    csvRows.push(['--- Sessions ---']);
    csvRows.push(['ID', 'Title', 'Date', 'Location', 'Created At']);
    generatedData.sessions.forEach((s) => {
      csvRows.push([s.id, s.title, new Date(s.date).toLocaleDateString(), s.location || '', new Date(s.created_at).toLocaleDateString()]);
    });
  }

  const csvContent = csvRows
    .map((row) =>
      row.map((cell) => {
        const str = String(cell ?? '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(',')
    )
    .join('\n');

  const filename = `report_${report.id}_${Date.now()}.csv`;
  return { csvContent, filename };
};

/**
 * Export a report summary for PDF generation.
 * @param {string|number} id
 * @returns {Promise<object>}
 */
exports.exportPdf = async (id) => {
  const result = await Report.findById(id);
  if (result.rows.length === 0) {
    const err = new Error('Report not found');
    err.status = 404;
    throw err;
  }

  const report = result.rows[0];
  const generatedData = report.generated_data || {};

  return {
    metadata: {
      title: report.title,
      description: report.description,
      reportType: report.report_type,
      status: report.status,
      dateRangeStart: report.date_range_start,
      dateRangeEnd: report.date_range_end,
      billCount: report.bill_count,
      createdBy: report.created_by_name,
      generatedAt: report.created_at,
    },
    data: generatedData,
  };
};
