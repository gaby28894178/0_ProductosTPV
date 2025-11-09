const express = require('express');
const auth = require('../middleware/auth');
const Destination = require('../models/Destination');

const router = express.Router();

// Listar destinos
router.get('/', auth, async (req, res) => {
  const dests = await Destination.findAll({ order: [['id', 'DESC']] });
  res.json(dests);
});

// Crear destino
router.post('/', auth, async (req, res) => {
  const { nombre, direccion, ciudad, contacto, customerId } = req.body;
  if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'Nombre requerido' });
  try {
    // Ignoramos teléfono porque la tabla no tiene columna; el teléfono sólo se usa en el PDF.
    const d = await Destination.create({ nombre: nombre.trim(), direccion, ciudad, contacto, customerId });
    res.json(d);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;