import { useEffect, useState } from 'react'
import api from '../api'

export default function ProductCapacityModal({ product, onClose }){
  const [tab, setTab] = useState('mapeo') // 'mapeo' | 'produccion'
  const [mayoristas, setMayoristas] = useState([])
  const [mappings, setMappings] = useState([])
  const [selectedMateriaPrimaId, setSelectedMateriaPrimaId] = useState(null)
  const [rendimiento, setRendimiento] = useState('')
  const [capacity, setCapacity] = useState([])
  const [litrosInput, setLitrosInput] = useState('')
  const [nota, setNota] = useState('')
  const [events, setEvents] = useState([])

  const fmtInt = (n)=> Math.trunc(Number(n||0))
  const fmtNum = (n)=> new Intl.NumberFormat('es-ES').format(Number(n||0))

  const loadMayoristas = async ()=>{
    const res = await api.get('/products?includeMayorista=true')
    setMayoristas(Array.isArray(res.data) ? res.data.filter(p=> !!p.esMayorista) : [])
  }
  const loadMappings = async ()=>{
    const res = await api.get(`/product-materials`, { params: { productId: product.id } })
    setMappings(Array.isArray(res.data) ? res.data : [])
  }
  const loadCapacity = async ()=>{
    const res = await api.get(`/production/capacity`, { params: { productId: product.id } })
    setCapacity(Array.isArray(res.data) ? res.data : [])
  }
  const loadEvents = async ()=>{
    const res = await api.get(`/production/events`, { params: { productId: product.id } })
    setEvents(Array.isArray(res.data) ? res.data : [])
  }

  useEffect(()=>{ loadMayoristas(); loadMappings(); loadCapacity(); loadEvents() }, [product?.id])

  const onAddMapping = async ()=>{
    const materiaPrimaId = Number(selectedMateriaPrimaId||0)
    const rend = Math.trunc(Number(rendimiento||0))
    if (!materiaPrimaId) return alert('Seleccioná materia prima mayorista')
    if (!rend || rend<=0) return alert('Ingresá rendimiento en litros por empaque')
    try {
      await api.post('/product-materials', { productId: product.id, materiaPrimaId, rendimientoLitrosPorEmpaque: rend })
      setRendimiento('')
      await Promise.all([loadMappings(), loadCapacity()])
      setTab('produccion')
    } catch (e) {
      alert(e.response?.data?.error || e.message)
    }
  }

  const onProduce = async ()=>{
    const materiaPrimaId = Number(selectedMateriaPrimaId||0)
    const litros = Math.trunc(Number(litrosInput||0))
    if (!materiaPrimaId) return alert('Seleccioná materia prima')
    if (!litros || litros<=0) return alert('Ingresá litros a registrar')
    try {
      await api.post('/production/produce', { productId: product.id, materiaPrimaId, litros, nota })
      setLitrosInput(''); setNota('')
      await Promise.all([loadCapacity(), loadEvents()])
    } catch (e) {
      alert(e.response?.data?.error || e.message)
    }
  }

  useEffect(()=>{
    // Preseleccionar primera materia prima con mapeo, si existe
    if (mappings.length>0 && !selectedMateriaPrimaId) {
      setSelectedMateriaPrimaId(mappings[0].materiaPrimaId)
    }
  }, [mappings])

  const capForSelected = capacity.find(c=> c.materiaPrimaId === Number(selectedMateriaPrimaId))
  const totalCapacidad = capacity.reduce((sum, c)=> sum + Math.trunc(Number(c.capacidadTotalLitros||0)), 0)
  const totalCreados = capacity.reduce((sum, c)=> sum + Math.trunc(Number(c.litrosCreados||0)), 0)
  const totalRestantes = Math.max(0, totalCapacidad - totalCreados)

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <h5 className="m-0">Capacidad de litros · {product.nombre}</h5>
          <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>Cerrar</button>
        </div>

        <div className="tabs">
          <button className={`tab-btn ${tab==='mapeo'?'active':''}`} onClick={()=>setTab('mapeo')}>Mapeo materia prima</button>
          <button className={`tab-btn ${tab==='produccion'?'active':''}`} onClick={()=>setTab('produccion')}>Producción</button>
        </div>

        {tab==='mapeo' && (
          <div className="p-2">
            <div className="row g-2 align-items-end">
              <div className="col-md-5">
                <label className="form-label">Materia prima mayorista</label>
                <select className="form-select" value={selectedMateriaPrimaId||''} onChange={e=> setSelectedMateriaPrimaId(e.target.value)}>
                  <option value="">Seleccioná...</option>
                  {mayoristas.map(m=> (
                    <option key={m.id} value={m.id}>{m.nombre} · stock: {fmtInt(m.stock)}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Rendimiento (L por empaque)</label>
                <input className="form-control" type="text" inputMode="numeric" value={rendimiento} onChange={e=> setRendimiento(String(e.target.value||'').replace(/[^0-9]/g,''))} placeholder="ej: 240" />
              </div>
              <div className="col-md-3">
                <button className="btn btn-primary w-100" onClick={onAddMapping}>Guardar mapeo</button>
              </div>
            </div>
            <div className="mt-3">
              <h6>Mapeos existentes</h6>
              <table className="table table-sm">
                <thead><tr><th>Materia prima</th><th className="text-end">Rendimiento</th><th className="text-end">Acciones</th></tr></thead>
                <tbody>
                  {mappings.map(m=> (
                    <tr key={m.id}>
                      <td>{mayoristas.find(x=>x.id===m.materiaPrimaId)?.nombre || `ID ${m.materiaPrimaId}`}</td>
                      <td className="text-end">{fmtInt(m.rendimientoLitrosPorEmpaque)} L/emp</td>
                      <td className="text-end"><button className="btn btn-sm btn-outline-danger" onClick={async ()=>{ await api.delete(`/product-materials/${m.id}`); await Promise.all([loadMappings(), loadCapacity()]) }}>Eliminar</button></td>
                    </tr>
                  ))}
                  {mappings.length===0 && (<tr><td colSpan="3" className="text-center text-muted">Sin mapeos aún</td></tr>)}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab==='produccion' && (
          <div className="p-2">
            <div className="alert alert-secondary d-flex justify-content-between align-items-center">
              <span><strong>Resumen total</strong></span>
              <span>Mapeado: <strong>{fmtInt(totalCapacidad)} L</strong> · Creado: <strong>{fmtInt(totalCreados)} L</strong> · Restante: <strong>{fmtInt(totalRestantes)} L</strong></span>
            </div>
            <div className="row g-2 align-items-end">
              <div className="col-md-5">
                <label className="form-label">Materia prima</label>
                <select className="form-select" value={selectedMateriaPrimaId||''} onChange={e=> setSelectedMateriaPrimaId(e.target.value)}>
                  <option value="">Seleccioná...</option>
                  {mappings.map(m=> (
                    <option key={m.id} value={m.materiaPrimaId}>{mayoristas.find(x=>x.id===m.materiaPrimaId)?.nombre || `ID ${m.materiaPrimaId}`}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label">Litros a registrar</label>
                <input className="form-control" type="text" inputMode="numeric" value={litrosInput} onChange={e=> setLitrosInput(String(e.target.value||'').replace(/[^0-9]/g,''))} />
              </div>
              <div className="col-md-4">
                <label className="form-label">Nota (opcional)</label>
                <input className="form-control" value={nota} onChange={e=> setNota(e.target.value)} />
              </div>
              <div className="col-12">
                <button className="btn btn-success" onClick={onProduce}>Registrar litros</button>
              </div>
            </div>
            <div className="mt-3">
              <h6>Capacidad y estado</h6>
              {capForSelected ? (
                <div className="alert alert-info d-flex justify-content-between">
              <span>Empaques disponibles: <strong>{fmtInt(capForSelected.stockEmpaques)}</strong> · Rendimiento: <strong>{fmtInt(capForSelected.rendimientoLitrosPorEmpaque)} L/emp</strong></span>
              <span>Total: <strong>{fmtInt(capForSelected.capacidadTotalLitros)} L</strong> · Creado: <strong>{fmtInt(capForSelected.litrosCreados)} L</strong> · Restante: <strong>{fmtInt(capForSelected.litrosRestantes)} L</strong></span>
                </div>
              ) : (
                <div className="text-muted">Seleccioná una materia prima para ver capacidad.</div>
              )}
              <h6 className="mt-2">Eventos de producción</h6>
              <table className="table table-sm">
                <thead><tr><th>Materia prima</th><th>Litros</th><th>Nota</th></tr></thead>
                <tbody>
                  {events.map(ev=> (
                    <tr key={ev.id}><td>{mayoristas.find(x=>x.id===ev.materiaPrimaId)?.nombre || `ID ${ev.materiaPrimaId}`}</td><td>{fmtInt(ev.litros)} L</td><td>{ev.nota||''}</td></tr>
                  ))}
                  {events.length===0 && (<tr><td colSpan="3" className="text-center text-muted">Sin eventos aún</td></tr>)}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="modal-footer">
          <button className="btn btn-outline-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
      <style>{`
        .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:1050}
        .modal-card{background:#fff;border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,.2);max-width:900px;width:95%}
        .modal-header{display:flex;justify-content:space-between;align-items:center;padding:.75rem 1rem;border-bottom:1px solid #dee2e6}
        .tabs{display:flex;gap:8px;padding:.5rem 1rem;border-bottom:1px solid #dee2e6}
        .tab-btn{border:none;background:transparent;padding:.25rem .75rem;border-radius:999px}
        .tab-btn.active{background:#e9ecef}
        .modal-footer{padding:.5rem 1rem;border-top:1px solid #dee2e6;display:flex;justify-content:flex-end;gap:8px}
      `}</style>
    </div>
  )
}