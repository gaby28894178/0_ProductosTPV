const { DataTypes } = require('sequelize');
const { sequelize } = require('../setup/database');

// Relaciona un producto final con una materia prima mayorista y su rendimiento por empaque
const ProductMaterial = sequelize.define('ProductMaterial', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  productId: { type: DataTypes.INTEGER, allowNull: false },
  materiaPrimaId: { type: DataTypes.INTEGER, allowNull: false },
  rendimientoLitrosPorEmpaque: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, {
  indexes: [
    { unique: true, fields: ['productId', 'materiaPrimaId'] },
  ]
});

module.exports = ProductMaterial;