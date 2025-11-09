import React, { useEffect, useMemo, useState } from 'react';
import '../styles/boleta/boleta.css';

const DEFAULT_VARS = {
  '--boleta-page-width': '800px',
  '--boleta-padding': '2rem',
  '--boleta-font-family': 'Arial, Helvetica, sans-serif',
  '--boleta-font-size': '14px',
  '--boleta-color': '#222222',
  '--boleta-border-color': '#c9c9c9',
  '--boleta-accent-color': '#0d6efd',
  '--boleta-table-row-alt': '#f8f9fa',
  '--boleta-print-margin': '10mm',
};

const DEFAULT_CFG = {
  logoUrl: '/vite.svg',
  showImages: true,
  footerText: 'Gracias por su compra. No válido como crédito fiscal.',
};

const SAMPLE_ITEMS = [
  { name: 'Producto A', qty: 2, price: 100, image: '/bleach.svg' },
  { name: 'Producto B', qty: 1, price: 150, image: '/vite.svg' },
];

export default function BoletaPreview() {
  const [vars, setVars] = useState(DEFAULT_VARS);
  const [cfg, setCfg] = useState(DEFAULT_CFG);
  const inputs = useMemo(() => ([
    { key: '--boleta-page-width', label: 'Ancho página', type: 'text', hint: 'px' },
    { key: '--boleta-padding', label: 'Padding', type: 'text', hint: 'rem/px' },
    { key: '--boleta-font-size', label: 'Tamaño fuente', type: 'text', hint: 'px' },
    { key: '--boleta-color', label: 'Color texto', type: 'color' },
    { key: '--boleta-border-color', label: 'Color borde', type: 'color' },
    { key: '--boleta-accent-color', label: 'Color acento', type: 'color' },
    { key: '--boleta-table-row-alt', label: 'Fila alterna', type: 'color' },
    { key: '--boleta-print-margin', label: 'Margen impresión', type: 'text', hint: 'mm' },
  ]), []);

  // Cargar preferencias guardadas
  useEffect(() => {
    try {
      const saved = localStorage.getItem('boletaVars');
      if (saved) {
        const parsed = JSON.parse(saved);
        setVars({ ...DEFAULT_VARS, ...parsed });
      }
      const savedCfg = localStorage.getItem('boletaCfg');
      if (savedCfg) {
        const parsedCfg = JSON.parse(savedCfg);
        setCfg({ ...DEFAULT_CFG, ...parsedCfg });
      }
    } catch (e) {
      // ignorar
    }
  }, []);

  // Aplicar variables al documento
  useEffect(() => {
    const root = document.documentElement;
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
    localStorage.setItem('boletaVars', JSON.stringify(vars));
  }, [vars]);

  const updateVar = (key, value) => setVars((prev) => ({ ...prev, [key]: value }));
  const resetVars = () => setVars(DEFAULT_VARS);
  const printView = () => window.print();
  const updateCfg = (key, value) => {
    setCfg((prev) => {
      const next = { ...prev, [key]: value };
      localStorage.setItem('boletaCfg', JSON.stringify(next));
      return next;
    });
  };

  const total = useMemo(() => {
    return SAMPLE_ITEMS.reduce((acc, it) => acc + it.qty * it.price, 0);
  }, []);
  const iva = useMemo(() => +(total * 0.21).toFixed(2), [total]);

  return (
    <div>
      <div className="boleta-preview-controls">
        {inputs.map((inp) => (
          <label key={inp.key}>
            {inp.label}
            {inp.type === 'color' ? (
              <input type="color" value={vars[inp.key]} onChange={(e) => updateVar(inp.key, e.target.value)} />
            ) : (
              <input type="text" value={vars[inp.key]} onChange={(e) => updateVar(inp.key, e.target.value)} placeholder={inp.hint || ''} />
            )}
          </label>
        ))}
        <label>
          Logo URL
          <input type="text" value={cfg.logoUrl} onChange={(e) => updateCfg('logoUrl', e.target.value)} placeholder="/vite.svg" />
        </label>
        <label>
          Mostrar imágenes
          <input type="checkbox" checked={cfg.showImages} onChange={(e) => updateCfg('showImages', e.target.checked)} />
        </label>
        <label style={{ gridColumn: '1 / -1' }}>
          Pie de página (notas)
          <textarea rows={3} value={cfg.footerText} onChange={(e) => updateCfg('footerText', e.target.value)} />
        </label>
        <div className="boleta-preview-actions">
          <button className="boleta-btn" onClick={resetVars}>Restablecer</button>
          <button className="boleta-btn primary" onClick={printView}>Imprimir</button>
        </div>
      </div>

      <div className="boleta-factura">
        <div className="boleta-header">
          <img className="boleta-logo" src={cfg.logoUrl} alt="logo" />
          <div className="boleta-header-info">
            <div>Empresa XYZ SRL</div>
            <div>CUIT: 20-12345678-9</div>
            <div>Dirección: Calle 123, CABA</div>
            <div>Tel: 11-5555-5555</div>
          </div>
        </div>
        <div className="boleta-titulo">Factura / Boleta</div>
        <div className="boleta-numero">N° 000123</div>
        <div className="boleta-cliente">Cliente: Juan Pérez</div>
        <div className="boleta-client-info">
          <div className="label">Domicilio</div>
          <div className="value">Av. Siempre Viva 742</div>
          <div className="label">Documento</div>
          <div className="value">DNI 12.345.678</div>
        </div>
        <table className="boleta-items">
          <thead>
            <tr>
              {cfg.showImages && <th className="img-col">Imagen</th>}
              <th>Producto</th>
              <th>Cantidad</th>
              <th>Precio Unitario</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {SAMPLE_ITEMS.map((it, idx) => (
              <tr key={idx}>
                {cfg.showImages && (
                  <td className="img-col">
                    <img className="boleta-thumb" src={it.image || '/vite.svg'} alt="item" />
                  </td>
                )}
                <td>{it.name}</td>
                <td>{it.qty}</td>
                <td>${it.price}</td>
                <td>${it.qty * it.price}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="boleta-totales-row">
              <td colSpan={cfg.showImages ? 4 : 3} className="boleta-total-label">Total</td>
              <td className="boleta-total">${total}</td>
            </tr>
            <tr className="boleta-totales-row">
              <td colSpan={cfg.showImages ? 4 : 3} className="boleta-iva-label">IVA 21%</td>
              <td className="boleta-iva">${iva}</td>
            </tr>
          </tfoot>
        </table>

        <div className="boleta-footer">
          <div className="boleta-footer-notes">{cfg.footerText}</div>
          <div className="boleta-footer-terms">Términos: Cambios dentro de 7 días con ticket.</div>
          <div className="boleta-footer-contact">Email: contacto@empresa.xyz | Web: empresa.xyz</div>
          <div className="boleta-signatures">
            <div>
              <div>Firma Cliente</div>
              <div className="boleta-sign-box"></div>
            </div>
            <div>
              <div>Firma Autorizada</div>
              <div className="boleta-sign-box"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}