const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Resolution = sequelize.define('Resolution', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  status: { type: DataTypes.ENUM('Draft', 'Pending', 'Approved', 'Rejected'), defaultValue: 'Draft' },
  session_id: { type: DataTypes.INTEGER, allowNull: false },
  author_id: { type: DataTypes.INTEGER, allowNull: false }
}, { tableName: 'resolutions', timestamps: true });

module.exports = Resolution;
