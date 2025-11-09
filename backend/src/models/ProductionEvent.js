const { DataTypes } = require('sequelize');
const { sequelize } = require('../setup/database');

// Evento de producción de litros de un producto usando una materia prima específica
const ProductionEvent = sequelize.define('ProductionEvent', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  productId: { type: DataTypes.INTEGER, allowNull: false },
  materiaPrimaId: { type: DataTypes.INTEGER, allowNull: false },
  litros: { type: DataTypes.INTEGER, allowNull: false },
  nota: { type: DataTypes.STRING },
}, {
  indexes: [
    { fields: ['productId', 'materiaPrimaId'] },
  ]
});

module.exports = ProductionEvent;