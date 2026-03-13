// routes/reports.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const authorizeRoles = require('../middleware/roles');
const { createNotification } = require('../utils/notifications');
const { getIO } = require('../socket');

// ============================================
// HELPER: aggregate legislative data for a report
// ============================================
async function aggregateReportData(reportType, startDate, endDate) {
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
}

// ============================================
// CREATE report
// ============================================
router.post(
  '/',
  authenticateToken,
  authorizeRoles('Admin', 'Secretary', 'Councilor', 'DILG Official'),
  async (req, res) => {
    const { title, description, report_type = 'all', date_range_start, date_range_end } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    try {
      const { data, billCount } = await aggregateReportData(
        report_type,
        date_range_start || null,
        date_range_end || null
      );

      const result = await pool.query(
        `INSERT INTO reports
          (title, description, report_type, date_range_start, date_range_end, bill_count, status, generated_data, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'Generated', $7, $8, NOW(), NOW())
         RETURNING *`,
        [
          title.trim(),
          description ? description.trim() : null,
          report_type,
          date_range_start || null,
          date_range_end || null,
          billCount,
          JSON.stringify(data),
          req.user.id,
        ]
      );

      const report = result.rows[0];

      // Audit log
      await pool.query(
        `INSERT INTO audit_logs (user_id, action, details, timestamp)
         VALUES ($1, $2, $3, NOW())`,
        [req.user.id, 'REPORT_CREATE', `Report "${title}" generated`]
      );

      // Notify creator
      await createNotification(req.user.id, `Report "${title}" has been generated.`);

      // Broadcast to relevant roles
      const io = getIO();
      io.to('Admin').emit('reportCreated', report);
      io.to('Secretary').emit('reportCreated', report);

      res.status(201).json(report);
    } catch (err) {
      console.error('Report create error:', err);
      res.status(500).json({ error: 'Error creating report' });
    }
  }
);

// ============================================
// READ all reports (with filtering & pagination)
// ============================================
router.get('/', authenticateToken, async (req, res) => {
  const {
    status,
    report_type,
    page = 1,
    limit = 10,
    sort = 'created_at',
    order = 'DESC',
  } = req.query;

  const allowedSortFields = ['created_at', 'title', 'bill_count', 'status', 'report_type'];
  const allowedOrders = ['ASC', 'DESC'];
  const safeSort = allowedSortFields.includes(sort) ? `r.${sort}` : 'r.created_at';
  const safeOrder = allowedOrders.includes(order.toUpperCase()) ? order.toUpperCase() : 'DESC';

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const offset = (pageNum - 1) * limitNum;

  const conditions = [];
  const params = [];

  if (status) {
    params.push(status);
    conditions.push(`r.status = $${params.length}`);
  }
  if (report_type) {
    params.push(report_type);
    conditions.push(`r.report_type = $${params.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    // Total count for pagination
    const countRes = await pool.query(
      `SELECT COUNT(*) FROM reports r ${whereClause}`,
      params
    );
    const total = parseInt(countRes.rows[0].count, 10);

    // Paginated results
    params.push(limitNum, offset);
    const result = await pool.query(
      `SELECT
         r.*,
         u.name AS created_by_name
       FROM reports r
       LEFT JOIN users u ON u.id = r.created_by
       ${whereClause}
       ORDER BY ${safeSort} ${safeOrder}
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      reports: result.rows,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error('Get reports error:', err);
    res.status(500).json({ error: 'Error fetching reports' });
  }
});

// ============================================
// READ single report
// ============================================
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         r.*,
         u.name AS created_by_name
       FROM reports r
       LEFT JOIN users u ON u.id = r.created_by
       WHERE r.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get report error:', err);
    res.status(500).json({ error: 'Error fetching report' });
  }
});

