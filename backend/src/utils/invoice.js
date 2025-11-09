const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const dayjs = require('dayjs');
const https = require('https');
const http = require('http');

// Filtra líneas del bloque "ENVIAR A" para mostrar solo
// nombre (primera línea), dirección, teléfono y partido.
function sanitizeShipTo(lines) {
  const src = Array.isArray(lines) ? lines.map(s => String(s || '').trim()).filter(Boolean) : [];
  if (src.length === 0) return src;
  const out = [];
  // Primera línea: nombre
  out.push(src[0]);
  let addrCount = 0;
  let phoneAdded = false;
  let partidoAdded = false;
  for (let i = 1; i < src.length; i++) {
    const s = src[i];
    const lower = s.toLowerCase();
    const isPhone = /\b(tel|telefono|teléfono|cel|celular)\b/.test(lower) || /\+?\d[\d\-\s().]{7,}/.test(s);
    const isPartido = /\b(partido|municipio|distrito)\b/.test(lower);
    const isAddress = /\b(direc|calle|av\.|avenida|ruta|km|barrio|manzana|lote|entre|esq|nro|n°|num)\b/.test(lower) || /\d{1,5}/.test(s);
    if (isAddress && addrCount < 2) {
      out.push(s);
      addrCount++;
    } else if (isPhone && !phoneAdded) {
      out.push(s);
      phoneAdded = true;
    } else if (isPartido && !partidoAdded) {
      out.push(s);
      partidoAdded = true;
    }
  }
  return out;
}

function loadCompanyConfig() {
  try {
    const p = path.join(__dirname, '..', '..', 'assets', 'company.json');
    const raw = fs.readFileSync(p, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// Carga un CSS simple con variables y clases para estilos de la boleta.
// Admite custom properties (--var: 123;) y clases básicas con font-size.
function loadInvoiceStyles() {
  try {
    const p = path.join(__dirname, '..', '..', 'assets', 'invoice-assets', 'invoice.css');
    if (!fs.existsSync(p)) return {};
    const raw = fs.readFileSync(p, 'utf8');
    const map = {};
    // Custom properties: --row-height: 30;
    const varRegex = /--([a-zA-Z0-9_-]+)\s*:\s*([0-9.]+)\s*;?/g;
    let m;
    while ((m = varRegex.exec(raw))) {
      map[m[1]] = Number(m[2]);
    }
    // Clases conocidas: .item-title { font-size: 13; }
    const classFontRegex = /\.(item-title|item-desc|item-qty|item-amount)\s*\{[^}]*font-size\s*:\s*([0-9.]+)[^}]*\}/g;
    while ((m = classFontRegex.exec(raw))) {
      const key = m[1].replace('-', '_') + '_font';
      map[key] = Number(m[2]);
    }
    return map;
  } catch {
    return {};
  }
}

// Descarga una URL a Buffer (HTTP/HTTPS). Timeout corto y tamaño razonable.
function fetchUrlToBuffer(url, timeoutMs = 5000) {
  return new Promise((resolve) => {
    try {
      const lib = url.startsWith('https') ? https : http;
      const req = lib.get(url, { timeout: timeoutMs }, (res) => {
        const status = res.statusCode || 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          // seguir redirección simple
          try { fetchUrlToBuffer(res.headers.location, timeoutMs).then(resolve).catch(()=> resolve(null)); } catch { resolve(null); }
          return;
        }
        if (status !== 200) { resolve(null); return; }
        const chunks = [];
        res.on('data', (c)=> chunks.push(c));
        res.on('end', ()=> {
          try { resolve(Buffer.concat(chunks)); } catch { resolve(null); }
        });
      });
      req.on('error', ()=> resolve(null));
      req.on('timeout', ()=> { try{ req.destroy(); }catch{} resolve(null); });
    } catch { resolve(null); }
  });
}

