import { useEffect, useState } from 'react'
import api from '../api'
import { swalError, swalSuccess, swalConfirm } from '../components/swal'

export default function Facturas() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedUrl, setSelectedUrl] = useState('')
  // Filtros
  const [saleIdFilter, setSaleIdFilter] = useState('')

  // Construir URL absoluta hacia el backend (quita "/api" del baseURL del cliente)
  const backendBase = String(api?.defaults?.baseURL || '').replace(/\/api$/, '')
  const toAbsolute = (u)=>{
    const s = String(u||'')
    if (/^https?:\/\//i.test(s)) return s
    return backendBase + (s.startsWith('/') ? s : '/' + s)
  }

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/invoices')
      const list = Array.isArray(res.data) ? res.data.map(r=> ({...r, absUrl: toAbsolute(r.url)})) : []
      setRows(list)
      // Si no hay selección, elegir el primero (URL absoluta)
      if (!selectedUrl && list.length) setSelectedUrl(list[0].absUrl)
    } catch (e) {
      setError(e.response?.data?.error || e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const eliminarTodos = async ()=>{
    const ok = await swalConfirm('¿Eliminar todos los PDFs generados?', 'Confirmación')
    if (!ok) return
    try {
      await api.delete('/invoices')
      await load()
      await swalSuccess('Se eliminaron todos los PDFs', 'Facturas')
    } catch(e){
      await swalError(e.response?.data?.error || e.message, 'Eliminar PDFs')
    }
  }

  return (
  // Si prefieres listado arriba y visor abajo (para pantallas pequeñas)
<div className="container-fluid py-1 px-3">
  {/* Mismo header... */}
  
  <div className="row">
    <div className="col-12">
      <div className="card mb-3">
        <div className="card-header d-flex justify-content-between align-items-center">
          <span>Listado de Facturas</span>
          <div className="d-flex" style={{gap:8}}>
            <button className="btn btn-sm btn-outline-secondary" onClick={load}>Actualizar</button>
            <button className="btn btn-sm btn-outline-danger" onClick={eliminarTodos}>Borrar todo</button>
          </div>
        </div>
        <div className="card-body">
          {/* Controles de filtro */}
          <div className="row g-2 mb-2 align-items-end">
            <div className="col-12 col-sm-6 col-md-4">
              <label className="form-label">Filtrar por ID de venta</label>
              <input
                type="text"
                className="form-control"
                value={saleIdFilter}
                onChange={(e)=> setSaleIdFilter(e.target.value)}
                placeholder="Ej: 123"
              />
            </div>
          </div>
          {/* Lista filtrada */}
          {(()=>{
            const saleIdNum = saleIdFilter && /^[0-9]+$/.test(saleIdFilter.trim()) ? Number(saleIdFilter.trim()) : null
            const filtered = rows.filter(r=>{
              if (saleIdNum !== null && Number(r.saleId||0) !== saleIdNum) return false
              return true
            })
            return (
              <div className="row g-2">
                {filtered.map((f, idx) => (
                  <div className="col-md-6 col-lg-4 col-xl-3" key={idx}>
                    <div className={`card ${selectedUrl===f.absUrl?'border-primary':''}`}>
                      <div className="card-body">
                        <h6 className="card-title text-truncate">{f.fileName}</h6>
                        <p className="card-text small text-muted">{f.datePath || '—'}</p>
                        <div className="d-flex justify-content-between">
                          <span className={`badge ${f.saleId? 'bg-success':'bg-secondary'}`}>
                            {f.saleId?`#${f.saleId}`:'Sin venta'}
                          </span>
                          <div style={{gap:4}} className="d-flex">
                            <button 
                              className="btn btn-sm btn-outline-primary"
                              onClick={()=> setSelectedUrl(f.absUrl)}
                            >
                              Ver
                            </button>
                            <a className="btn btn-sm btn-outline-success" href={f.absUrl} download>
                              Descargar
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {filtered.length === 0 && (
                  <div className="col-12">
                    <div className="alert alert-secondary">No hay resultados para el filtro.</div>
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  </div>

  <div className="row">
    <div className="col-12">
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <span>Vista Previa</span>
          {selectedUrl && (
            <a className="btn btn-sm btn-outline-primary" href={selectedUrl} target="_blank">
              Abrir en pestaña
            </a>
          )}
        </div>
        <div className="card-body p-0" style={{height: '70vh'}}>
          {selectedUrl ? (
            <iframe src={selectedUrl} className="w-100 h-100" style={{border: 'none'}}></iframe>
          ) : (
            <div className="d-flex align-items-center justify-content-center h-100 text-muted">
              Seleccioná una factura para previsualizar
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
  </div>
  )
}
