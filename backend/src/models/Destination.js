const { DataTypes } = require('sequelize');
const { sequelize } = require('../setup/database');
const Customer = require('./Customer');

const Destination = sequelize.define('Destination', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  nombre: { type: DataTypes.STRING, allowNull: false },
  direccion: { type: DataTypes.STRING },
  ciudad: { type: DataTypes.STRING },
  contacto: { type: DataTypes.STRING },
});

Destination.belongsTo(Customer, { foreignKey: 'customerId' });

module.exports = Destination;