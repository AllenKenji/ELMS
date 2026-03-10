const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const AuditLog = sequelize.define('AuditLog', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  action: { type: DataTypes.STRING, allowNull: false },
  details: { type: DataTypes.TEXT },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'audit_logs', timestamps: false });

module.exports = AuditLog;
