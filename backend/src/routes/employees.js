const express = require('express');
const auth = require('../middleware/auth');
const Employee = require('../models/Employee');
const Expense = require('../models/Expense');
const EmployeePayment = require('../models/EmployeePayment');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  const rows = await Employee.findAll({ order: [['id', 'DESC']] });
  res.json(rows);
});

router.post('/', auth, async (req, res) => {
  try {
    const row = await Employee.create(req.body);
    res.json(row);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  const row = await Employee.findByPk(req.params.id);
  if (!row) return res.status(404).json({ error: 'No encontrado' });
  await row.destroy();
  res.json({ ok: true });
});

// Registrar pago a empleado -> se descuenta en gastos
router.post('/:id/pagos', auth, async (req, res) => {
  const emp = await Employee.findByPk(req.params.id);
  if (!emp) return res.status(404).json({ error: 'Empleado no encontrado' });
  const { monto, descripcion, categoria, mes } = req.body;
  const value = Number(monto);
  if (!Number.isFinite(value) || value <= 0) return res.status(400).json({ error: 'Monto inválido' });
  const cat = (categoria || 'sueldo').toLowerCase();
  // Permitir nuevas categorías: aguinaldo y vacaciones
  if (!['adelanto','sueldo','aguinaldo','vacaciones'].includes(cat)) {
    return res.status(400).json({ error: 'Categoria inválida (use "adelanto", "sueldo", "aguinaldo" o "vacaciones")' });
  }
  // Helper: mes anterior (YYYY-MM)
  const prevMonthStr = (() => {
    const d = new Date();
    const y = d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear();
    const mIdx = d.getMonth() === 0 ? 11 : d.getMonth() - 1; // 0-based
    const m = String(mIdx + 1).padStart(2, '0');
    return `${y}-${m}`;
  })();
  // Validar sueldo: solo se permite pagar el mes anterior
  if (cat === 'sueldo') {
    if (typeof mes !== 'string' || !/^\d{4}-\d{2}$/.test(mes)) {
      return res.status(400).json({ error: `Mes inválido, use YYYY-MM (permitido solo ${prevMonthStr})` });
    }
    if (mes !== prevMonthStr) {
      return res.status(400).json({ error: `Solo se puede pagar el mes anterior (${prevMonthStr}). Mes solicitado: ${mes}` });
    }
  }
  const now = new Date();
  const monthStr = cat === 'sueldo'
    ? mes
    : `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const desc = descripcion || (
    cat==='adelanto' ? `Adelanto ${monthStr} a ${emp.nombre}`
    : cat==='aguinaldo' ? `Aguinaldo ${monthStr} a ${emp.nombre}`
    : cat==='vacaciones' ? `Vacaciones ${monthStr} a ${emp.nombre}`
    : `Pago de sueldo ${monthStr} a ${emp.nombre}`
  );
  const gasto = await Expense.create({ tipo: 'pago_empleado', monto: value, descripcion: desc });
  const mov = await EmployeePayment.create({ employeeId: emp.id, tipo: 'pago', categoria: cat, mes: monthStr, monto: value, descripcion: desc });
  res.json({ ok: true, expense: gasto, movement: mov });
});

// Registrar cobro a empleado -> se registra como gasto negativo y movimiento
router.post('/:id/cobros', auth, async (req, res) => {
  const emp = await Employee.findByPk(req.params.id);
  if (!emp) return res.status(404).json({ error: 'Empleado no encontrado' });
  const { monto, descripcion } = req.body;
  const value = Number(monto);
  if (!Number.isFinite(value) || value <= 0) return res.status(400).json({ error: 'Monto inválido' });
  const desc = descripcion || `Cobro de ${emp.nombre}`;
  const gasto = await Expense.create({ tipo: 'cobro_empleado', monto: -value, descripcion: desc });
  const mov = await EmployeePayment.create({ employeeId: emp.id, tipo: 'cobro', monto: value, descripcion: desc });
  res.json({ ok: true, expense: gasto, movement: mov });
});

// Listar movimientos de pagos/cobros de todos los empleados (desc por fecha)
router.get('/payments', auth, async (req, res) => {
  const rows = await EmployeePayment.findAll({ include: [Employee], order: [['fecha','DESC'], ['id','DESC']] });
  res.json(rows);
});

// Listar movimientos por empleado
router.get('/:id/payments', auth, async (req, res) => {
  const emp = await Employee.findByPk(req.params.id);
  if (!emp) return res.status(404).json({ error: 'Empleado no encontrado' });
  const rows = await EmployeePayment.findAll({ where: { employeeId: emp.id }, order: [['fecha','DESC'], ['id','DESC']] });
  res.json(rows);
});

// Resumen de sueldo del mes: sueldoMensual - sum(pagos del mes)
router.get('/:id/salary/:mes', auth, async (req, res) => {
  const emp = await Employee.findByPk(req.params.id);
  if (!emp) return res.status(404).json({ error: 'Empleado no encontrado' });
  const mes = req.params.mes;
  if (!/^\d{4}-\d{2}$/.test(mes)) return res.status(400).json({ error: 'Mes inválido, use YYYY-MM' });
  const pagosMes = await EmployeePayment.sum('monto', { where: { employeeId: emp.id, tipo: 'pago', mes } }) || 0;
  const restante = Number(emp.sueldoMensual || 0) - Number(pagosMes || 0);
  res.json({ empleado: emp.nombre, sueldoMensual: Number(emp.sueldoMensual||0), mes, pagosMes: Number(pagosMes||0), restante });
});

module.exports = router;