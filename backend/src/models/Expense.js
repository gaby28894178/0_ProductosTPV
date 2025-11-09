const { DataTypes } = require('sequelize');
const { sequelize } = require('../setup/database');

const Expense = sequelize.define('Expense', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  // Usamos STRING para permitir nuevas categorías sin migraciones complejas en SQLite
  tipo: { type: DataTypes.STRING, allowNull: false, defaultValue: 'gasto' },
  descripcion: { type: DataTypes.STRING },
  monto: { type: DataTypes.FLOAT, allowNull: false },
  fecha: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
});

module.exports = Expense;