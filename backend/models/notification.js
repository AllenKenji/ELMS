const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Notification = sequelize.define('Notification', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  message: { type: DataTypes.STRING, allowNull: false },
  type: { type: DataTypes.ENUM('Login', 'Logout', 'Ordinance', 'Resolution', 'Session'), allowNull: false },
  user_id: { type: DataTypes.INTEGER, allowNull: false }
}, { tableName: 'notifications', timestamps: true });

module.exports = Notification;
