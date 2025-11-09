const express = require('express');
const auth = require('../middleware/auth');
const Expense = require('../models/Expense');
const EmployeePayment = require('../models/EmployeePayment');
const Employee = require('../models/Employee');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  const rows = await Expense.findAll({ order: [['fecha', 'DESC']] });
  res.json(rows);
});

router.post('/', auth, async (req, res) => {
  try {
    let { tipo, descripcion, monto, employeeId } = req.body;
    const value = Number(monto);
    if (!Number.isFinite(value)) return res.status(400).json({ error: 'Monto inválido' });

    // Normalizar cobro_empleado como gasto negativo
    let expMonto = value;
    if (tipo === 'cobro_empleado') expMonto = -Math.abs(value);

    const expense = await Expense.create({ tipo, descripcion, monto: expMonto });

    // Si se indica empleado, crear también el movimiento correspondiente
    if (employeeId && (tipo === 'pago_empleado' || tipo === 'cobro_empleado')) {
      const emp = await Employee.findByPk(employeeId);
      if (!emp) return res.status(404).json({ error: 'Empleado no encontrado' });
      const movTipo = tipo === 'cobro_empleado' ? 'cobro' : 'pago';
      const movMonto = Math.abs(value);
      const desc = descripcion || `${movTipo === 'pago' ? 'Pago a' : 'Cobro de'} ${emp.nombre}`;
      const mov = await EmployeePayment.create({ employeeId: emp.id, tipo: movTipo, monto: movMonto, descripcion: desc });
      return res.json({ ok: true, expense, movement: mov });
    }

    res.json(expense);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  const row = await Expense.findByPk(req.params.id);
  if (!row) return res.status(404).json({ error: 'No encontrado' });
  await row.destroy();
  res.json({ ok: true });
});

module.exports = router;