// ============================================
// UPDATE report (title, description, status)
// ============================================
router.put(
  '/:id',
  authenticateToken,
  authorizeRoles('Admin', 'Secretary', 'Councilor', 'DILG Official'),
  async (req, res) => {
    const { title, description, status } = req.body;
    const allowedStatuses = ['Draft', 'Generated', 'Archived'];

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Allowed: ${allowedStatuses.join(', ')}` });
    }

    try {
      // Fetch existing report
      const existing = await pool.query('SELECT * FROM reports WHERE id = $1', [req.params.id]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Report not found' });
      }

      const current = existing.rows[0];
      const result = await pool.query(
        `UPDATE reports
         SET title = $1, description = $2, status = $3, updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [
          title ? title.trim() : current.title,
          description !== undefined ? (description ? description.trim() : null) : current.description,
          status || current.status,
          req.params.id,
        ]
      );

      const report = result.rows[0];

      // Audit log
      await pool.query(
        `INSERT INTO audit_logs (user_id, action, details, timestamp)
         VALUES ($1, $2, $3, NOW())`,
        [req.user.id, 'REPORT_UPDATE', `Report "${report.title}" updated`]
      );

      const io = getIO();
      io.to('Admin').emit('reportUpdated', report);
      io.to('Secretary').emit('reportUpdated', report);

      res.json(report);
    } catch (err) {
      console.error('Report update error:', err);
      res.status(500).json({ error: 'Error updating report' });
    }
  }
);

// ============================================
// DELETE report
// ============================================
router.delete(
  '/:id',
  authenticateToken,
  authorizeRoles('Admin', 'Secretary'),
  async (req, res) => {
    try {
      const existing = await pool.query('SELECT * FROM reports WHERE id = $1', [req.params.id]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Report not found' });
      }

      const report = existing.rows[0];
      await pool.query('DELETE FROM reports WHERE id = $1', [req.params.id]);

      // Audit log
      await pool.query(
        `INSERT INTO audit_logs (user_id, action, details, timestamp)
         VALUES ($1, $2, $3, NOW())`,
        [req.user.id, 'REPORT_DELETE', `Report "${report.title}" deleted`]
      );

      const io = getIO();
      io.to('Admin').emit('reportDeleted', { id: req.params.id });
      io.to('Secretary').emit('reportDeleted', { id: req.params.id });

      res.json({ message: 'Report deleted successfully' });
    } catch (err) {
      console.error('Report delete error:', err);
      res.status(500).json({ error: 'Error deleting report' });
    }
  }
);

// ============================================
// EXPORT report as CSV
// ============================================
router.get('/:id/export/csv', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM reports WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const report = result.rows[0];
    const generatedData = report.generated_data || {};

    const csvRows = [];

    // Report header metadata
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
        csvRows.push([
          o.id,
          o.title,
          o.ordinance_number || '',
          o.status,
          o.proposer_name || '',
          new Date(o.created_at).toLocaleDateString(),
        ]);
      });
      csvRows.push([]);
    }

    if (generatedData.resolutions && generatedData.resolutions.length > 0) {
      csvRows.push(['--- Resolutions ---']);
      csvRows.push(['ID', 'Title', 'Number', 'Status', 'Proposer', 'Created At']);
      generatedData.resolutions.forEach((r) => {
        csvRows.push([
          r.id,
          r.title,
          r.resolution_number || '',
          r.status,
          r.proposer_name || '',
          new Date(r.created_at).toLocaleDateString(),
        ]);
      });
      csvRows.push([]);
    }

    if (generatedData.sessions && generatedData.sessions.length > 0) {
      csvRows.push(['--- Sessions ---']);
      csvRows.push(['ID', 'Title', 'Date', 'Location', 'Created At']);
      generatedData.sessions.forEach((s) => {
        csvRows.push([
          s.id,
          s.title,
          new Date(s.date).toLocaleDateString(),
          s.location || '',
          new Date(s.created_at).toLocaleDateString(),
        ]);
      });
    }

    // Convert to CSV string, escaping commas and quotes
    const csvContent = csvRows
      .map((row) =>
        row
          .map((cell) => {
            const str = String(cell ?? '');
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(',')
      )
      .join('\n');

    const filename = `report_${report.id}_${Date.now()}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (err) {
    console.error('Report CSV export error:', err);
    res.status(500).json({ error: 'Error exporting report as CSV' });
  }
});

// ============================================
// EXPORT report summary as plain text (PDF-ready)
// ============================================
router.get('/:id/export/pdf', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, u.name AS created_by_name
       FROM reports r
       LEFT JOIN users u ON u.id = r.created_by
       WHERE r.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const report = result.rows[0];
    const generatedData = report.generated_data || {};

    // Return structured JSON for client-side PDF generation
    res.json({
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
    });
  } catch (err) {
    console.error('Report PDF export error:', err);
    res.status(500).json({ error: 'Error exporting report' });
  }
});

module.exports = router;
