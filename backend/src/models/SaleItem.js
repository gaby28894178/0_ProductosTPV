const { DataTypes } = require('sequelize');
const { sequelize } = require('../setup/database');
const Sale = require('./Sale');
const Product = require('./Product');

const SaleItem = sequelize.define('SaleItem', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  quantity: { type: DataTypes.FLOAT, allowNull: false },
  pricePublico: { type: DataTypes.FLOAT, allowNull: false },
});

SaleItem.belongsTo(Sale, { foreignKey: 'saleId' });
Sale.hasMany(SaleItem, { foreignKey: 'saleId' });
SaleItem.belongsTo(Product, { foreignKey: 'productId' });

module.exports = SaleItem;