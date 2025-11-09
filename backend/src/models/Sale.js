const { DataTypes } = require('sequelize');
const { sequelize } = require('../setup/database');
const User = require('./User');

const Sale = sequelize.define('Sale', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  total: { type: DataTypes.FLOAT, allowNull: false },
});

Sale.belongsTo(User, { foreignKey: 'userId' });

module.exports = Sale;