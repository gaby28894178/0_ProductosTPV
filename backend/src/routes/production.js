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
    const stockEmpaques = Math.trunc(Number(mat.stock||0));
    // Usamos el rendimiento definido en el producto mayorista
    const rendimientoMayorista = Math.trunc(Number(mat.rendimientoLitrosPorEmpaque || m.rendimientoLitrosPorEmpaque || 0));
    const rendimiento = Math.max(0, rendimientoMayorista);
    const totalCapacidad = Math.max(0, stockEmpaques * rendimiento);
    // Consumo por empaques: cada evento consume paquetes completos según su litros registrados
    const eventos = await ProductionEvent.findAll({ where: { materiaPrimaId: m.materiaPrimaId } });
    const litrosRegistrados = eventos.reduce((sum, e) => sum + Math.trunc(Number(e.litros||0)), 0);
    const litrosConsumidosPorPaquetes = eventos.reduce((sum, e) => {
      const l = Math.trunc(Number(e.litros||0));
      if (!rendimiento) return sum;
      const paquetes = Math.ceil(l / rendimiento);
      return sum + (paquetes * rendimiento);
    }, 0);
    result.push({
      productId: m.productId,
      materiaPrimaId: m.materiaPrimaId,
      materiaPrimaNombre: mat.nombre,
      stockEmpaques,
      rendimientoLitrosPorEmpaque: rendimiento,
      capacidadTotalLitros: totalCapacidad,
      // Exponemos "litrosCreados" como litros consumidos efectivos (por empaques)
      litrosCreados: Math.trunc(litrosConsumidosPorPaquetes),
      litrosRestantes: Math.max(0, totalCapacidad - Math.trunc(litrosConsumidosPorPaquetes)),
      // Información auxiliar para depurar si hace falta
      litrosRegistrados,
    });
  }
  res.json(result);
});

// Registrar litros producidos
router.post('/produce', auth, async (req, res) => {
  try {
    const { productId, materiaPrimaId, litros, nota } = req.body || {};
    if (!productId || !materiaPrimaId || !litros) return res.status(400).json({ error: 'productId, materiaPrimaId y litros requeridos' });
    const mapping = await ProductMaterial.findOne({ where: { productId: Number(productId), materiaPrimaId: Number(materiaPrimaId) } });
    if (!mapping) return res.status(404).json({ error: 'Relación producto ↔ materia prima no encontrada' });
    const materiaPrima = await Product.findByPk(mapping.materiaPrimaId);
    if (!materiaPrima) return res.status(404).json({ error: 'Materia prima no encontrada' });

    const litrosInt = Math.trunc(Number(litros||0));
    if (!Number.isFinite(litrosInt) || litrosInt <= 0) return res.status(400).json({ error: 'Litros inválidos' });

    // Rendimiento por empaque: tomamos el definido en el mayorista; si no, el del mapeo
    const rendimiento = Math.max(0, Math.trunc(Number(materiaPrima.rendimientoLitrosPorEmpaque || mapping.rendimientoLitrosPorEmpaque || 0)));
    if (!rendimiento) return res.status(400).json({ error: 'Rendimiento no configurado para la materia prima' });

    // Empaques necesarios para producir los litros pedidos (consumo por paquetes completos)
    const stockEmpaques = Math.trunc(Number(materiaPrima.stock||0));
    const empaquesNecesarios = Math.ceil(litrosInt / rendimiento);
    if (empaquesNecesarios <= 0) return res.status(400).json({ error: 'Litros inválidos respecto al rendimiento' });
    if (empaquesNecesarios > stockEmpaques) {
      return res.status(400).json({ error: `Empaques insuficientes: requiere ${empaquesNecesarios}, stock ${stockEmpaques}` });
    }

    // Registrar evento de producción (litros reales producidos)
    const ev = await ProductionEvent.create({ productId: Number(productId), materiaPrimaId: Number(materiaPrimaId), litros: litrosInt, nota: nota||null });

    // Descontar empaques completos consumidos
    const nuevoStockEmpaques = stockEmpaques - empaquesNecesarios;
    await materiaPrima.update({ stock: nuevoStockEmpaques });

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