const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const dayjs = require('dayjs');

function money(n){
  return new Intl.NumberFormat('es-AR', { style:'currency', currency:'ARS', minimumFractionDigits:2 }).format(Number(n||0));
}

function createDashboardDoc({ period, summary, company }){
  const doc = new PDFDocument({ margin: 36, size: 'A4' });
  const companyMain = company?.name_main || process.env.COMPANY_NAME_MAIN || 'CleanPro';
  const companyColor = company?.color_main || process.env.COMPANY_COLOR || '#2196f3';
  const companySecondary = company?.name_secondary || process.env.COMPANY_NAME_SECONDARY || 'Pro';
  const companyColorSecondary = company?.color_secondary || process.env.COMPANY_COLOR_SECONDARY || '#ff9800';
  const logoRel = company?.logo_path || process.env.LOGO_PATH;
  const logoPath = logoRel ? path.join(__dirname, '..', '..', logoRel) : null;

  // Encabezado
  let y = 36;
  if (logoPath) { try { doc.image(logoPath, 40, y, { width: 90 }); } catch {} }
  doc.font('Helvetica-Bold').fontSize(34).fillColor(companyColor).text(companyMain, 140, y);
  const x2 = 140 + doc.widthOfString(companyMain + ' ');
  doc.fillColor(companyColorSecondary).text(companySecondary, x2, y);

  const now = dayjs();
  const fechaStr = now.format('DD/MM/YYYY HH:mm');
  doc.font('Helvetica-Bold').fontSize(18).fillColor('black').text('Reporte de Dashboard', 40, y + 54);
  doc.fontSize(11).text(`Período: ${period}`, 40, y + 78);
  doc.text(`Fecha de generación: ${fechaStr}`, 40, y + 94);

  // Resumen
  const top = y + 130;
  doc.font('Helvetica-Bold').fontSize(13).text('Resumen', 40, top);
  doc.font('Helvetica').fontSize(11);
  doc.text(`Ventas: ${money(summary.totalVentas)}`, 60, top + 22);
  doc.text(`Gastos: ${money(summary.totalGastos)}`, 60, top + 40);
  doc.text(`Ganancia: ${money(summary.ganancia)}`, 60, top + 58);

  // Proyección basada en ventas del período
  const projTop = top + 78;
  const proj = summary.projection || {};
  doc.font('Helvetica-Bold').fontSize(13).text('Proyección', 40, projTop);
  doc.font('Helvetica').fontSize(11);
  doc.text(`Próximo día: ${money(proj.nextDay||0)}`, 60, projTop + 22);
  doc.text(`Próxima semana: ${money(proj.nextWeek||0)}`, 60, projTop + 40);
  doc.text(`Próximo mes: ${money(proj.nextMonth||0)}`, 60, projTop + 58);

  // Sumas por categorías
  const catTop = projTop + 96;
  doc.font('Helvetica-Bold').fontSize(13).text('Gastos por categorías', 40, catTop);
  doc.font('Helvetica').fontSize(11);
  const cats = summary.groupSums || {};
  doc.text(`Operativos (Rojo): ${money(cats.rojo||0)}`, 60, catTop + 22);
  doc.text(`Proveedores (Amarillo): ${money(cats.amarillo||0)}`, 60, catTop + 40);
  doc.text(`Personal (Lila): ${money(cats.lila||0)}`, 60, catTop + 58);
  doc.text(`Infraestructura (Naranja): ${money(cats.naranja||0)}`, 60, catTop + 76);

  // Tabla de movimientos principales (pagos)
  const movTop = catTop + 120;
  doc.font('Helvetica-Bold').fontSize(13).text('Movimientos (pagos/cobros)', 40, movTop);
  let yTable = movTop + 20;
  doc.font('Helvetica-Bold').fontSize(11);
  doc.text('FECHA', 40, yTable);
  doc.text('TIPO', 140, yTable);
  doc.text('DESCRIPCIÓN', 220, yTable);
  doc.text('MONTO', 500, yTable, { width: 80, align: 'right' });
  yTable += 18;
  doc.moveTo(40, yTable).lineTo(570, yTable).stroke();
  doc.font('Helvetica').fontSize(10);
  (summary.pagos || []).slice(0, 15).forEach(p => {
    yTable += 14;
    doc.text(dayjs(p.fecha).format('DD/MM/YYYY HH:mm'), 40, yTable);
    doc.text(p.tipo, 140, yTable);
    doc.text(String(p.descripcion||''), 220, yTable, { width: 260 });
    doc.text(money(p.monto), 500, yTable, { width: 80, align: 'right' });
    yTable += 4;
    doc.moveTo(40, yTable).lineTo(570, yTable).stroke();
  });

  // Top productos por conteo
  let prodTop = movTop + 240;
  doc.font('Helvetica-Bold').fontSize(13).text('Top productos (por conteo)', 40, prodTop);
  doc.font('Helvetica').fontSize(11);
  const list = (summary.productCounts||[]).slice(0,5);
  let yy = prodTop + 22;
  list.forEach(p=>{
    doc.text(`${p.nombre} — ${p.count} uds — ${money(p.revenue||0)}`, 60, yy);
    yy += 18;
  })

  return doc;
}

function dashboardReportFilePath(baseDir){
  const d = dayjs();
  const yyyy = d.format('YYYY');
  const mm = d.format('MM');
  const dd = d.format('DD');
  const ts = d.format('HHmmss');
  return path.join(baseDir, yyyy, mm, dd, `dashboard_${yyyy}${mm}${dd}_${ts}.pdf`);
}

module.exports = { createDashboardDoc, dashboardReportFilePath };