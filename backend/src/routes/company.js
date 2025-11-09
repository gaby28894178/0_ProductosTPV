const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const router = express.Router();

// Middleware de autenticación
const auth = require('../middleware/auth');

const COMPANY_JSON_PATH = path.join(__dirname, '../../assets/company.json');

function readCompanyJson() {
  try {
    const raw = fs.readFileSync(COMPANY_JSON_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function writeCompanyJson(data) {
  fs.writeFileSync(COMPANY_JSON_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// GET /api/company -> devuelve el JSON completo (incluye reset_password)
router.get('/', auth, (req, res) => {
  const data = readCompanyJson();
  if (!data) {
    return res.status(500).json({ error: 'No se pudo leer company.json' });
  }
  const safe = { ...data };
  delete safe.reset_password;
  delete safe.reset_password_hash;
  delete safe.reset_password_salt;
  return res.json(safe);
});

// PUT /api/company -> permite actualizar campos permitidos (por ahora reset_password)
router.put('/', auth, (req, res) => {
  const body = req.body || {};

  const data = readCompanyJson();
  if (!data) {
    return res.status(500).json({ error: 'No se pudo leer company.json' });
  }

  let updated = false;
  if (typeof body.reset_password === 'string' && body.reset_password.length > 0) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(body.reset_password, salt, 64).toString('hex');
    data.reset_password_salt = salt;
    data.reset_password_hash = hash;
    delete data.reset_password; // no almacenamos texto plano
    updated = true;
  }

  if (!updated) {
    return res.status(400).json({ error: 'No se enviaron campos válidos para actualizar' });
  }

  try {
    writeCompanyJson(data);
    const safe = { ...data };
    delete safe.reset_password;
    delete safe.reset_password_hash;
    delete safe.reset_password_salt;
    return res.json({ success: true, company: safe });
  } catch (err) {
    return res.status(500).json({ error: 'No se pudo escribir company.json' });
  }
});

module.exports = router;