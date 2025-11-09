const { DataTypes } = require('sequelize');
const { sequelize } = require('../setup/database');

const Product = sequelize.define('Product', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  nombre: { type: DataTypes.STRING, allowNull: false },
  // Nombre alternativo para mostrar en la boleta/factura
  nombreBoleta: { type: DataTypes.STRING },
  descripcion: { type: DataTypes.TEXT },
  unidad: { type: DataTypes.ENUM('litro', 'kilo'), allowNull: false },
  marca: { type: DataTypes.STRING },
  imagenUrl: { type: DataTypes.STRING },
  stock: { type: DataTypes.INTEGER, defaultValue: 0 },
  precioMayorista: { type: DataTypes.FLOAT, allowNull: false },
  precioPublico: { type: DataTypes.FLOAT, allowNull: false },
  esMayorista: { type: DataTypes.BOOLEAN, defaultValue: false },
  // Para productos mayoristas (materia prima), litros que se pueden preparar por cada empaque
  rendimientoLitrosPorEmpaque: { type: DataTypes.INTEGER, defaultValue: 0 },
});

module.exports = Product;