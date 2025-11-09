const express = require('express');
const { Op } = require('sequelize');
const auth = require('../middleware/auth');
const Sale = require('../models/Sale');
const Expense = require('../models/Expense');
const SaleItem = require('../models/SaleItem');
const Product = require('../models/Product');
const dayjs = require('dayjs');

const router = express.Router();

function periodRange(period) {
  const now = dayjs();
  if (period === 'day') return { start: now.startOf('day'), end: now.endOf('day') };
  if (period === 'week') return { start: now.startOf('week'), end: now.endOf('week') };
  if (period === 'month') return { start: now.startOf('month'), end: now.endOf('month') };
  return { start: now.startOf('day'), end: now.endOf('day') };
}

router.get('/summary', auth, async (req, res) => {
  const { period = 'day' } = req.query;
  const { start, end } = periodRange(period);
  const sales = await Sale.findAll({ where: { createdAt: { [Op.between]: [start.toDate(), end.toDate()] } } });
  const expenses = await Expense.findAll({ where: { fecha: { [Op.between]: [start.toDate(), end.toDate()] } }, order: [['fecha','DESC']] });
  const totalVentas = sales.reduce((a, b) => a + b.total, 0);
  const totalGastos = expenses.reduce((a, b) => a + b.monto, 0);
  const ganancia = totalVentas - totalGastos;
  const pagos = expenses
    .filter(e => e.tipo === 'pago_empleado' || e.tipo === 'pago_proveedor' || e.tipo === 'cobro_empleado')
    .map(e => ({ id: e.id, tipo: e.tipo, descripcion: e.descripcion, monto: e.monto, fecha: e.fecha }));
  const gastos = expenses.map(e => ({ id: e.id, tipo: e.tipo, descripcion: e.descripcion, monto: e.monto, fecha: e.fecha }));

  // Conteo de productos vendidos en el período
  const saleIds = sales.map(s => s.id);
  let productCounts = [];
  let totalQuantity = 0;
  if (saleIds.length > 0) {
    const items = await SaleItem.findAll({ where: { saleId: { [Op.in]: saleIds } }, include: [{ model: Product }] });
    const map = new Map();
    for (const it of items) {
      const key = it.productId;
      const prod = it.Product;
      const name = prod?.nombre || `Producto #${it.productId}`;
      const prev = map.get(key) || { productId: key, nombre: name, count: 0, revenue: 0, stock: prod?.stock ?? null, precioPublico: prod?.precioPublico ?? null };
      prev.count += Number(it.quantity||0);
      prev.revenue += Number(it.pricePublico||0) * Number(it.quantity||0);
      // Mantener último stock y precio público conocidos del producto
      prev.stock = prod?.stock ?? prev.stock ?? null;
      prev.precioPublico = prod?.precioPublico ?? prev.precioPublico ?? null;
      totalQuantity += Number(it.quantity||0);
      map.set(key, prev);
    }
    // Enriquecer datos con consulta directa a Product para asegurar stock y precio
    const ids = Array.from(map.keys());
    if (ids.length > 0) {
      const prods = await Product.findAll({ where: { id: { [Op.in]: ids } }, attributes: ['id','stock','precioPublico','nombre'] });
      for (const p of prods) {
        const entry = map.get(p.id);
        if (entry) {
          entry.stock = Number.isFinite(Number(p.stock)) ? Math.trunc(Number(p.stock)) : entry.stock ?? 0;
          entry.precioPublico = Number.isFinite(Number(p.precioPublico)) ? Number(p.precioPublico) : entry.precioPublico ?? 0;
          entry.nombre = entry.nombre || p.nombre;
          map.set(p.id, entry);
        }
      }
    }
    productCounts = Array.from(map.values()).sort((a,b)=> b.count - a.count).slice(0, 10);
  }

  // Proyección simple basada en el período actual
  // Para 'day': semana = ventas*7, mes = ventas*30
  // Para 'week': mes = ventas*4, día = ventas/7
  // Para 'month': semana = ventas/4, día = ventas/30
  const projection = (()=>{
    const v = totalVentas;
    if (period === 'day') return { nextDay: v, nextWeek: v * 7, nextMonth: v * 30 };
    if (period === 'week') return { nextDay: v / 7, nextWeek: v, nextMonth: v * 4 };
    return { nextDay: v / 30, nextWeek: v / 4, nextMonth: v };
  })();

  res.json({ totalVentas, totalGastos, ganancia, pagos, gastos, productCounts, totalQuantity, projection });
});

