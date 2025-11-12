const express = require('express');
const auth = require('../middleware/auth');
const Product = require('../models/Product');
const multer = require('multer');
const XLSX = require('xlsx');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/', auth, async (req, res) => {
  const includeMayorista = String(req.query.includeMayorista||'').toLowerCase() === 'true'
  const where = includeMayorista ? undefined : { esMayorista: false }
  const items = await Product.findAll({ where, order: [['id', 'DESC']] });
  res.json(items);
});

// Exportar productos a Excel
router.get('/export.xlsx', auth, async (req, res) => {
  const rows = await Product.findAll({ order: [['id', 'ASC']] });
  const data = rows.map(p => ({
    id: p.id,
    nombre: p.nombre,
    nombreBoleta: p.nombreBoleta,
    descripcion: p.descripcion,
    unidad: p.unidad,
    marca: p.marca,
    imagenUrl: p.imagenUrl,
    stock: Math.trunc(Number(p.stock || 0)),
    precioMayorista: Number(p.precioMayorista || 0),
    precioPublico: Number(p.precioPublico || 0),
    esMayorista: !!p.esMayorista,
    rendimientoLitrosPorEmpaque: Math.trunc(Number(p.rendimientoLitrosPorEmpaque || 0)),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Productos');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
  res.setHeader('Content-Disposition', 'attachment; filename="productos.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

// Importar productos desde Excel
router.post('/import', auth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Archivo requerido (xlsx)' });
  try {
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
    let created = 0, updated = 0, skipped = 0;
    for (const r of rows) {
      // Normalizar campos
      const payload = {
        nombre: String(r.nombreBoleta || r.nombre || '').trim(),
        nombreBoleta: String(r.nombreBoleta || r.nombre || '').trim(),
        descripcion: r.descripcion ?? null,
        unidad: (String(r.unidad || '').toLowerCase() === 'kilo') ? 'kilo' : 'litro',
        marca: r.marca ?? null,
        imagenUrl: r.imagenUrl ?? null,
        stock: Math.trunc(Number(r.stock || 0)) || 0,
        precioMayorista: Number(r.precioMayorista || 0) || 0,
        precioPublico: Number(r.precioPublico || 0) || 0,
        esMayorista: Boolean(r.esMayorista),
        rendimientoLitrosPorEmpaque: Math.trunc(Number(r.rendimientoLitrosPorEmpaque || 0)) || 0,
      };
      const id = Number(r.id);
      try {
        if (Number.isFinite(id) && id > 0) {
          const existing = await Product.findByPk(id);
          if (existing) {
            await existing.update(payload);
            updated++;
            continue;
          }
        }
        if (!payload.nombre) { skipped++; continue; }
        await Product.create(payload);
        created++;
      } catch (e) { skipped++; }
    }
    res.json({ ok: true, created, updated, skipped, total: rows.length });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const payload = { ...req.body };
    if (payload.stock !== undefined) {
      let s = Math.trunc(Number(payload.stock || 0));
      if (!Number.isFinite(s) || s < 0) s = 0;
      payload.stock = s;
    }
    const item = await Product.create(payload);
    res.json(item);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const item = await Product.findByPk(req.params.id);
    if (!item) return res.status(404).json({ error: 'No encontrado' });
    const payload = { ...req.body };
    if (payload.stock !== undefined) {
      let s = Math.trunc(Number(payload.stock || 0));
      if (!Number.isFinite(s) || s < 0) s = 0;
      payload.stock = s;
    }
    await item.update(payload);
    res.json(item);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  const item = await Product.findByPk(req.params.id);
  if (!item) return res.status(404).json({ error: 'No encontrado' });
  await item.destroy();
  res.json({ ok: true });
});

module.exports = router;