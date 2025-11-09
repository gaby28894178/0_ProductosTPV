const express = require('express');
const auth = require('../middleware/auth');
const Product = require('../models/Product');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  const includeMayorista = String(req.query.includeMayorista||'').toLowerCase() === 'true'
  const where = includeMayorista ? undefined : { esMayorista: false }
  const items = await Product.findAll({ where, order: [['id', 'DESC']] });
  res.json(items);
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