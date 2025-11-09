const express = require('express');
const auth = require('../middleware/auth');
const Config = require('../models/Config');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
// Modelos para reseteo
const Customer = require('../models/Customer');
const Destination = require('../models/Destination');
const Employee = require('../models/Employee');
const EmployeePayment = require('../models/EmployeePayment');
const Expense = require('../models/Expense');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const SaleItem = require('../models/SaleItem');
const User = require('../models/User');
const { sequelize } = require('../setup/database');
const { ensureConfigColumns } = require('../setup/migrations');

const router = express.Router();

// Verifica la contraseña de reset leyendo assets/company.json
function verifyResetPassword(plain) {
  try {
    const jsonPath = path.join(__dirname, '..', '..', 'assets', 'company.json')
    const raw = fs.readFileSync(jsonPath, 'utf8')
    const data = JSON.parse(raw)
    const salt = data.reset_password_salt
    const hash = data.reset_password_hash
    if (salt && hash) {
      const derived = crypto.scryptSync(String(plain), String(salt), 64).toString('hex')
      return derived === String(hash)
    }
    const value = String(data.reset_password || '').trim()
    const fallback = value || '28894178'
    return String(plain) === fallback
  } catch (e) {
    // Fallback si el archivo no existe o está inválido
    return String(plain) === '28894178'
  }
}

router.get('/', auth, async (req, res) => {
  // Asegurar columnas de configuración nuevas disponibles
  try { await ensureConfigColumns() } catch {}
  let cfg = await Config.findOne();
  if (!cfg) cfg = await Config.create({});
  res.json(cfg);
});

router.put('/', auth, async (req, res) => {
  try { await ensureConfigColumns() } catch {}
  let cfg = await Config.findOne();
  if (!cfg) cfg = await Config.create({});
  await cfg.update(req.body);
  res.json(cfg);
});

// Reingresar capital: incrementa capitalExtra
router.post('/add-capital', auth, async (req, res) => {
  const { monto } = req.body
  const value = Number(monto)
  if (!Number.isFinite(value) || value <= 0) {
    return res.status(400).json({ error: 'Monto inválido' })
  }
  let cfg = await Config.findOne();
  if (!cfg) cfg = await Config.create({});
  const currentExtra = Number(cfg.capitalExtra || 0)
  await cfg.update({ capitalExtra: currentExtra + value })
  res.json(cfg)
})

// Correos preconfigurados desde .env para desplegables en frontend
router.get('/emails', auth, async (req, res) => {
  const { DEFAULT_EMAILS = '', SMTP_FROM = '' } = process.env
  let list = []
  if (DEFAULT_EMAILS && DEFAULT_EMAILS.trim()) {
    list = DEFAULT_EMAILS.split(',').map(s => s.trim()).filter(Boolean)
  }
  if (SMTP_FROM && SMTP_FROM.trim() && !list.includes(SMTP_FROM.trim())) {
    list.push(SMTP_FROM.trim())
  }
  res.json({ emails: list })
})

// Descargar respaldo de la base de datos (envía el archivo data.sqlite)
router.get('/backup', auth, async (req, res) => {
  try {
    const storagePath = path.join(__dirname, '..', '..', 'data.sqlite');
    if (!fs.existsSync(storagePath)) {
      return res.status(404).json({ error: 'Base de datos no encontrada' });
    }
    let cfg = await Config.findOne();
    if (!cfg) cfg = await Config.create({});
    const rawName = (cfg.backupName || 'respaldo').trim();
    const safeBase = rawName.replace(/[^a-zA-Z0-9._-]/g, '') || 'respaldo';
    const safeName = safeBase.toLowerCase().endsWith('.sqlite') ? safeBase : `${safeBase}.sqlite`;
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    const stream = fs.createReadStream(storagePath);
    stream.on('error', (e) => res.status(500).json({ error: e.message }));
    stream.pipe(res);
  } catch (e) {
    console.error('Backup error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Restaurar base de datos desde archivo subido (binary stream)
router.post('/restore', auth, express.raw({ type: 'application/octet-stream', limit: '200mb' }), async (req, res) => {
  try {
    const buf = req.body;
    if (!Buffer.isBuffer(buf) || buf.length === 0) {
      return res.status(400).json({ error: 'Archivo inválido o vacío' });
    }
    const storagePath = path.join(__dirname, '..', '..', 'data.sqlite');
    // Guardar directo; en algunos casos SQLite puede estar bloqueado. Recomendar reinicio.
    fs.writeFileSync(storagePath, buf);
    res.json({ ok: true, message: 'Base restaurada. Reinicie el backend para aplicar completamente.' });
  } catch (e) {
    console.error('Restore error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Resetear base de datos: elimina todos los datos de las tablas principales y usuarios
// Protegido por contraseña simple enviada en el body: { password: '28894178' }
router.post('/reset', auth, async (req, res) => {
  try {
    const { password } = req.body || {}
    if (!verifyResetPassword(password)) {
      return res.status(403).json({ error: 'Password incorrecto.' })
    }

    // Antes de limpiar la base, mover facturas a carpeta de backup y reiniciar estructura
    try {
      const facturasPath = path.join(__dirname, '..', '..', 'facturas')
      if (fs.existsSync(facturasPath)) {
        const stamp = new Date()
        const yyyy = String(stamp.getFullYear())
        const mm = String(stamp.getMonth() + 1).padStart(2, '0')
        const dd = String(stamp.getDate()).padStart(2, '0')
        const hh = String(stamp.getHours()).padStart(2, '0')
        const mi = String(stamp.getMinutes()).padStart(2, '0')
        const destRoot = path.join(__dirname, '..', '..', 'backp', 'facturas', `${yyyy}${mm}${dd}_${hh}${mi}`)
        fs.mkdirSync(destRoot, { recursive: true })
        // Copiar todo el árbol de facturas al backup y luego limpiar origen
        try { fs.cpSync(facturasPath, destRoot, { recursive: true }) } catch (e) { console.warn('No se pudo copiar facturas:', e.message) }
        try { fs.rmSync(facturasPath, { recursive: true, force: true }) } catch (e) { console.warn('No se pudo eliminar facturas origen:', e.message) }
        try { fs.mkdirSync(facturasPath, { recursive: true }) } catch (e) { console.warn('No se pudo recrear carpeta facturas:', e.message) }
      }
    } catch (e) {
      console.warn('Respaldo de facturas al reset falló:', e.message)
    }
    // El orden importa por claves foráneas: primero dependientes
    await SaleItem.destroy({ where: {} });
    await EmployeePayment.destroy({ where: {} });
    await Sale.destroy({ where: {} });
    await Expense.destroy({ where: {} });
    await Destination.destroy({ where: {} });
    await Customer.destroy({ where: {} });
    await Product.destroy({ where: {} });
    await Employee.destroy({ where: {} });
    await User.destroy({ where: {} });

    // Mantener Config para no perder ajustes (capital, backupName, etc.)
    // Opcional: reset de autoincrementos en SQLite
    try {
      await sequelize.query('DELETE FROM sqlite_sequence');
    } catch (e) {
      // Ignorar si no aplica (dialectos distintos)
      console.warn('No se pudo resetear sqlite_sequence:', e.message);
    }

    res.json({ ok: true, message: 'Base de datos reseteada. Se eliminaron todos los usuarios y datos.' });
  } catch (e) {
    console.error('Reset DB error:', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;