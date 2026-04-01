/**
 * Audit Log Service - Business logic for audit log retrieval.
 */
const AuditLog = require('../models/AuditLog');

/**
 * Retrieve all audit logs.
 * @returns {Promise<Array>}
 */
exports.getAllAuditLogs = async () => {
  const result = await AuditLog.findAll();
  return result.rows;
};
