/**
 * Audit Log Controller - Handles audit log HTTP requests.
 */
const auditLogService = require('../services/auditLogService');

/**
 * Get all audit logs.
 * GET /audit-logs
 */
exports.getAll = async (req, res) => {
  try {
    const logs = await auditLogService.getAllAuditLogs();
    res.json(logs);
  } catch (err) {
    console.error('Get audit logs error:', err);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
};
