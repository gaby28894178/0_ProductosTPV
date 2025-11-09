const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const { createInvoiceDoc } = require('../src/utils/invoice');

async function main() {
  // Demo sale and items
  const sale = { id: 999, createdAt: new Date() };
  const items = [
    { quantity: 2, pricePublico: 1500, Product: { nombre: 'Detergente Premium 1L' } },
    { quantity: 1, pricePublico: 4200, Product: { nombre: 'Jabón Líquido 5L' } },
  ];

  const billTo = ['Cliente Demo S.A.', 'CUIT 30-00000000-0', 'Av. Siempre Viva 123'];
  const shipTo = ['Depósito Central', 'Calle Falsa 456'];

  try {
    const doc = await createInvoiceDoc({ sale, items, billTo, shipTo, includeDuplicate: true });
    const outDir = path.join(__dirname, '..', 'tmp');
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, `factura_demo_${dayjs(sale.createdAt).format('YYYYMMDD_HHmm')}.pdf`);
    const ws = fs.createWriteStream(outFile);
    doc.pipe(ws);
    doc.end();
    ws.on('finish', () => {
      console.log('PDF generado:', outFile);
    });
    ws.on('error', (e) => {
      console.error('Error al generar PDF:', e.message);
      process.exit(1);
    });
  } catch (e) {
    console.error('Fallo al crear el documento:', e.message);
    process.exit(1);
  }
}

main();