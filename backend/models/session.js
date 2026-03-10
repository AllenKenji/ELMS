const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Session = sequelize.define('Session', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING, allowNull: false },
  date: { type: DataTypes.DATE, allowNull: false },
  minutes: { type: DataTypes.TEXT }
}, { tableName: 'sessions', timestamps: true });

module.exports = Session;
