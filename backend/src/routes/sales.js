const express = require('express');
const { Op } = require('sequelize');
const { sequelize } = require('../setup/database');
const auth = require('../middleware/auth');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const SaleItem = require('../models/SaleItem');
const { createInvoiceDoc, invoiceFilePath } = require('../utils/invoice');
const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const nodemailer = require('nodemailer');

const router = express.Router();

// Listar ventas
router.get('/', auth, async (req, res) => {
  const { period } = req.query;
  let where = {};
  if (period) {
    const now = dayjs();
    let start = now.startOf('day');
    let end = now.endOf('day');
    if (period === 'week') { start = now.startOf('week'); end = now.endOf('week'); }
    else if (period === 'month') { start = now.startOf('month'); end = now.endOf('month'); }
    else if (period === 'year') { start = now.startOf('year'); end = now.endOf('year'); }
    where.createdAt = { [Op.between]: [start.toDate(), end.toDate()] };
  }
  const sales = await Sale.findAll({ where, order: [['id', 'DESC']] });
  res.json(sales);
});

// Crear venta: items [{ productId, quantity }]
router.post('/', auth, async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Items requeridos' });

  const t = await sequelize.transaction();
  try {
    // Calcular total (precio público)
    let total = 0;
    const enriched = [];
    for (const it of items) {
      const p = await Product.findByPk(it.productId, { transaction: t });
      if (!p) throw new Error('Producto no encontrado');
      // Validar cantidad como entero positivo
      const q = Math.trunc(Number(it.quantity || 0));
      if (!Number.isInteger(q) || q <= 0) throw new Error('Cantidad debe ser entero positivo');
      // Usar stock entero para la comparación
      const stockInt = Math.trunc(Number(p.stock || 0));
      if (stockInt < q) throw new Error('Stock insuficiente');
      total += Number(p.precioPublico || 0) * q;
      enriched.push({ product: p, quantity: q });
    }

    const sale = await Sale.create({ total, userId: req.user.id }, { transaction: t });

    for (const it of enriched) {
      await SaleItem.create(
        { saleId: sale.id, productId: it.product.id, quantity: it.quantity, pricePublico: it.product.precioPublico },
        { transaction: t }
      );
      const newStock = Math.max(0, Math.trunc(Number(it.product.stock || 0)) - Math.trunc(Number(it.quantity || 0)));
      await it.product.update({ stock: newStock }, { transaction: t });
    }

    await t.commit();
    res.json({ saleId: sale.id, total });
  } catch (e) {
    await t.rollback();
    res.status(400).json({ error: e.message });
  }
});

