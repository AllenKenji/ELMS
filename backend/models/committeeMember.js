const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const CommitteeMember = sequelize.define('CommitteeMember', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  committee_id: { type: DataTypes.INTEGER, allowNull: false },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  role: {
    type: DataTypes.ENUM('Chair', 'Member', 'Secretary', 'Committee Secretary'),
    allowNull: false,
    defaultValue: 'Member'
  },
  joined_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'committee_members', timestamps: false });

CommitteeMember.associate = (models) => {
  CommitteeMember.belongsTo(models.Committee, { foreignKey: 'committee_id', as: 'committee' });
  CommitteeMember.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
};

module.exports = CommitteeMember;
