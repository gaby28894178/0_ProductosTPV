const { DataTypes } = require('sequelize');
const { sequelize } = require('../setup/database');

const Customer = sequelize.define('Customer', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  nombre: { type: DataTypes.STRING, allowNull: false },
  direccion: { type: DataTypes.STRING },
  ciudad: { type: DataTypes.STRING },
  documento: { type: DataTypes.STRING },
  email: { type: DataTypes.STRING },
  telefono: { type: DataTypes.STRING },
});

module.exports = Customer;