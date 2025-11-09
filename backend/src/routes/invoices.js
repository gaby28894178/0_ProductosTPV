const express = require('express');
const auth = require('../middleware/auth');
const path = require('path');
const fs = require('fs').promises;

const router = express.Router();

async function listPdfFiles(baseDir) {
  const results = [];
  async function walk(dir, rel = '') {
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
      const abs = path.join(dir, ent.name);
      const relPath = path.join(rel, ent.name);
      if (ent.isDirectory()) {
        await walk(abs, relPath);
      } else if (ent.isFile() && ent.name.toLowerCase().endsWith('.pdf')) {
        let stat;
        try { stat = await fs.stat(abs); } catch {}
        const urlPath = '/facturas/' + relPath.split(path.sep).join('/');
        const match = ent.name.match(/factura_(\d+)\.pdf/i);
        const saleId = match ? parseInt(match[1], 10) : null;
        results.push({
          fileName: ent.name,
          url: urlPath,
          saleId,
          datePath: rel.replace(/\\/g, '/'),
          modifiedMs: stat?.mtimeMs || null,
          modifiedAt: stat?.mtime ? new Date(stat.mtime).toISOString() : null,
        });
      }
    }
  }
  await walk(baseDir);
  // Ordenar por fecha de ruta descendente si posible, luego por saleId desc
  results.sort((a, b) => {
    const ad = a.datePath || '';
    const bd = b.datePath || '';
    if (ad !== bd) return ad < bd ? 1 : -1;
    return (b.saleId || 0) - (a.saleId || 0);
  });
  return results;
}

router.get('/', auth, async (req, res) => {
  const baseDir = path.join(__dirname, '..', '..', 'facturas');
  const files = await listPdfFiles(baseDir);
  res.json(files);
});

// Eliminar todos los PDFs de facturas (mantiene estructura de carpetas)
router.delete('/', auth, async (req, res) => {
  const baseDir = path.join(__dirname, '..', '..', 'facturas');
  let count = 0;
  async function walkAndRemove(dir) {
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        await walkAndRemove(abs);
      } else if (ent.isFile() && ent.name.toLowerCase().endsWith('.pdf')) {
        try { await fs.unlink(abs); count++; } catch {}
      }
    }
  }
  await walkAndRemove(baseDir);
  res.json({ deleted: count });
});

module.exports = router;