const express = require('express');
const auth = require('../middleware/auth');
const Product = require('../models/Product');
const ProductMaterial = require('../models/ProductMaterial');
const ProductionEvent = require('../models/ProductionEvent');

const router = express.Router();

// Listar eventos de producción por producto final
router.get('/events', auth, async (req, res) => {
  const { productId } = req.query;
  const where = productId ? { productId: Number(productId) } : undefined;
  const rows = await ProductionEvent.findAll({ where, order: [['id','DESC']] });
  res.json(rows);
});

// Resumen de capacidad por producto final
router.get('/capacity', auth, async (req, res) => {
  const { productId } = req.query;
  const pmWhere = productId ? { productId: Number(productId) } : undefined;
  const mappings = await ProductMaterial.findAll({ where: pmWhere });
  const result = [];
  for (const m of mappings) {
    const mat = await Product.findByPk(m.materiaPrimaId);
    if (!mat) continue;
    // Capacidad total (litros) = stock de empaques * rendimiento (L/emp)
    // CONSUMO GLOBAL: litros creados se suman por materia prima (independiente del producto final)
    const eventos = await ProductionEvent.findAll({ where: { materiaPrimaId: m.materiaPrimaId } });
    const litrosCreados = eventos.reduce((sum, e) => sum + Math.trunc(Number(e.litros||0)), 0);
    const stockEmpaques = Math.trunc(Number(mat.stock||0));
    const rendimiento = Math.trunc(Number(m.rendimientoLitrosPorEmpaque||0));
    const totalCapacidad = Math.max(0, stockEmpaques * rendimiento);
    result.push({
      productId: m.productId,
      materiaPrimaId: m.materiaPrimaId,
      materiaPrimaNombre: mat.nombre,
      // stock de mayorista en UNIDADES (empaques)
      stockEmpaques,
      rendimientoLitrosPorEmpaque: rendimiento,
      capacidadTotalLitros: totalCapacidad,
      litrosCreados,
      litrosRestantes: Math.max(0, totalCapacidad - litrosCreados),
    });
  }
  res.json(result);
});

// Registrar litros producidos
router.post('/produce', auth, async (req, res) => {
  try {
    const { productId, materiaPrimaId, litros, nota } = req.body || {};
    if (!productId || !materiaPrimaId || !litros) return res.status(400).json({ error: 'productId, materiaPrimaId y litros requeridos' });
    const m = await ProductMaterial.findOne({ where: { productId: Number(productId), materiaPrimaId: Number(materiaPrimaId) } });
    if (!m) return res.status(404).json({ error: 'Relación producto ↔ materia prima no encontrada' });
    const mat = await Product.findByPk(m.materiaPrimaId);
    if (!mat) return res.status(404).json({ error: 'Materia prima no encontrada' });
    // Validación contra capacidad restante GLOBAL por materia prima:
    // capacidadRestante = (stock empaques * rendimiento) - SUM(litros creados por esa materia prima)
    const stockEmpaques = Math.trunc(Number(mat.stock||0));
    const rendimiento = Math.trunc(Number(m.rendimientoLitrosPorEmpaque||0));
    const eventosGlobal = await ProductionEvent.findAll({ where: { materiaPrimaId: Number(materiaPrimaId) } });
    const litrosCreadosGlobal = eventosGlobal.reduce((sum, e) => sum + Math.trunc(Number(e.litros||0)), 0);
    const capacidadRestante = Math.max(0, (stockEmpaques * rendimiento) - litrosCreadosGlobal);
    const litrosInt = Math.trunc(Number(litros||0));
    if (!Number.isFinite(litrosInt) || litrosInt <= 0) return res.status(400).json({ error: 'Litros inválidos' });
    if (litrosInt > capacidadRestante) return res.status(400).json({ error: `Excede capacidad restante (${capacidadRestante} L)` });
    // Registrar evento
    const ev = await ProductionEvent.create({ productId: Number(productId), materiaPrimaId: Number(materiaPrimaId), litros: litrosInt, nota: nota||null });
    // No descontamos empaques completos: el consumo se refleja en litros creados GLOBALMENTE.
    // La capacidad restante global se calcula como (stock empaques * rendimiento) - litros creados para esa materia prima.

    // Incrementar stock del producto final con los litros producidos
    const prod = await Product.findByPk(Number(productId));
    if (prod) {
      const nuevoStockProd = Math.trunc(Number(prod.stock||0)) + litrosInt;
      await prod.update({ stock: nuevoStockProd });
    }

    res.json(ev);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;