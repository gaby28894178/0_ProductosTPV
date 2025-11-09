const { DataTypes } = require('sequelize');
const { sequelize } = require('../setup/database');

const Config = sequelize.define('Config', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  capitalInicial: { type: DataTypes.FLOAT, defaultValue: 0 },
  capitalExtra: { type: DataTypes.FLOAT, defaultValue: 0 },
  proyeccionSemanal: { type: DataTypes.FLOAT, defaultValue: 0 },
  proyeccionMensual: { type: DataTypes.FLOAT, defaultValue: 0 },
  backupName: { type: DataTypes.STRING },
  // Respaldo semanal
  backupSemanalActivo: { type: DataTypes.BOOLEAN, defaultValue: false },
  // Día de la semana para respaldo: 0 (domingo) .. 6 (sábado)
  backupSemanalDia: { type: DataTypes.INTEGER, defaultValue: 1 },
  // Hora en formato HH:mm (local)
  backupSemanalHora: { type: DataTypes.STRING, defaultValue: '09:00' },
});

module.exports = Config;