// Descargar factura PDF
router.get('/:id/invoice', auth, async (req, res) => {
  const sale = await Sale.findByPk(req.params.id);
  if (!sale) return res.status(404).json({ error: 'Venta no encontrada' });
  const items = await SaleItem.findAll({ where: { saleId: sale.id }, include: [Product] });
  // Permitir override de "Facturar a" y "Enviar a" por query string:
  // bill_to=Linea1|Linea2|... , ship_to=Linea1|Linea2|...
  const parseLines = (s) => {
    if (!s || typeof s !== 'string') return null;
    return s.split('|').map(x => x.trim()).filter(Boolean).slice(0, 6);
  };
  const billTo = parseLines(req.query.bill_to);
  const shipTo = parseLines(req.query.ship_to);
  // IVA por query: iva = 'si'|'no'|'true'|'false'|'1'|'0' , iva_pct = porcentaje
  const ivaRaw = String(req.query.iva || '').trim().toLowerCase();
  const applyTax = ivaRaw ? (ivaRaw === 'si' || ivaRaw === 'true' || ivaRaw === '1') : undefined;
  const ivaPctRaw = req.query.iva_pct;
  const taxRatePercent = (ivaPctRaw !== undefined) ? Number(ivaPctRaw) : undefined;
  // Envío opcional por query: shipping_amount
  const shippingAmountOverride = (req.query.shipping_amount !== undefined) ? Number(req.query.shipping_amount) : undefined;
  // Controlar si se desea duplicado por query (?dup=si|true|1). Por defecto, SÍ (dos copias).
  const dupParamProvided = (req.query.dup !== undefined);
  const dupRaw = String(req.query.dup || '').trim().toLowerCase();
  const includeDuplicate = dupParamProvided
    ? (dupRaw === 'si' || dupRaw === 'true' || dupRaw === '1')
    : true;
  const doc = await createInvoiceDoc({ sale, items, billTo, shipTo, includeDuplicate, applyTax, taxRatePercent, shippingAmountOverride });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="factura_${sale.id}.pdf"`);
  // Guardar en disco por fecha: facturas/YYYY/MM/DD/
  const baseDir = path.join(__dirname, '..', '..', 'facturas');
  const file = invoiceFilePath(baseDir, sale);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const ws = fs.createWriteStream(file);
  doc.pipe(ws);
  doc.pipe(res);
  doc.end();
});

// Enviar factura por correo electrónico con el PDF adjunto
router.post('/:id/email', auth, async (req, res) => {
  const id = Number(req.params.id);
  const sale = await Sale.findByPk(id);
  if (!sale) return res.status(404).json({ error: 'Venta no encontrada' });

  // Parsear destinatarios y contenido
  let { emails = [], subject, html, text, bill_to, ship_to } = req.body || {};
  if (typeof emails === 'string') {
    emails = emails.split(',').map(e => e.trim()).filter(Boolean);
  }
  if (!Array.isArray(emails) || emails.length === 0) {
    return res.status(400).json({ error: 'Destinatarios requeridos (emails)' });
  }
  subject = subject && String(subject).trim() ? subject.trim() : `Factura #${sale.id}`;
  if (!(html && String(html).trim()) && !(text && String(text).trim())) {
    text = `Adjuntamos la factura #${sale.id}.`;
  }

  // Asegurar que el PDF existe (generarlo si falta)
  const baseDir = path.join(__dirname, '..', '..', 'facturas');
  const file = invoiceFilePath(baseDir, sale);
  const ensurePdf = async () => {
    try { if (fs.existsSync(file)) return; } catch {}
    const items = await SaleItem.findAll({ where: { saleId: sale.id }, include: [{ model: Product }] });
    const parseLines = (s) => {
      if (!s || typeof s !== 'string') return null;
      return s.split('|').map(x => x.trim()).filter(Boolean).slice(0, 6);
    };
    const billTo = parseLines(bill_to);
    const shipTo = parseLines(ship_to);
    const doc = createInvoiceDoc({ sale, items, billTo, shipTo, includeDuplicate: false });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await new Promise((resolve, reject) => {
      const ws = fs.createWriteStream(file);
      ws.on('finish', resolve);
      ws.on('error', reject);
      doc.pipe(ws);
      doc.end();
    });
  };
  try { await ensurePdf(); } catch (e) { return res.status(500).json({ error: `Error generando PDF: ${e.message}` }); }

  // Configurar SMTP
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  let transporter;
  let from = SMTP_FROM || 'no-reply@example.com';
  try {
    if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS && SMTP_FROM) {
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
  } catch (e) { return res.status(500).json({ error: `Error SMTP: ${e.message}` }); }

  // Enviar correo con el adjunto del PDF
  try {
    const info = await transporter.sendMail({
      from,
      to: emails.length === 1 ? emails[0] : undefined,
      bcc: emails.length > 1 ? emails : undefined,
      subject,
      html,
      text,
      attachments: [
        { filename: path.basename(file), path: file, contentType: 'application/pdf' }
      ],
    });
    const previewUrl = nodemailer.getTestMessageUrl(info) || null;
    res.json({ ok: true, messageId: info.messageId, count: emails.length, recipients: emails, previewUrl });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Eliminar venta (factura) y sus items, y limpiar PDFs generados
router.delete('/:id', auth, async (req, res) => {
  const id = Number(req.params.id);
  const sale = await Sale.findByPk(id);
  if (!sale) return res.status(404).json({ error: 'Venta no encontrada' });
  // Borrar items
  await SaleItem.destroy({ where: { saleId: id } });
  await sale.destroy();
  // Borrar PDFs generados facturas/**/factura_<id>.pdf
  const baseDir = path.join(__dirname, '..', '..', 'facturas');
  const pattern = new RegExp(`^factura_${id}\.pdf$`, 'i');
  const deletePdfsRec = async (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) deletePdfsRec(abs);
      else if (ent.isFile() && pattern.test(ent.name)) {
        try { fs.unlinkSync(abs); } catch {}
      }
    }
  };
  try { deletePdfsRec(baseDir); } catch {}
  res.json({ ok: true });
});

module.exports = router;