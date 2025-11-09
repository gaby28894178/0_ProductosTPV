const express = require('express');
const auth = require('../middleware/auth');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
let sharp;
try { sharp = require('sharp'); } catch {}

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

function sanitizeFilename(name) {
  const base = String(name || '').replace(/[^a-zA-Z0-9_.-]/g, '_');
  // Evitar nombres que comiencen con punto
  return base.replace(/^\.+/, 'file');
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

async function ensureSvgThumbnail(dir, filename) {
  try {
    if (!sharp) return null; // sharp no disponible
    const ext = path.extname(filename).toLowerCase();
    if (ext !== '.svg') return null;
    const name = path.basename(filename, ext);
    const thumbsDir = path.join(dir, 'thumbnails');
    ensureDir(thumbsDir);
    const outFile = path.join(thumbsDir, `${name}.png`);
    if (fs.existsSync(outFile)) return outFile;
    const srcFile = path.join(dir, filename);
    // Renderizar SVG a PNG de 256px de alto, manteniendo aspecto
    await sharp(srcFile, { density: 300 })
      .resize({ height: 256, fit: 'inside' })
      .png()
      .toFile(outFile);
    return outFile;
  } catch {
    return null;
  }
}

// Lista archivos de product-images como URLs servidas por /assets
router.get('/product-images', auth, async (req, res) => {
  try {
    const dir = path.join(__dirname, '..', '..', 'assets', 'product-images');
    const allowed = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);
    const assetUrl = (filename) => `${req.protocol}://${req.get('host')}/assets/product-images/${filename}`;
    const thumbUrlFor = async (filename) => {
      const ext = path.extname(filename).toLowerCase();
      if (ext === '.svg') {
        const p = await ensureSvgThumbnail(dir, filename);
        if (p) {
          const name = path.basename(p);
          return `${req.protocol}://${req.get('host')}/assets/product-images/thumbnails/${name}`;
        }
      }
      return assetUrl(filename);
    };

    // Si existe cargaimagen.json, usarlo como fuente principal
    const jsonPath = path.join(dir, 'cargaimagen.json');
    if (fs.existsSync(jsonPath)) {
      try {
        const raw = fs.readFileSync(jsonPath, 'utf8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          const list = [];
          for (const entry of data) {
            let filename = null;
            let title = null;
            let description = null;
            if (typeof entry === 'string') {
              filename = entry;
            } else if (entry && typeof entry === 'object') {
              filename = entry.filename || entry.file || null;
              title = entry.title || entry.nombre || null;
              description = entry.description || entry.descripcion || null;
            }
            if (!filename) continue;
            const ext = path.extname(filename).toLowerCase();
            if (!allowed.has(ext)) continue;
            const abs = path.join(dir, filename);
            if (!fs.existsSync(abs)) continue;
            const tUrl = await thumbUrlFor(filename);
            list.push({ filename, url: assetUrl(filename), thumbUrl: tUrl, title, description });
          }
          return res.json(list);
        }
        // Si el JSON no es un array, continuar con listado por carpeta
      } catch (e) {
        // JSON mal formado: continuar con listado por carpeta
      }
    }

    // Fallback: listar archivos del directorio
    let files = [];
    try {
      files = fs.readdirSync(dir);
    } catch (e) {
      return res.json([]);
    }
    const list = [];
    for (const f of files) {
      const ext = path.extname(f).toLowerCase();
      if (!allowed.has(ext)) continue;
      const tUrl = await thumbUrlFor(f);
      list.push({ filename: f, url: assetUrl(f), thumbUrl: tUrl });
    }
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Subida de imagen: guarda en assets/product-images y actualiza cargaimagen.json
router.post('/upload', auth, upload.single('file'), async (req, res) => {
  try {
    const dir = path.join(__dirname, '..', '..', 'assets', 'product-images');
    ensureDir(dir);
    const allowed = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);
    const title = String((req.body?.title) || '').trim() || null;
    const description = String((req.body?.description) || '').trim() || null;
    const original = req.file?.originalname || 'file';
    const sanitized = sanitizeFilename(original);
    const ext = path.extname(sanitized).toLowerCase();
    if (!allowed.has(ext)) return res.status(400).json({ error: 'Formato no soportado' });
    // Evitar sobrescribir: si existe, agregar sufijo incremental
    let basename = path.basename(sanitized, ext);
    let target = path.join(dir, `${basename}${ext}`);
    let counter = 1;
    while (fs.existsSync(target)) {
      target = path.join(dir, `${basename}_${counter}${ext}`);
      counter++;
    }
    // Escribir archivo
    if (!req.file || !req.file.buffer) return res.status(400).json({ error: 'Archivo faltante' });
    fs.writeFileSync(target, req.file.buffer);
    const filename = path.basename(target);

    // Actualizar cargaimagen.json
    const jsonPath = path.join(dir, 'cargaimagen.json');
    let arr = [];
    try { arr = JSON.parse(fs.readFileSync(jsonPath, 'utf8')); } catch {}
    if (!Array.isArray(arr)) arr = [];
    if (!arr.some(e => (e && (e.filename === filename || e.file === filename || e === filename)))) {
      const obj = { filename };
      if (title) obj.title = title;
      if (description) obj.description = description;
      arr.push(obj);
      fs.writeFileSync(jsonPath, JSON.stringify(arr, null, 2));
    }

    // Si es SVG, generar miniatura PNG
    let thumbUrl = null;
    if (ext === '.svg') {
      const p = await ensureSvgThumbnail(dir, filename);
      if (p) thumbUrl = `${req.protocol}://${req.get('host')}/assets/product-images/thumbnails/${path.basename(p)}`;
    }

    const url = `${req.protocol}://${req.get('host')}/assets/product-images/${filename}`;
    res.json({ filename, url, thumbUrl, title, description });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
// Editar metadatos de imagen (title, description) en cargaimagen.json
router.put('/metadata', auth, async (req, res) => {
  try {
    const dir = path.join(__dirname, '..', '..', 'assets', 'product-images');
    const jsonPath = path.join(dir, 'cargaimagen.json');
    let arr = [];
    try { arr = JSON.parse(fs.readFileSync(jsonPath, 'utf8')); } catch {}
    if (!Array.isArray(arr)) arr = [];

    const filename = String(req.body?.filename || '').trim();
    if (!filename) return res.status(400).json({ error: 'filename requerido' });
    const ext = path.extname(filename).toLowerCase();
    const allowed = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);
    if (!allowed.has(ext)) return res.status(400).json({ error: 'Formato no soportado' });
    const abs = path.join(dir, filename);
    if (!fs.existsSync(abs)) return res.status(404).json({ error: 'Archivo no encontrado' });

    const titleRaw = req.body?.title;
    const descRaw = req.body?.description;
    const hasTitle = Object.prototype.hasOwnProperty.call(req.body || {}, 'title');
    const hasDesc = Object.prototype.hasOwnProperty.call(req.body || {}, 'description');
    const title = hasTitle ? (String(titleRaw || '').trim() || null) : undefined;
    const description = hasDesc ? (String(descRaw || '').trim() || null) : undefined;

    let found = false;
    arr = arr.map(e => {
      if (typeof e === 'string') {
        if (e === filename) {
          found = true;
          const obj = { filename };
          if (hasTitle) { if (title) obj.title = title; }
          if (hasDesc) { if (description) obj.description = description; }
          return obj;
        }
        return e;
      }
      const fname = e.filename || e.file;
      if (fname === filename) {
        found = true;
        const obj = { ...e, filename };
        if (hasTitle) {
          if (title) obj.title = title; else delete obj.title;
        }
        if (hasDesc) {
          if (description) obj.description = description; else delete obj.description;
        }
        return obj;
      }
      return e;
    });
    if (!found) {
      const obj = { filename };
      if (title) obj.title = title;
      if (description) obj.description = description;
      arr.push(obj);
    }

    fs.writeFileSync(jsonPath, JSON.stringify(arr, null, 2));

    const assetUrl = (fn) => `${req.protocol}://${req.get('host')}/assets/product-images/${fn}`;
    let thumbUrl = assetUrl(filename);
    if (ext === '.svg') {
      const p = await ensureSvgThumbnail(dir, filename);
      if (p) thumbUrl = `${req.protocol}://${req.get('host')}/assets/product-images/thumbnails/${path.basename(p)}`;
    }
    res.json({ filename, url: assetUrl(filename), thumbUrl, title: title ?? null, description: description ?? null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});