// Generar PDF del resumen del dashboard para el período seleccionado
const { createDashboardDoc, dashboardReportFilePath } = require('../utils/dashboardReport');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
router.get('/invoice', auth, async (req, res) => {
  const { period = 'day' } = req.query;
  const { start, end } = periodRange(period);
  const sales = await Sale.findAll({ where: { createdAt: { [Op.between]: [start.toDate(), end.toDate()] } } });
  const expenses = await Expense.findAll({ where: { fecha: { [Op.between]: [start.toDate(), end.toDate()] } }, order: [['fecha','DESC']] });
  const totalVentas = sales.reduce((a, b) => a + b.total, 0);
  const totalGastos = expenses.reduce((a, b) => a + b.monto, 0);
  const ganancia = totalVentas - totalGastos;
  const pagos = expenses
    .filter(e => e.tipo === 'pago_empleado' || e.tipo === 'pago_proveedor' || e.tipo === 'cobro_empleado')
    .map(e => ({ id: e.id, tipo: e.tipo, descripcion: e.descripcion, monto: e.monto, fecha: e.fecha }));

  // Conteo de productos vendidos (para el PDF)
  const saleIds = sales.map(s => s.id);
  let productCounts = [];
  if (saleIds.length > 0) {
    const items = await SaleItem.findAll({ where: { saleId: { [Op.in]: saleIds } }, include: [{ model: Product }] });
    const map = new Map();
    for (const it of items) {
      const key = it.productId;
      const prod = it.Product;
      const name = prod?.nombre || `Producto #${it.productId}`;
      const prev = map.get(key) || { productId: key, nombre: name, count: 0, revenue: 0, stock: prod?.stock ?? null, precioPublico: prod?.precioPublico ?? null };
      prev.count += Number(it.quantity||0);
      prev.revenue += Number(it.pricePublico||0) * Number(it.quantity||0);
      prev.stock = prod?.stock ?? prev.stock ?? null;
      prev.precioPublico = prod?.precioPublico ?? prev.precioPublico ?? null;
      map.set(key, prev);
    }
    // Enriquecer datos con consulta directa a Product para asegurar stock y precio
    const ids = Array.from(map.keys());
    if (ids.length > 0) {
      const prods = await Product.findAll({ where: { id: { [Op.in]: ids } }, attributes: ['id','stock','precioPublico','nombre'] });
      for (const p of prods) {
        const entry = map.get(p.id);
        if (entry) {
          entry.stock = Number.isFinite(Number(p.stock)) ? Math.trunc(Number(p.stock)) : entry.stock ?? 0;
          entry.precioPublico = Number.isFinite(Number(p.precioPublico)) ? Number(p.precioPublico) : entry.precioPublico ?? 0;
          entry.nombre = entry.nombre || p.nombre;
          map.set(p.id, entry);
        }
      }
    }
    productCounts = Array.from(map.values()).sort((a,b)=> b.count - a.count).slice(0, 10);
  }

  // Proyección igual que summary
  const projection = (()=>{
    const v = totalVentas;
    if (period === 'day') return { nextDay: v, nextWeek: v * 7, nextMonth: v * 30 };
    if (period === 'week') return { nextDay: v / 7, nextWeek: v, nextMonth: v * 4 };
    return { nextDay: v / 30, nextWeek: v / 4, nextMonth: v };
  })();

  // Desglose por categorías (coincide con frontend)
  const groupSums = { rojo:0, amarillo:0, lila:0, naranja:0 };
  expenses.forEach(g => {
    const t = g.tipo;
    if (['gasto','consumos','varios','servicios'].includes(t)) groupSums.rojo += g.monto;
    else if (['pago_proveedor','insumo_mayorista','insumo_minorista'].includes(t)) groupSums.amarillo += g.monto;
    else if (['pago_empleado','electronicos_oficina','cobro_empleado'].includes(t)) groupSums.lila += g.monto;
    else if (['construccion','vehiculo','oficina','herramientas'].includes(t)) groupSums.naranja += g.monto;
  });

  // Crear PDF y enviar inline + guardar en disco
  const baseDir = path.join(__dirname, '..', '..', 'facturas');
  fs.mkdirSync(baseDir, { recursive: true });
  const file = dashboardReportFilePath(baseDir);
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const companyCfg = (() => {
    try {
      const p = path.join(__dirname, '..', '..', 'assets', 'company.json');
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch { return {}; }
  })();
  const doc = createDashboardDoc({ period, summary: { totalVentas, totalGastos, ganancia, pagos, groupSums, productCounts, projection }, company: companyCfg });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="dashboard_${period}.pdf"`);
  const ws = fs.createWriteStream(file);
  doc.pipe(ws);
  doc.pipe(res);
  doc.end();
});

// Enviar PDF del dashboard por correo electrónico
router.post('/email', auth, async (req, res) => {
  const { period = 'day' } = req.query;
  const { emails = [], subject, html, text } = req.body || {};
  let recipients = emails;
  if (typeof recipients === 'string') recipients = recipients.split(',').map(e => e.trim()).filter(Boolean);
  if (!Array.isArray(recipients) || recipients.length === 0) return res.status(400).json({ error: 'Destinatarios requeridos (emails)' });

  const { start, end } = periodRange(period);
  const sales = await Sale.findAll({ where: { createdAt: { [Op.between]: [start.toDate(), end.toDate()] } } });
  const expenses = await Expense.findAll({ where: { fecha: { [Op.between]: [start.toDate(), end.toDate()] } }, order: [['fecha','DESC']] });
  const totalVentas = sales.reduce((a, b) => a + b.total, 0);
  const totalGastos = expenses.reduce((a, b) => a + b.monto, 0);
  const ganancia = totalVentas - totalGastos;
  const pagos = expenses
    .filter(e => e.tipo === 'pago_empleado' || e.tipo === 'pago_proveedor' || e.tipo === 'cobro_empleado')
    .map(e => ({ id: e.id, tipo: e.tipo, descripcion: e.descripcion, monto: e.monto, fecha: e.fecha }));
  const groupSums = { rojo:0, amarillo:0, lila:0, naranja:0 };
  expenses.forEach(g => {
    const t = g.tipo;
    if (['gasto','consumos','varios','servicios'].includes(t)) groupSums.rojo += g.monto;
    else if (['pago_proveedor','insumo_mayorista','insumo_minorista'].includes(t)) groupSums.amarillo += g.monto;
    else if (['pago_empleado','electronicos_oficina','cobro_empleado'].includes(t)) groupSums.lila += g.monto;
    else if (['construccion','vehiculo','oficina','herramientas'].includes(t)) groupSums.naranja += g.monto;
  });

  // Generar PDF y guardar temporalmente
  const baseDir = path.join(__dirname, '..', '..', 'facturas');
  fs.mkdirSync(baseDir, { recursive: true });
  const file = dashboardReportFilePath(baseDir);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const companyCfg = (() => {
    try {
      const p = path.join(__dirname, '..', '..', 'assets', 'company.json');
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch { return {}; }
  })();
  const doc = createDashboardDoc({ period, summary: { totalVentas, totalGastos, ganancia, pagos, groupSums }, company: companyCfg });
  await new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(file);
    ws.on('finish', resolve);
    ws.on('error', reject);
    doc.pipe(ws);
    doc.end();
  });

  // Configurar transporte SMTP (fallback Ethereal si falta .env)
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  let transporter;
  let from = SMTP_FROM || 'no-reply@example.com';
  try {
    if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
      const allowSelfSigned = String(process.env.SMTP_ALLOW_SELF_SIGNED || '').toLowerCase() === 'true' || process.env.SMTP_ALLOW_SELF_SIGNED === '1';
      const opts = {
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: Number(SMTP_PORT) === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      };
      if (allowSelfSigned) opts.tls = { rejectUnauthorized: false };
      transporter = nodemailer.createTransport(opts);
    } else {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
      from = 'no-reply@ethereal.email';
    }
  } catch (e) {
    return res.status(500).json({ error: `Error creando transporte SMTP: ${e.message}` });
  }

  try {
    const info = await transporter.sendMail({
      from,
      to: recipients.length === 1 ? recipients[0] : undefined,
      bcc: recipients.length > 1 ? recipients : undefined,
      subject: subject || `Dashboard (${period})`,
      html,
      text: text || (!html ? `Adjuntamos resumen de dashboard del período: ${period}.` : undefined),
      attachments: [{ filename: path.basename(file), path: file, contentType: 'application/pdf' }],
    });
    const previewUrl = nodemailer.getTestMessageUrl(info) || null;
    res.json({ ok: true, messageId: info.messageId, count: recipients.length, recipients, previewUrl });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;