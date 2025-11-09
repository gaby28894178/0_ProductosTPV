const express = require('express');
const auth = require('../middleware/auth');
const Customer = require('../models/Customer');

const router = express.Router();

// Listar clientes
router.get('/', auth, async (req, res) => {
  const customers = await Customer.findAll({ order: [['id', 'DESC']] });
  res.json(customers);
});

// Crear cliente
router.post('/', auth, async (req, res) => {
  const { nombre, direccion, ciudad, documento, email, telefono } = req.body;
  if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'Nombre requerido' });
  try {
    const c = await Customer.create({ nombre: nombre.trim(), direccion, ciudad, documento, email, telefono });
    res.json(c);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Actualizar cliente
router.put('/:id', auth, async (req, res) => {
  const c = await Customer.findByPk(req.params.id)
  if (!c) return res.status(404).json({ error: 'No encontrado' })
  const { nombre, direccion, ciudad, documento, email, telefono } = req.body
  try {
    await c.update({ nombre, direccion, ciudad, documento, email, telefono })
    res.json(c)
  } catch (e) { res.status(400).json({ error: e.message }) }
})

// Eliminar cliente
router.delete('/:id', auth, async (req, res) => {
  const c = await Customer.findByPk(req.params.id)
  if (!c) return res.status(404).json({ error: 'No encontrado' })
  await c.destroy()
  res.json({ ok: true })
})

// Envío masivo de emails a clientes (BCC)
const nodemailer = require('nodemailer')
const multer = require('multer')
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

// Envío masivo con soporte de adjunto de folleto (imagen)
router.post('/bulk-email', auth, upload.single('folleto'), async (req, res) => {
  // Soportar tanto JSON como multipart/form-data
  let { ids = [], emails = [], subject, html, text } = req.body
  if (typeof ids === 'string') {
    try { ids = JSON.parse(ids) } catch { ids = ids.split(',').map(v => Number(v)).filter(Boolean) }
  }
  if (typeof emails === 'string') {
    emails = emails.split(',').map(e => e.trim()).filter(Boolean)
  }
  if (!subject || !(html || text)) return res.status(400).json({ error: 'Asunto y contenido requeridos' })

  let recipients = Array.isArray(emails) ? emails.filter(Boolean) : []
  if (Array.isArray(ids) && ids.length) {
    const cs = await Customer.findAll({ where: { id: ids } })
    recipients = recipients.concat(cs.map(c => c.email).filter(Boolean))
  }
  // dedup
  recipients = Array.from(new Set(recipients))
  // Validar formato básico de email para evitar errores de nodemailer
  const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim())
  recipients = recipients.filter(isEmail)
  if (!recipients.length) return res.status(400).json({ error: 'Sin destinatarios válidos' })

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env
  let transporter
  let from = SMTP_FROM || 'no-reply@example.com'
  try {
    if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS && SMTP_FROM) {
      const allowSelfSigned = String(process.env.SMTP_ALLOW_SELF_SIGNED || '').toLowerCase() === 'true' || process.env.SMTP_ALLOW_SELF_SIGNED === '1'
      const opts = {
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: Number(SMTP_PORT) === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      }
      if (allowSelfSigned) opts.tls = { rejectUnauthorized: false }
      transporter = nodemailer.createTransport(opts)
    } else {
      const testAccount = await nodemailer.createTestAccount()
      transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: { user: testAccount.user, pass: testAccount.pass },
      })
      from = 'no-reply@ethereal.email'
    }
  } catch (e) { return res.status(500).json({ error: `Error SMTP: ${e.message}` }) }
  // Adjuntos
  const attachments = []
  if (req.file) {
    attachments.push({ filename: req.file.originalname, content: req.file.buffer, contentType: req.file.mimetype })
  }

  try {
    const info = await transporter.sendMail({
      from,
      to: recipients.length === 1 ? recipients[0] : undefined,
      bcc: recipients.length > 1 ? recipients : undefined,
      subject,
      html, text,
      attachments,
    })
    const previewUrl = nodemailer.getTestMessageUrl(info) || null
    res.json({ ok: true, messageId: info.messageId, count: recipients.length, recipients, previewUrl })
  } catch (e) {
    console.error('Bulk email error:', e)
    res.status(500).json({ error: e.message })
  }
})

module.exports = router;