const express = require('express');
const auth = require('../middleware/auth');
const Product = require('../models/Product');
const ProductMaterial = require('../models/ProductMaterial');

const router = express.Router();

// Listar mapeos por producto final
router.get('/', auth, async (req, res) => {
  const { productId } = req.query;
  const where = productId ? { productId: Number(productId) } : undefined;
  const rows = await ProductMaterial.findAll({ where, order: [['id','DESC']] });
  res.json(rows);
});

// Crear/actualizar mapeo
router.post('/', auth, async (req, res) => {
  try {
    const { productId, materiaPrimaId, rendimientoLitrosPorEmpaque } = req.body || {};
    if (!productId || !materiaPrimaId) return res.status(400).json({ error: 'productId y materiaPrimaId requeridos' });
    // Validar existencia
    const prod = await Product.findByPk(productId);
    const mat = await Product.findByPk(materiaPrimaId);
    if (!prod) return res.status(404).json({ error: 'Producto final no encontrado' });
    if (!mat || !mat.esMayorista) return res.status(400).json({ error: 'Materia prima mayorista no válida' });
    // Validar rendimiento como entero positivo
    const rend = Math.trunc(Number(rendimientoLitrosPorEmpaque || 0));
    if (!Number.isInteger(rend) || rend <= 0) return res.status(400).json({ error: 'Rendimiento debe ser entero positivo' });
    const payload = {
      productId: Number(productId),
      materiaPrimaId: Number(materiaPrimaId),
      rendimientoLitrosPorEmpaque: rend
    };
    // Upsert por clave única (productId+materiaPrimaId)
    const [row] = await ProductMaterial.findOrCreate({ where: { productId: payload.productId, materiaPrimaId: payload.materiaPrimaId }, defaults: payload });
    if (row && row.id) {
      await row.update(payload);
      return res.json(row);
    }
    res.json(row);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const row = await ProductMaterial.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error: 'No encontrado' });
    const { rendimientoLitrosPorEmpaque } = req.body || {};
    const rend = Math.trunc(Number(rendimientoLitrosPorEmpaque || row.rendimientoLitrosPorEmpaque || 0));
    if (!Number.isInteger(rend) || rend <= 0) return res.status(400).json({ error: 'Rendimiento inválido' });
    await row.update({ rendimientoLitrosPorEmpaque: rend });
    res.json(row);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  const row = await ProductMaterial.findByPk(req.params.id);
  if (!row) return res.status(404).json({ error: 'No encontrado' });
  await row.destroy();
  res.json({ ok: true });
});

module.exports = router;