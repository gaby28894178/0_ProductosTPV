import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import '../styles/boleta/boleta.css';
import { resolveAssetUrl, toDataUrlFromUrl } from '../utils/assets';

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
  const location = useLocation();
  const [vars, setVars] = useState(DEFAULT_VARS);
  const [cfg, setCfg] = useState(DEFAULT_CFG);
  const [companyName, setCompanyName] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyAddressLines, setCompanyAddressLines] = useState([]);
  const [companyEmail, setCompanyEmail] = useState('');
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

  // Cargar logo (desde listaprecio.json) y datos de empresa (desde company.json)
  useEffect(() => {
    const loadBranding = async () => {
      // Logo y nombre desde lista de precios
      try {
        const resLP = await fetch(resolveAssetUrl('assets/listaprecio.json'));
        if (resLP.ok) {
          const lp = await resLP.json();
          let logoUrl = cfg.logoUrl;
          if (lp?.logo) {
            const raw = String(lp.logo || '').trim();
            // Aceptar valores tipo "assets/..." o "./invoice-assets/..." normalizando a 
            // "assets/invoice-assets/..." para el backend
            const cleaned = raw.replace(/^\.\/+/, '');
            const withAssets = cleaned.startsWith('assets/') ? cleaned : `assets/${cleaned}`;
            const absLogo = resolveAssetUrl(withAssets);
            // Convertir a data URL para evitar bloqueos ORB/CORS en dev
            const dataLogo = await toDataUrlFromUrl(absLogo).catch(()=> null);
            logoUrl = dataLogo || absLogo;
          }
          setCfg(prev => {
            const next = { ...prev, logoUrl };
            localStorage.setItem('boletaCfg', JSON.stringify(next));
            return next;
          });
          if (lp?.name) setCompanyName(lp.name);
        }
      } catch {}

      // Nombre, dirección y teléfono desde company.json
      try {
        const resC = await fetch(resolveAssetUrl('assets/company.json'));
        if (resC.ok) {
          const c = await resC.json();
          // Preferir nombre ya establecido desde lista de precios; si falta, usar company.json
          if (!companyName) {
            const nameCandidate = c?.bill_to?.[0] || (c?.name_main && c?.name_secondary ? `${c.name_main} ${c.name_secondary}` : '');
            if (nameCandidate) setCompanyName(nameCandidate);
          }
          if (Array.isArray(c?.address_lines)) setCompanyAddressLines(c.address_lines);
          if (c?.phone) setCompanyPhone(c.phone);
          if (c?.email) setCompanyEmail(c.email);
        }
      } catch {}
    };
    loadBranding();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const mode = useMemo(()=> new URLSearchParams(location.search).get('mode') || '', [location.search]);
  const autoPrint = useMemo(()=> new URLSearchParams(location.search).get('print') === '1', [location.search]);
  const items = useMemo(()=>{
    if (mode==='presupuesto') {
      try{
        const raw = localStorage.getItem('presupuestoItems');
        if (raw) return JSON.parse(raw);
      }catch{}
    }
    return SAMPLE_ITEMS;
  }, [mode]);
  const taxCfg = useMemo(()=>{
    if (mode==='presupuesto') {
      try{
        const raw = localStorage.getItem('presupuestoIva');
        if (raw){
          const v = JSON.parse(raw);
          return { conIva: !!v.conIva, ivaPct: Number(v.ivaPct||0) };
        }
      }catch{}
    }
    return { conIva: true, ivaPct: 21 };
  }, [mode]);
  const subtotal = useMemo(() => {
    return +items.reduce((acc, it) => acc + it.qty * it.price, 0).toFixed(2);
  }, [items]);
  const ivaMonto = useMemo(() => taxCfg.conIva ? +(subtotal * (Number(taxCfg.ivaPct||0)/100)).toFixed(2) : 0, [subtotal, taxCfg]);
  const totalConIva = useMemo(() => taxCfg.conIva ? +(subtotal + ivaMonto).toFixed(2) : subtotal, [subtotal, ivaMonto, taxCfg]);

  // Si viene con print=1, lanzar impresión automática tras montar y cargar imágenes
  useEffect(() => {
    if (!autoPrint) return;
    const timer = setTimeout(() => {
      try { window.print(); } catch {}
    }, 600); // pequeña espera para que carguen el logo y las miniaturas
    return () => clearTimeout(timer);
  }, [autoPrint]);

  return (
    <div>
      

      <div className="boleta-factura">
        <div className="boleta-header">
          <img className="boleta-logo" src={cfg.logoUrl} alt="logo" />
          <div className="boleta-header-info">
            <div>{companyName || ' '}</div>
            {companyAddressLines && companyAddressLines.map((ln, i) => (
              <div key={i}>{ln}</div>
            ))}
            {companyPhone ? (<div>Tel: {companyPhone}</div>) : null}
          </div>
        </div>
        <div className="boleta-titulo">{mode==='presupuesto' ? 'Presupuesto' : 'Factura / Boleta'}</div>
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
            {items.map((it, idx) => (
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
              <td colSpan={cfg.showImages ? 4 : 3} className="boleta-total-label">Subtotal</td>
              <td className="boleta-total">${subtotal}</td>
            </tr>
            <tr className="boleta-totales-row">
              <td colSpan={cfg.showImages ? 4 : 3} className="boleta-iva-label">IVA {Number(taxCfg.ivaPct||0)}%</td>
              <td className="boleta-iva">${ivaMonto}</td>
            </tr>
            <tr className="boleta-totales-row">
              <td colSpan={cfg.showImages ? 4 : 3} className="boleta-total-label">Total</td>
              <td className="boleta-total">${totalConIva}</td>
            </tr>
          </tfoot>
        </table>

          <div className="boleta-footer">
            <div className="boleta-footer-notes">{cfg.footerText}</div>
            <div className="boleta-footer-terms">Términos: Cambios dentro de 7 días con ticket.</div>
          <div className="boleta-footer-contact">{companyEmail ? `Email: ${companyEmail}` : ''}</div>
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