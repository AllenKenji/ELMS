const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Committee = sequelize.define('Committee', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false, unique: true },
  description: { type: DataTypes.TEXT },
  chair_id: { type: DataTypes.INTEGER },
  status: {
    type: DataTypes.ENUM('Active', 'Inactive'),
    allowNull: false,
    defaultValue: 'Active'
  }
}, { tableName: 'committees', timestamps: true, underscored: true });

Committee.associate = (models) => {
  Committee.belongsTo(models.User, { foreignKey: 'chair_id', as: 'chair' });
  Committee.hasMany(models.CommitteeMember, { foreignKey: 'committee_id', as: 'members' });
};

module.exports = Committee;
