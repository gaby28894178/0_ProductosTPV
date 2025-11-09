const { DataTypes } = require('sequelize');
const { sequelize } = require('../setup/database');

const Employee = sequelize.define('Employee', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  nombre: { type: DataTypes.STRING, allowNull: false },
  puesto: { type: DataTypes.STRING },
  sueldoMensual: { type: DataTypes.FLOAT, defaultValue: 0 },
  activo: { type: DataTypes.BOOLEAN, defaultValue: true },
});

module.exports = Employee;