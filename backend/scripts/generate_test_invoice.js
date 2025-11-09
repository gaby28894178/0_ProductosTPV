const path = require('path');
const fs = require('fs');
const dayjs = require('dayjs');
const { createInvoiceDoc } = require('../src/utils/invoice');

(async () => {
  try {
    const sale = { id: 9999, createdAt: new Date(), total: 1234.56 };
    const items = [
      { pricePublico: 456.78, quantity: 2, Product: { nombre: 'Producto de prueba', imagenUrl: '' } },
      { pricePublico: 321.0, quantity: 1, Product: { nombre: 'Otro producto', imagenUrl: '' } },
    ];
    const billTo = ['Cliente de Prueba', 'Dirección 123', 'Ciudad, País'];
    const shipTo = ['Cliente de Prueba', 'Dirección 123', 'Ciudad, País'];
    const doc = await createInvoiceDoc({ sale, items, billTo, shipTo, includeDuplicate: false });

    const baseDir = path.join(__dirname, '..', 'facturas', 'preview');
    fs.mkdirSync(baseDir, { recursive: true });
    const file = path.join(baseDir, 'gracias_layout_test.pdf');

    const ws = fs.createWriteStream(file);
    await new Promise((resolve, reject) => {
      ws.on('finish', resolve);
      ws.on('error', reject);
      doc.pipe(ws);
      doc.end();
    });

    console.log('OK:', file);
    console.log('URL:', '/facturas/preview/gracias_layout_test.pdf');
  } catch (e) {
    console.error('ERROR:', e && e.message ? e.message : e);
    process.exit(1);
  }
})();