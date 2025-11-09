const { DataTypes } = require('sequelize');
const { sequelize } = require('../setup/database');
const Employee = require('./Employee');

// Registro de movimientos de empleados: pagos y cobros
const EmployeePayment = sequelize.define('EmployeePayment', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  tipo: { type: DataTypes.STRING, allowNull: false, defaultValue: 'pago' }, // 'pago' | 'cobro'
  categoria: { type: DataTypes.STRING }, // 'adelanto' | 'sueldo'
  mes: { type: DataTypes.STRING }, // YYYY-MM
  descripcion: { type: DataTypes.STRING },
  monto: { type: DataTypes.FLOAT, allowNull: false },
  fecha: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
});

EmployeePayment.belongsTo(Employee, { foreignKey: 'employeeId' });
Employee.hasMany(EmployeePayment, { foreignKey: 'employeeId' });

module.exports = EmployeePayment;