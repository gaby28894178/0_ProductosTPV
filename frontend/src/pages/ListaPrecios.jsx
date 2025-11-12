import { useEffect, useMemo, useState } from 'react'
// Config se cargará desde backend: /assets/listaprecio.json
import api from '../api'
import { swalError } from '../components/swal'
import { resolveAssetUrl, toDataUrlFromUrl, getImageFormatFromDataUrl } from '../utils/assets'

// Formateo de dinero en ARS
const fmtMoney = (n)=> new Intl.NumberFormat('es-AR', { style:'currency', currency:'ARS', minimumFractionDigits:2 }).format(Number(n||0))

// (Movido a utils/assets.js)

export default function ListaPrecios(){
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [marca, setMarca] = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())

  const load = async ()=>{
    setError('')
    try{
      // Sólo productos finales (no mayoristas)
      const res = await api.get('/products?includeMayorista=false')
      const rows = Array.isArray(res.data) ? res.data.filter(p=> !p.esMayorista) : []
      setItems(rows)
    }catch(e){ setError(e.response?.data?.error || e.message) }
  }
  useEffect(()=>{ load() }, [])

  // Cargar selección guardada
  useEffect(()=>{
    try{
      const raw = localStorage.getItem('priceListIds')
      if (raw) {
        const arr = JSON.parse(raw)
        if (Array.isArray(arr)) setSelectedIds(new Set(arr.map(n=> Number(n)).filter(Boolean)))
      }
    }catch{}
  }, [])

  const saveSelection = (setFn)=>{
    setSelectedIds(prev=>{
      const next = setFn(prev)
      try{ localStorage.setItem('priceListIds', JSON.stringify(Array.from(next))) }catch{}
      return next
    })
  }

  const viewItems = useMemo(()=>{
    const q = String(search||'').toLowerCase()
    const m = String(marca||'').toLowerCase()
    return items.filter(p=>{
      const okQ = !q || String(p.nombreBoleta||p.nombre||'').toLowerCase().includes(q)
        || String(p.marca||'').toLowerCase().includes(q) || String(p.unidad||'').toLowerCase().includes(q)
      const okM = !m || String(p.marca||'').toLowerCase() === m
      return okQ && okM
    })
  }, [items, search, marca])

  const selectedItems = useMemo(()=> items.filter(p=> selectedIds.has(p.id)), [items, selectedIds])

  const exportPDF = async ()=>{
    try{
      const { default: jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default
      const doc = new jsPDF('p','pt','a4')
      const fecha = new Date().toLocaleString('es-AR')

      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()

      if (!selectedItems.length) { swalError('Agregá productos a la lista antes de exportar'); return }

      // Leer configuración desde backend /assets/listaprecio.json
      let cfgName = 'cleanPro.s.a'
      let cfgLogo = null
      try {
        const resCfg = await fetch(resolveAssetUrl('assets/listaprecio.json'))
        if (resCfg.ok) {
          const conf = await resCfg.json()
          cfgName = conf?.name || cfgName
          cfgLogo = conf?.logo || null
        }
      } catch {}

      // Preparar logo desde configuración
      let headerLogoDataUrl = null
      try{
        if (cfgLogo) {
          let raw = String(cfgLogo || '')
          const looksValidDataUrl = raw.startsWith('data:') && raw.includes('base64,') && !raw.includes('truncated') && raw.length > 64
          if (looksValidDataUrl) {
            headerLogoDataUrl = raw
          } else if (raw.startsWith('data:')) {
            // Data URL inválida (ejemplo: placeholder truncado), ignorar logo
            headerLogoDataUrl = null
          } else {
            // Normalizar rutas relativas provenientes de listaprecio.json
            // Acepta: "assets/...", "invoice-assets/...", "./invoice-assets/...", "/invoice-assets/..." o sólo nombre de archivo
            const cleaned = raw.replace(/^[.\/]+/, '')
            let src = cleaned
            if (/^assets\//i.test(cleaned)) {
              src = cleaned.replace(/^\/+/, '')
            } else if (/^invoice-assets\//i.test(cleaned)) {
              src = `assets/${cleaned}`
            } else {
              // Sólo nombre de archivo u otra carpeta: asumir assets/invoice-assets
              src = `assets/invoice-assets/${cleaned}`
            }
            headerLogoDataUrl = await toDataUrlFromUrl(src)
          }
        }
      }catch{}

      // Cargar miniaturas para cada producto seleccionado
      const rowsWithImgs = await Promise.all(selectedItems.map(async (p)=>{
        let img = null
        if (p.imagenUrl) {
          try{ img = await toDataUrlFromUrl(p.imagenUrl) }catch{}
        }
        return { p, img }
      }))

      const head = [['Img', 'ID', 'Nombre', 'Marca', 'Unidad', 'Precio público']]
      const body = rowsWithImgs.map(({p})=> [
        ' ',
        String(p.id||''),
        String(p.nombreBoleta || p.nombre || ''),
        String(p.marca||''),
        String(p.unidad||''),
        fmtMoney(p.precioPublico)
      ])

      autoTable(doc, {
        head,
        body,
        startY: 70,
        styles: { fontSize: 10 },
        headStyles: { fillColor: [20,40,120], textColor: 255 },
        didDrawPage: (data)=>{
          // Encabezado con “logo” textual cleanPro.s.a
          doc.setFillColor(20,40,120)
          doc.rect(0, 0, pageWidth, 50, 'F')
          doc.setTextColor(255,255,255)
          doc.setFontSize(18)
          // Título en mayúsculas (izquierda)
          doc.text(String(cfgName || '').toUpperCase(), 20, 32)

          // Marca de agua en mayúsculas, centrada (más transparente)
          try{
            const wm = 'GLEANPRO.S.A'
            // Transparencia si está disponible
            if (doc.GState) {
              const gs = new doc.GState({ opacity: 0.12 })
              doc.setGState(gs)
            }
            doc.setFontSize(56)
            doc.setTextColor(235)
            doc.text(wm.toUpperCase(), pageWidth/2, pageHeight/2, { align:'center', angle: 15 })
            // Restablecer opacidad
            if (doc.GState) {
              const gsReset = new doc.GState({ opacity: 1 })
              doc.setGState(gsReset)
            }
          }catch{}

          // Imagen/Logo en el encabezado, centrado entre el nombre y la fecha
          if (headerLogoDataUrl) {
            try{
              const fmt = getImageFormatFromDataUrl(headerLogoDataUrl)
              const w = 28
              const h = 28
              const x = (pageWidth - w) / 2
              const y = 11
              doc.addImage(headerLogoDataUrl, fmt, x, y, w, h)
            }catch{}
          }
          doc.setFontSize(11)
          doc.setTextColor(230,230,230)
          doc.text('Lista de Precios', pageWidth - 20, 22, { align:'right' })
          doc.text(`Generado: ${fecha}`, pageWidth - 20, 36, { align:'right' })

          // Pie de página con numeración
          const pageNumber = doc.internal.getNumberOfPages()
          doc.setFontSize(9)
          doc.setTextColor(100)
          doc.text(`Página ${data.pageNumber} de ${pageNumber}`, pageWidth/2, pageHeight - 16, { align:'center' })
        },
        didDrawCell: (data)=>{
          // Dibujar miniatura en la primera columna
          if (data.section === 'body' && data.column.index === 0) {
            const rowIdx = data.row.index
            const img = rowsWithImgs[rowIdx]?.img
            if (img) {
              try{
                const fmt = getImageFormatFromDataUrl(img)
                const pad = 2
                const maxH = Math.max(12, data.cell.height - pad*2)
                const h = Math.min(24, maxH * 0.6) // más chico
                const w = h
                const x = data.cell.x + (data.cell.width - w) / 2
                const y = data.cell.y + (data.cell.height - h) / 2
                doc.addImage(img, fmt, x, y, w, h)
              }catch{}
            }
          }
        }
      })
      doc.save('Lista_precios.pdf')
    }catch(e){ swalError(e.message || 'Error al exportar PDF') }
  }

  const marcasUnicas = useMemo(()=>{
    const set = new Set(items.map(p=> String(p.marca||'').trim()).filter(Boolean))
    return Array.from(set).sort((a,b)=> a.localeCompare(b))
  }, [items])

  return (
    <div className="container py-3">
      <h2>Lista de Precios</h2>
      {error && <div className="alert alert-danger">{error}</div>}
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <span>Productos — seleccionados ({selectedItems.length})</span>
          <div className="d-flex" style={{ gap: 8 }}>
            <button className="btn btn-outline-success" onClick={exportPDF}>Exportar a PDF</button>
            <button className="btn btn-outline-danger" onClick={()=> saveSelection(()=> new Set())}>Vaciar</button>
          </div>
        </div>
        <div className="card-body">
          <div className="d-flex flex-wrap" style={{ gap: 8, marginBottom: 8 }}>
            <input className="form-control" style={{ maxWidth: 280 }} placeholder="Buscar por nombre, unidad o marca" value={search} onChange={e=> setSearch(e.target.value)} />
            <select className="form-select" style={{ maxWidth: 220 }} value={marca} onChange={e=> setMarca(e.target.value)}>
              <option value="">Todas las marcas</option>
              {marcasUnicas.map(m=> (<option key={m} value={m.toLowerCase()}>{m}</option>))}
            </select>
          </div>
          <div className="table-responsive">
            <table className="table table-striped">
              <thead>
                <tr><th>Img</th><th>ID</th><th>Nombre</th><th>Marca</th><th>Unidad</th><th>Precio público</th><th></th></tr>
              </thead>
              <tbody>
                {viewItems.map(p=> (
                  <tr key={p.id}>
                    <td>{p.imagenUrl ? <img alt="img" src={resolveAssetUrl(p.imagenUrl)} style={{ height:28 }} /> : <span className="text-muted">-</span>}</td>
                    <td>{p.id}</td>
                    <td>{p.nombreBoleta || p.nombre}</td>
                    <td>{p.marca || '-'}</td>
                    <td>{p.unidad}</td>
                    <td>{fmtMoney(p.precioPublico)}</td>
                    <td className="text-end">
                      {selectedIds.has(p.id) ? (
                        <button className="btn btn-sm btn-outline-secondary" onClick={()=> saveSelection(prev=>{ const n=new Set(prev); n.delete(p.id); return n })}>Quitar</button>
                      ) : (
                        <button className="btn btn-sm btn-primary" onClick={()=> saveSelection(prev=>{ const n=new Set(prev); n.add(p.id); return n })}>Agregar</button>
                      )}
                    </td>
                  </tr>
                ))}
                {viewItems.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-muted">No hay productos para mostrar</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}