async function createInvoiceDoc({ sale, items, billTo, shipTo, includeDuplicate = false, applyTax = null, taxRatePercent = null, shippingAmountOverride = null }) {
  const company = loadCompanyConfig();
  const styles = loadInvoiceStyles();
  const doc = new PDFDocument({ margin: 36, size: 'A4' });
  const companyMain = company.name_main || process.env.COMPANY_NAME_MAIN || 'CleanPro';
  const companySecondary = company.name_secondary || process.env.COMPANY_NAME_SECONDARY || 'Pro';
  const companyColor = company.color_main || process.env.COMPANY_COLOR || '#2196f3';
  const companyColorSecondary = company.color_secondary || process.env.COMPANY_COLOR_SECONDARY || '#ff9800';
  const companyPhone = company.phone || process.env.COMPANY_PHONE || '00-0000-0000';
  const companyEmail = company.email || '';
  const companyAddress = (company.address_lines || []);
  const logoRel = company.logo_path || process.env.LOGO_PATH;
  const logoPath = logoRel ? path.join(__dirname, '..', '..', logoRel) : null;
  const legalNote = company.legal_note || process.env.LEGAL_NOTE || 'Este comprobante se emite conforme a la legislación comercial vigente. Conservar la factura para garantías y devoluciones según políticas del comercio.';
  const thankTitle = company.thank_title || process.env.THANK_TITLE || 'Gracias por su compra';
  const thankParagraph = company.thank_paragraph || process.env.THANK_PARAGRAPH || legalNote;

  // Imagen por defecto para productos sin miniatura (local o URL)
  const defaultThumbRel = company.default_product_image || process.env.DEFAULT_PRODUCT_IMAGE || '';
  let defaultThumbBuf = null;
  if (defaultThumbRel) {
    try {
      if (!/^https?:\/\//i.test(defaultThumbRel)) {
        const abs = path.isAbsolute(defaultThumbRel) ? defaultThumbRel : path.join(__dirname, '..', '..', defaultThumbRel.replace(/^\/+/, ''));
        if (fs.existsSync(abs)) {
          defaultThumbBuf = fs.readFileSync(abs);
        }
      } else {
        const buf = await fetchUrlToBuffer(defaultThumbRel, 5000);
        if (buf) defaultThumbBuf = buf;
      }
    } catch { /* ignore */ }
  }

  // Pre-cargar miniaturas de productos (si hay URL o ruta local)
  const itemThumbs = [];
  for (const it of items) {
    const url = (it && it.Product && it.Product.imagenUrl) ? String(it.Product.imagenUrl) : '';
    if (!url) { itemThumbs.push(null); continue; }
    // Si es ruta local relativa al repo
    if (!/^https?:\/\//i.test(url)) {
      const abs = path.isAbsolute(url) ? url : path.join(__dirname, '..', '..', url.replace(/^\/+/, ''));
      try {
        if (fs.existsSync(abs)) {
          const buf = fs.readFileSync(abs);
          itemThumbs.push(buf);
        } else {
          itemThumbs.push(null);
        }
      } catch { itemThumbs.push(null); }
    } else {
      // URL remota
      try {
        const buf = await fetchUrlToBuffer(url, 5000);
        itemThumbs.push(buf || null);
      } catch { itemThumbs.push(null); }
    }
  }

  function renderFullInvoice(isDuplicate) {
    // Marcas de agua con el logo de la empresa (CleanPro)
    // Tres instancias: arriba, medio y abajo con baja opacidad
    try {
      const pageW = doc.page.width; const pageH = doc.page.height;
      const wmWidth = Math.min(420, Math.floor(pageW * 0.6));
      const positions = [0.25, 0.5, 0.75];
      positions.forEach((pos) => {
        doc.save();
        doc.opacity(0.05);
        if (logoPath && fs.existsSync(logoPath)) {
          const x = Math.floor((pageW - wmWidth) / 2);
          const y = Math.floor(pageH * pos - wmWidth / 2);
          try { doc.image(logoPath, x, y, { width: wmWidth }); } catch {}
        } else {
          // Fallback: texto diagonal CleanPro
          const origin = [pageW / 2, Math.floor(pageH * pos)];
          doc.rotate(-25, { origin });
          doc.font('Helvetica-Bold').fontSize(96).fillColor('#cccccc')
            .text(`${companyMain}${companySecondary}`, origin[0] - 300, origin[1] - 60, { width: 600, align: 'center' });
          doc.rotate(0);
        }
        doc.restore();
      });
    } catch {}

    // Encabezado
    let y = 39;
    if (logoPath) {
      try { doc.image(logoPath, 40, y, { width: 93 }); } catch {}
    }
    // Marca a la izquierda con colores (aumentar +3pt)
    doc.font('Helvetica-Bold').fontSize(37).fillColor(companyColor).text(companyMain, 140, y);
    const x2 = 140 + doc.widthOfString(companyMain + ' ');
    doc.fillColor(companyColorSecondary).text(companySecondary, x2, y);
    // Datos de empresa más a la izquierda
    doc.fillColor('black').font('Helvetica-Bold').fontSize(12).text('DATOS DE LA EMPRESA', 40, y + 40);
    doc.fillColor('black').font('Helvetica').fontSize(13);
    let infoY = y + 56;
    companyAddress.slice(0, 4).forEach((line) => { doc.text(line, 40, infoY); infoY += 17; });
    if (companyPhone) { doc.text(`Tel: ${companyPhone}`, 40, infoY); infoY += 17; }
    if (companyEmail) { doc.text(`Email: ${companyEmail}`, 40, infoY); infoY += 17; }

    // Panel FACTURA (derecha)
    const panelX = 380; const panelW = 170; const panelY = 40; const panelH = 112;
    // Leyendas: ORIGINAL en la primera página, DUPLICADO en la segunda
    if (isDuplicate) {
      doc.font('Helvetica-Bold').fontSize(15).fillColor('red').text('DUPLICADO', panelX, panelY - 16, { width: panelW, align: 'center' });
      doc.fillColor('black');
    } else {
      doc.font('Helvetica-Bold').fontSize(15).fillColor('black').text('ORIGINAL', panelX, panelY - 16, { width: panelW, align: 'center' });
      doc.fillColor('black');
    }
    doc.roundedRect(panelX, panelY, panelW, panelH, 6).stroke();
    // Título FACTURA más grande (+3pt)
    doc.font('Helvetica-Bold').fontSize(25).text('FACTURA', panelX, panelY + 12, { width: panelW, align: 'center' });
    const fechaStr = dayjs(sale.createdAt).format('DD/MM/YYYY HH:mm');
    doc.font('Helvetica').fontSize(13);
    // Número de factura con prefijo y guiones: 000-321-id
    doc.text(`N°: 000-321-${sale.id}`, panelX + 8, panelY + 44);
    doc.text(`Fecha: ${fechaStr}`, panelX + 8, panelY + 64);

    // Bloques Facturar a / Enviar a
    // Evitar que se superponga con el bloque de datos de la empresa
    const blockY = Math.max(140, (typeof infoY === 'number' ? infoY + 10 : 140));
    const blockW = 250;
    const dataBillTo = (billTo && Array.isArray(billTo) && billTo.length) ? billTo : (company.bill_to || [companyMain, ...(companyAddress || [])]);
    doc.font('Helvetica-Bold').fontSize(11).text('DATOS DEL CLIENTE:', 40, blockY);
    doc.font('Helvetica').fontSize(10);
    dataBillTo.slice(0,6).forEach((line, idx)=> doc.text(line, 40, blockY + 16 + idx*14, { width: blockW }));
    // Bloque ENVIAR A removido por requerimiento: sólo FACTURAR A

    // Tabla de ítems compactada para que todo entre en UNA sola hoja
    // Bajar la tabla si los bloques FACTURAR/ENVIAR ocupan más espacio
    const billLinesCount = Math.min(6, dataBillTo.length);
    const blocksBottom = blockY + 16 + billLinesCount * 14;
    const tableTop = Math.max(218, blocksBottom + 14);
    // Banda de encabezado clara para evitar que se vea nada por debajo
    doc.moveTo(40, tableTop).lineTo(570, tableTop).stroke();
    doc.save(); doc.fillColor('#ffffff'); doc.rect(40, tableTop, 530, 24).fill(); doc.restore();
    doc.font('Helvetica-Bold').fontSize(14);
    const headerDescX = Number(styles['desc-column-x']) || 110;
    doc.text('DESCRIPCIÓN', headerDescX, tableTop + 6);
    // Columna de cantidad centrada por defecto; si CSS provee X (>0) se respeta
    let headerQtyX = Number(styles['qty-column-x']);
    const headerAmtX = Number(styles['amt-column-x']) || 505;
    const headerAmtW = Number(styles['amt-column-w']) || 65;
    if (!Number.isFinite(headerQtyX) || headerQtyX <= 0) {
      // Centro aproximado entre fin de descripción y comienzo de monto
      const descW = Number(styles['desc-width']) || 300;
      const leftEnd = headerDescX + descW;
      const qtyW = 60;
      const gap = headerAmtX - leftEnd;
      headerQtyX = leftEnd + Math.max(0, Math.floor((gap - qtyW) / 2));
    }
    doc.text('CANT.', headerQtyX, tableTop + 6, { width: 60, align: 'center' });
    // Ajustar MONTO para que no se solape y leer ancho/pos desde CSS
    doc.text('MONTO', headerAmtX, tableTop + 6, { width: headerAmtW, align: 'right' });
    doc.moveTo(40, tableTop + 24).lineTo(570, tableTop + 24).stroke();
    const itemsHeaderTop = tableTop + 24;
    // Asegurar opacidad plena antes de dibujar filas para evitar artefactos
    try { doc.opacity(1); } catch {}
    let subtotal = 0;
    // Reserva de espacio inferior: solo el panel de totales (el agradecimiento irá al costado)
    const panelH2 = 96;
    const buffer = 10;
    const minBottomMargin = 20;
    const reservedSpace = panelH2 + minBottomMargin;
    // Calcular altura disponible para filas y ajustarlas dinámicamente
    const sumTopPre = Math.max(itemsHeaderTop + 12, doc.page.height - reservedSpace);
    const availableItemsHeight = Math.max(60, sumTopPre - itemsHeaderTop - 12);
    // Alto fijo más alto para evitar que el texto quede "encimado"
    const rowHeight = Number(styles['row-height']) || 30;
    // Separación entre filas para dar más aire visual
    const rowGap = Number(styles['row-gap']) || 2;
    const descFont = Math.max(8, Math.min(11, Math.floor(rowHeight * 0.45)));
    const amtFont = Number(styles.item_amount_font) || Math.max(9, Math.floor(descFont)); // monto más pequeño para evitar desborde
    // Helper para limpiar unidades (Kg/L/Bidón) del nombre/descripcion
    const stripUnits = (s) => String(s || '')
      .replace(/\b[Bb]id[oó]n(?:es)?\b/giu, '')
      .replace(/\b\d+\s*(?:Kg|Kgs|KG|kg|kilo(?:s)?|Litros?|L|Lt)\b/giu, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/\s*-\s*$/,'')
      .trim();
    // Dibujar filas compactadas con miniaturas y texto al lado
    items.forEach((it, idx) => {
      const amount = it.pricePublico * it.quantity;
      subtotal += amount;
      const prodNameRaw = String(it?.Product?.nombreBoleta || it?.Product?.nombre || it?.nombre || '').trim() || 'Producto';
      const prodDescRaw = String(it?.Product?.descripcion || it?.descripcion || it?.Product?.marca || '').trim();
      const prodName = stripUnits(prodNameRaw);
      const prodDesc = stripUnits(prodDescRaw);
      // Detectar productos de cloro y agregar presentación Bidón 5L
      const isCloro = /clor|cloro|hipoclor/iu.test(`${prodNameRaw} ${prodDescRaw}`);
      const presSuffix = isCloro ? ' – Bidón 5L' : '';
      const rowTop = itemsHeaderTop + 8 + idx * (rowHeight + rowGap);
      const rowBottom = rowTop + rowHeight;
      // Fondo alterno tipo grilla por fila
      doc.save();
      const even = idx % 2 === 0;
      doc.fillColor(even ? '#f2f6ff' : '#f9f9f9');
      doc.rect(40, rowTop, 530, rowHeight).fill();
      doc.restore();
      // Miniatura del producto
      const thumb = (itemThumbs && itemThumbs[idx]) ? itemThumbs[idx] : (defaultThumbBuf || null);
      // Tamaño de miniatura configurable por CSS: --thumb-size (12-32)
      const cssThumbSize = Number(styles['thumb-size']);
      const thumbBase = Math.max(12, Math.min(rowHeight - 4, 24));
      let thumbSize = Math.min(thumbBase + 4, 32);
      if (Number.isFinite(cssThumbSize) && cssThumbSize >= 12 && cssThumbSize <= 32) {
        thumbSize = Math.floor(cssThumbSize);
      }
      // Posición X de miniatura configurable: --thumb-x (por defecto 44)
      const cssThumbX = Number(styles['thumb-x']);
      const thumbX = Number.isFinite(cssThumbX) ? cssThumbX : 44;
      if (thumb) {
        try { doc.image(thumb, thumbX, rowTop + 2, { fit: [thumbSize, thumbSize] }); } catch {}
      } else {
        // Placeholder si no hay imagen
        doc.save();
        doc.fillColor('#f0f0f0');
        doc.rect(thumbX, rowTop + 2, thumbSize, thumbSize).fill();
        doc.restore();
      }
      // Marca de agua 'cleanpro' sobre la miniatura
      try {
        doc.save();
        doc.opacity(0.08);
        doc.fillColor('#555');
        const wmX = thumbX, wmY = rowTop + 2;
        const wmFont = Math.max(8, Math.floor(thumbSize / 2));
        doc.rotate(-30, { origin: [wmX + thumbSize / 2, wmY + thumbSize / 2] });
        doc.fontSize(wmFont).text('cleanpro', wmX, wmY + (thumbSize / 2) - (wmFont / 2), { width: thumbSize, align: 'center' });
        doc.restore();
      } catch {}
      // Texto al lado de la imagen: título + descripción breve en dos líneas
      const thumbGapCss = Number(styles['thumb-gap']);
      const thumbGap = Number.isFinite(thumbGapCss) && thumbGapCss >= 0 ? Math.floor(thumbGapCss) : 8;
      const defaultTextX = thumbX + thumbSize + thumbGap;
      const descColumnCss = Number(styles['desc-column-x']);
      const descColumnX = Number.isFinite(descColumnCss) ? descColumnCss : 0;
      // Asegura que el texto de las filas nunca toque la miniatura:
      // usa el mayor entre la columna de descripción y el borde derecho de la miniatura + gap.
      const textX = Math.max(descColumnX, defaultTextX);
      const titleFont = Number(styles.item_title_font) || (Math.max(9, descFont) + 2); // título más pequeño
      const subFont = Number(styles.item_desc_font) || Math.max(7, Math.floor(descFont * 0.75)); // descripción ~75%
      const qtyFont = Number(styles.item_qty_font) || Math.max(9, Math.floor(descFont * 0.9));    // cantidad un poco más grande
      const textY = rowTop + 1;
      // Nombre del producto (sin cantidad pegada)
      doc.font('Helvetica-Bold').fontSize(titleFont);
      const descWidth = Number(styles['desc-width']) || 300;
      doc.text(prodName + presSuffix, textX, textY, { width: descWidth });
      // Descripción en segunda línea (si existe)
      if (prodDesc) {
        doc.font('Helvetica').fontSize(subFont);
        doc.text(prodDesc, textX, textY + titleFont + 2, { width: descWidth });
      }
      // Cantidad en columna central (centrada verticalmente y con opacidad plena)
      try { doc.opacity(1); } catch {}
      doc.font('Helvetica-Bold').fontSize(qtyFont);
      // Posición de cantidad: centrada entre descripción y monto si no se fija desde CSS
      const qtyW = 60;
      let qtyX = Number(styles['qty-column-x']);
      // Posición de MONTO (valores): permite diferenciar header y filas con --amt-body-x
      const amtHeaderX = Number(styles['amt-column-x']) || 505;
      const amtBodyXCss = Number(styles['amt-body-x']);
      const amtX = Number.isFinite(amtBodyXCss) ? amtBodyXCss : amtHeaderX;
      const amtW = Number(styles['amt-column-w']) || 65;
      if (!Number.isFinite(qtyX) || qtyX <= 0) {
        const leftEnd = textX + descWidth;
        const gap = amtX - leftEnd;
        qtyX = leftEnd + Math.max(0, Math.floor((gap - qtyW) / 2));
      }
      const qtyY = rowTop + Math.max(4, Math.floor((rowHeight - qtyFont) / 2));
      doc.text(String(it.quantity), qtyX, qtyY, { width: qtyW, align: 'center' });
      // Monto alineado al inicio de la fila (no centrado)
      doc.font('Helvetica').fontSize(amtFont);
      const amtY = rowTop + 2;
      doc.text(`$${amount.toFixed(2)}`, amtX, amtY, { width: amtW, align: 'right' });
    });
    // Última Y de referencia para totales
    const ty = itemsHeaderTop + items.length * (rowHeight + rowGap);

    // Resumen (derecha) con panel claro y buen espaciado
    // Reutilizar mediciones anteriores
    const requiredSpace = panelH2 + buffer;
    // No crear nueva página: posicionar el panel de totales respetando margen inferior
    const sumTop = Math.max(ty + 8, doc.page.height - (panelH2 + minBottomMargin));
    // IVA: se puede forzar desde parámetros; si applyTax === false, es 0
    let defaultTaxPercent = Number(process.env.TAX_RATE || company.tax_rate);
    if (!Number.isFinite(defaultTaxPercent) || defaultTaxPercent <= 0) defaultTaxPercent = 21;
    let taxRate;
    if (applyTax === false) taxRate = 0;
    else if (typeof taxRatePercent === 'number' && Number.isFinite(taxRatePercent)) taxRate = Math.max(0, taxRatePercent) / 100;
    else taxRate = Math.max(0, defaultTaxPercent) / 100;
    // Envío: se elimina del cálculo y visualización
    const shippingAmount = 0;
    const subtotalCalc = items.reduce((a, it) => a + it.pricePublico * it.quantity, 0);
    const tax = +((subtotal) * taxRate).toFixed(2);
    const shipping = +shippingAmount.toFixed(2);
    const total = +((subtotal) + tax).toFixed(2);
    // Formato de moneda es-AR
    const money = (n)=> new Intl.NumberFormat('es-AR', { style:'currency', currency:'ARS', minimumFractionDigits:2 }).format(Number(n||0));

    // Caja de resumen
    const panelX2 = 395; const panelW2 = 190; // panelH2 definido arriba
    doc.save();
    doc.fillColor('#f5f5f5');
    doc.roundedRect(panelX2, sumTop - 8, panelW2, panelH2, 6).fill();
    doc.restore();

    const labelX = panelX2 + 10; const valueX = panelX2 + panelW2 - 10; const lineH = 22;
    doc.font('Helvetica').fontSize(11).fillColor('black');
    doc.text('SUBTOTAL', labelX, sumTop, { width: 120, align: 'left' });
    doc.text(money(subtotal), valueX - 120, sumTop, { width: 120, align: 'right' });
    const isExempt = taxRate === 0;
    if (isExempt) {
      doc.text('IVA: Exento', labelX, sumTop + lineH, { width: 140, align: 'left' });
      doc.text(money(0), valueX - 120, sumTop + lineH, { width: 120, align: 'right' });
    } else {
      doc.text(`IVA (${(taxRate*100).toFixed(2)}%)`, labelX, sumTop + lineH, { width: 140, align: 'left' });
      doc.text(money(tax), valueX - 120, sumTop + lineH, { width: 120, align: 'right' });
    }
    // Removemos la fila de Envío/Manipulación del panel visible
    doc.font('Helvetica-Bold').fontSize(13);
    doc.text('TOTAL', labelX, sumTop + lineH*2, { width: 120, align: 'left' });
    doc.text(money(total), valueX - 120, sumTop + lineH*2, { width: 120, align: 'right' });

    // Mensaje de agradecimiento y párrafo ubicados a la izquierda del panel de TOTAL
    const leftBlockX = 40;
    const leftBlockW = panelX2 - 60; // espacio disponible a la izquierda del panel
    const leftBlockY = sumTop;
    // Medir alturas para dibujar un panel suave detrás del bloque de agradecimiento
    let leftTitleH = 14, leftParaH = 28;
    try { doc.font('Helvetica-Bold').fontSize(12); leftTitleH = doc.heightOfString(thankTitle, { width: leftBlockW }) || leftTitleH; } catch {}
    try { doc.font('Helvetica').fontSize(9); leftParaH = doc.heightOfString(thankParagraph, { width: leftBlockW }) || leftParaH; } catch {}
    const leftPanelH = leftTitleH + 6 + leftParaH + 8;
    doc.save();
    doc.fillColor('#f7f7f7');
    doc.roundedRect(leftBlockX - 6, leftBlockY - 6, leftBlockW + 12, leftPanelH, 6).fill();
    doc.restore();
    // Texto dentro del panel
    doc.font('Helvetica-Bold').fontSize(12).fillColor('black')
       .text(thankTitle, leftBlockX, leftBlockY, { width: leftBlockW });
    doc.font('Helvetica').fontSize(9).fillColor('black')
       .text(thankParagraph, leftBlockX, leftBlockY + leftTitleH + 6, { width: leftBlockW });
  }

  // Hoja de detalle: tabla de ítems con salto de página automático
  function renderItemsPage() {
    // Encabezado
    let y = 36;
    doc.font('Helvetica-Bold').fontSize(16).fillColor('black').text('DETALLE DE ITEMS', 40, y);
    // Tabla
    const tableTop = 80;
    doc.moveTo(40, tableTop).lineTo(570, tableTop).stroke();
    doc.font('Helvetica-Bold').fontSize(11);
    doc.text('DESCRIPCIÓN', 110, tableTop + 6);
    doc.text('MONTO', 480, tableTop + 6, { width: 80, align: 'right' });
    doc.moveTo(40, tableTop + 24).lineTo(570, tableTop + 24).stroke();
    let prevLineY = tableTop + 24;
    doc.font('Helvetica').fontSize(10);
    items.forEach((it, idx) => {
      const amount = it.pricePublico * it.quantity;
      const prodName = String(it?.Product?.nombreBoleta || it?.Product?.nombre || it?.nombre || '').trim() || 'Producto';
      const prodDesc = String(it?.Product?.descripcion || it?.descripcion || it?.Product?.marca || '').trim();
      const rowHeight = 36;
      const rowTop = prevLineY;
      const rowBottom = rowTop + rowHeight;
      if (rowBottom > doc.page.height - 36) {
        doc.addPage();
        const nt = 40;
        doc.moveTo(40, nt).lineTo(570, nt).stroke();
        doc.font('Helvetica-Bold').fontSize(11);
        doc.text('DESCRIPCIÓN', 110, nt + 6);
        doc.text('MONTO', 480, nt + 6, { width: 80, align: 'right' });
        doc.moveTo(40, nt + 24).lineTo(570, nt + 24).stroke();
        prevLineY = nt + 24;
      }
      const thumb = itemThumbs ? itemThumbs[idx] : null;
      if (thumb) { try { doc.image(thumb, 44, prevLineY + 2, { fit: [34,34] }); } catch {} }
      const textX = thumb ? (44 + 34 + 8) : 110;
      const titleFont = 10;
      const subFont = 8;
      const qtyFont = subFont;
      const textY = prevLineY + 3;
      // Nombre del producto
      doc.font('Helvetica-Bold').fontSize(titleFont);
      doc.text(prodName, textX, textY, { width: 360 });
      // Descripción
      if (prodDesc) {
        doc.font('Helvetica').fontSize(subFont);
        doc.text(prodDesc, textX, textY + titleFont + 2, { width: 360 });
      }
      // Cantidad en tercera línea
      doc.font('Helvetica-Bold').fontSize(qtyFont);
      const qtyY = textY + titleFont + 2 + (prodDesc ? (subFont + 2) : 0);
      doc.text(`Cantidad: ${it.quantity}`, textX, qtyY, { width: 360 });
      // Monto alineado al inicio de la fila
      const amtY = prevLineY + 4;
      doc.font('Helvetica').fontSize(10);
      doc.text(`$${amount.toFixed(2)}`, 480, amtY, { width: 90, align: 'right' });
      // Suprimir línea separadora por fila para compactar visualmente
      prevLineY = prevLineY + rowHeight;
    });
  }

  // Generar ORIGINAL y, si corresponde, DUPLICADO (cada uno en su propia hoja)
  renderFullInvoice(false);
  if (includeDuplicate) {
    doc.addPage();
    renderFullInvoice(true);
  }

  return doc;
}

function invoiceFilePath(baseDir, sale) {
  const d = dayjs(sale.createdAt || Date.now());
  const yyyy = d.format('YYYY');
  const mm = d.format('MM');
  const dd = d.format('DD');
  return path.join(baseDir, yyyy, mm, dd, `factura_${sale.id}.pdf`);
}

module.exports = { createInvoiceDoc, invoiceFilePath };