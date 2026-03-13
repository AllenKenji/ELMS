/**
 * Report Controller - Handles report HTTP requests.
 */
const reportService = require('../services/reportService');

/**
 * Create a new report.
 * POST /reports
 */
exports.create = async (req, res) => {
  try {
    const report = await reportService.createReport(req.body, req.user.id);
    res.status(201).json(report);
  } catch (err) {
    console.error('Report create error:', err);
    if (err.status === 400) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: 'Error creating report' });
  }
};

/**
 * Get all reports with pagination and filtering.
 * GET /reports
 */
exports.getAll = async (req, res) => {
  try {
    const result = await reportService.getAllReports(req.query);
    res.json(result);
  } catch (err) {
    console.error('Get reports error:', err);
    res.status(500).json({ error: 'Error fetching reports' });
  }
};

/**
 * Get a single report by ID.
 * GET /reports/:id
 */
exports.getById = async (req, res) => {
  try {
    const report = await reportService.getReportById(req.params.id);
    res.json(report);
  } catch (err) {
    console.error('Get report error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error fetching report' });
  }
};

/**
 * Update a report.
 * PUT /reports/:id
 */
exports.update = async (req, res) => {
  try {
    const report = await reportService.updateReport(req.params.id, req.body, req.user.id);
    res.json(report);
  } catch (err) {
    console.error('Report update error:', err);
    if (err.status === 400) return res.status(400).json({ error: err.message });
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error updating report' });
  }
};

/**
 * Delete a report.
 * DELETE /reports/:id
 */
exports.remove = async (req, res) => {
  try {
    await reportService.deleteReport(req.params.id, req.user.id);
    res.json({ message: 'Report deleted successfully' });
  } catch (err) {
    console.error('Report delete error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error deleting report' });
  }
};

/**
 * Export a report as CSV.
 * GET /reports/:id/export/csv
 */
exports.exportCsv = async (req, res) => {
  try {
    const { csvContent, filename } = await reportService.exportCsv(req.params.id);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (err) {
    console.error('Report CSV export error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error exporting report as CSV' });
  }
};

/**
 * Export a report for PDF generation.
 * GET /reports/:id/export/pdf
 */
exports.exportPdf = async (req, res) => {
  try {
    const data = await reportService.exportPdf(req.params.id);
    res.json(data);
  } catch (err) {
    console.error('Report PDF export error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error exporting report' });
  }
};
