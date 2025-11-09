import { useEffect, useMemo, useState } from 'react'
import api from '../api'
import '../styles/Empleados.css'
import stylesEmpleados from '../styles/modules/Empleados/Empleados.module.css'
import { swalConfirm, swalError, swalSuccess } from '../components/swal'

export default function Empleados(){
  const [items, setItems] = useState([])
  const [form, setForm] = useState({ nombre:'', puesto:'', sueldoMensual: 0 })
  const [sueldoText, setSueldoText] = useState('')
  const PUESTOS_FABRICA = useMemo(()=>[
    'Operario','Limpieza','Seguridad','Reparto','Mantenimiento','Empleado','RRHH','Oficina','Secretario','Ventas',
    'Desarrollador','Programador','Director','Gestión','Logística','Almacén','Calidad','Supervisor','Jefe de planta',
    'Contabilidad','Compras','Producción','Embalaje','Atención al cliente','Marketing','Diseño','Soporte IT','Electricista','Mecánico'
  ],[])
  // Estado por empleado (evita que escribir en uno afecte a otros)
  const [pagoMontoByEmp, setPagoMontoByEmp] = useState({})
  const [pagoCategoriaByEmp, setPagoCategoriaByEmp] = useState({})
  const [pagoMesByEmp, setPagoMesByEmp] = useState({})
  const [pagoMontoTextByEmp, setPagoMontoTextByEmp] = useState({})
  const currentMonth = useMemo(()=>{
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
  },[])
  const prevMonth = useMemo(()=>{
    const d = new Date();
    const y = d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear();
    const mIdx = d.getMonth() === 0 ? 11 : d.getMonth() - 1; // 0-based
    const m = String(mIdx + 1).padStart(2,'0');
    return `${y}-${m}`
  },[])
  const formatter = useMemo(() => new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), [])
  const [movs, setMovs] = useState([])
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState('id') // 'id' | 'nombre'
  const [sortDir, setSortDir] = useState('desc') // 'asc' | 'desc'

  const load = async ()=>{ const res = await api.get('/employees'); setItems(res.data) }
  const loadMovs = async ()=>{ const res = await api.get('/employees/payments'); setMovs(res.data) }
  useEffect(()=>{ load() }, [])
  useEffect(()=>{ loadMovs() }, [])

  const add = async e=>{
    e.preventDefault()
    try {
      await api.post('/employees', form)
      setForm({ nombre:'', puesto:'', sueldoMensual: 0 })
      await load()
      await swalSuccess('Empleado agregado')
    } catch(e) {
      await swalError(e.response?.data?.error || e.message, 'Agregar empleado')
    }
  }
  const del = async id=>{
    const emp = items.find(x=> x.id===id)
    const ok = await swalConfirm({ title:'Eliminar empleado', text:`¿Eliminar ${emp?.nombre || 'empleado'}?` })
    if(!ok) return
    try {
      await api.delete(`/employees/${id}`)
      await load()
      await swalSuccess('Empleado eliminado')
    } catch(e) {
      await swalError(e.response?.data?.error || e.message, 'Eliminar empleado')
    }
  }
  const pagar = async (id, sueldo)=>{
    const categoria = (pagoCategoriaByEmp[id] ?? 'adelanto')
    const montoInput = Number(pagoMontoByEmp[id] ?? 0)
    const monto = categoria === 'sueldo' ? (Number(sueldo)||0) : Math.max(montoInput||0, 10000)
    const body = { monto, categoria }
    if(categoria==='sueldo'){
      body.mes = (pagoMesByEmp[id] ?? currentMonth)
    }
    await api.post(`/employees/${id}/pagos`, body)
    setPagoMontoByEmp(prev => ({ ...prev, [id]: 0 }))
    await load(); await loadMovs()
  }

  const norm = s => String(s||'').toLowerCase()
  const viewItems = items
    .filter(e => {
      const q = norm(search)
      if(!q) return true
      return norm(e.nombre).includes(q) || norm(e.puesto).includes(q) || String(e.id).includes(q)
    })
    .sort((a,b)=>{
      const A = sortField==='nombre' ? norm(a.nombre) : Number(a.id||0)
      const B = sortField==='nombre' ? norm(b.nombre) : Number(b.id||0)
      if (sortField==='nombre') return sortDir==='asc' ? A.localeCompare(B) : B.localeCompare(A)
      return sortDir==='asc' ? A - B : B - A
    })

  return (
    <div className="container py-3">
      <h2>Empleados</h2>
      <div className="card">
        <div className="card-header">Agregar empleado</div>
        <div className="card-body">
      <form onSubmit={add} style={{ display:'grid', gridTemplateColumns:'repeat(4, minmax(200px, 1fr))', gap:12, maxWidth:900 }}>
        <label htmlFor="emp-nombre">Nombre del empleado
          <input className="form-control" id="emp-nombre" value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})} required />
        </label>
        <label htmlFor="emp-puesto">Puesto/Cargo
          <select
            id="emp-puesto"
            className="form-select"
            value={form.puesto}
            onChange={e=> setForm({ ...form, puesto: e.target.value })}
          >
            <option value="">(Seleccionar)</option>
            {PUESTOS_FABRICA.map(p => (<option key={p} value={p}>{p}</option>))}
          </select>
        </label>
        <label htmlFor="emp-sueldo">Sueldo mensual
          <input
            className="form-control"
            id="emp-sueldo"
            type="text"
            inputMode="decimal"
            placeholder="10.000,00"
            value={sueldoText !== '' ? sueldoText : (form.sueldoMensual ? formatter.format(form.sueldoMensual) : '')}
            onChange={e=>{
              const raw = (e.target.value || '')
              const cleaned = raw.replace(/\./g, '').replace(',', '.')
              const num = parseFloat(cleaned)
              setSueldoText(raw)
              setForm({ ...form, sueldoMensual: isNaN(num) ? 0 : num })
            }}
            onBlur={()=>{
              const num = Number(form.sueldoMensual)||0
              setSueldoText(num ? formatter.format(num) : '')
            }}
          />
        </label>
        <div style={{ alignSelf:'end' }}>
          <button className="btn btn-primary" type="submit">Agregar</button>
        </div>
      </form>
        </div>
      </div>

      <div className="d-flex justify-content-between align-items-center mt-3" style={{ gap:12 }}>
        <input className="form-control" style={{ maxWidth: 320 }} placeholder="Buscar por nombre, puesto o ID" value={search} onChange={e=> setSearch(e.target.value)} />
        <div className="d-flex" style={{ gap:8 }}>
          <select className="form-select" style={{ maxWidth: 160 }} value={sortField} onChange={e=> setSortField(e.target.value)}>
            <option value="id">Ordenar por ID</option>
            <option value="nombre">Ordenar por nombre</option>
          </select>
          <select className="form-select" style={{ maxWidth: 140 }} value={sortDir} onChange={e=> setSortDir(e.target.value)}>
            <option value="desc">Descendente</option>
            <option value="asc">Ascendente</option>
          </select>
        </div>
      </div>
      <div className="table-responsive mt-2">
        <table className="table table-striped tabla-productos uniform-gray" style={{ width:'100%' }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Puesto</th>
              <th>Sueldo</th>
              <th>Concepto</th>
              <th>Mes</th>
              <th>Monto</th>
              <th className="text-end">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {viewItems.map(e=> (
              <tr key={e.id}>
                <td>{e.id}</td>
                <td>{e.nombre}</td>
                <td>{e.puesto}</td>
                <td>${formatter.format(e.sueldoMensual||0)}</td>
                <td>
                  <select
                    className="form-select"
                    style={{ width: 170 }}
                    value={pagoCategoriaByEmp[e.id] ?? 'adelanto'}
                    onChange={ev=> setPagoCategoriaByEmp(prev=> ({ ...prev, [e.id]: ev.target.value }))}
                  >
                    <option value="sueldo">Pago total del mes</option>
                    <option value="adelanto">Adelanto</option>
                    <option value="aguinaldo">Aguinaldo</option>
                    <option value="vacaciones">Vacaciones</option>
                  </select>
                </td>
                <td>
                  {(pagoCategoriaByEmp[e.id] ?? 'adelanto') === 'sueldo' ? (
                    <input
                      className="form-control"
                      type="month"
                      style={{ width: 160 }}
                      value={pagoMesByEmp[e.id] ?? prevMonth}
                      min={prevMonth}
                      max={prevMonth}
                      onChange={ev=> setPagoMesByEmp(prev=> ({ ...prev, [e.id]: ev.target.value }))}
                    />
                  ) : (
                    <span className="text-muted">-</span>
                  )}
                </td>
                <td>
                  {(pagoCategoriaByEmp[e.id] ?? 'adelanto') === 'adelanto' ? (
                    <div className="d-flex" style={{ gap:6 }}>
                      <input
                        className="form-control"
                        type="text"
                        inputMode="decimal"
                        placeholder="10.000,00"
                        style={{ width: 160 }}
                        value={
                          (pagoMontoTextByEmp[e.id] ?? '') !== ''
                            ? pagoMontoTextByEmp[e.id]
                            : formatter.format(pagoMontoByEmp[e.id] ?? 0)
                        }
                        onChange={ev=> {
                          const raw = (ev.target.value || '')
                          const cleaned = raw.replace(/\./g, '').replace(',', '.')
                          const num = parseFloat(cleaned)
                          setPagoMontoTextByEmp(prev=> ({ ...prev, [e.id]: raw }))
                          setPagoMontoByEmp(prev=> ({ ...prev, [e.id]: isNaN(num) ? 0 : num }))
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        onClick={()=> {
                          const current = Number(pagoMontoByEmp[e.id] || 0)
                          const next = current + 10000
                          setPagoMontoByEmp(prev=> ({ ...prev, [e.id]: next }))
                          setPagoMontoTextByEmp(prev=> ({ ...prev, [e.id]: formatter.format(next) }))
                        }}
                      >+10.000</button>
                    </div>
                  ) : (
                    <input className="form-control" type="text" style={{ width: 160 }} value={formatter.format(e.sueldoMensual||0)} disabled />
                  )}
                </td>
                <td className="text-end" style={{whiteSpace:'nowrap'}}>
                  <button className="btn btn-sm btn-success me-2" onClick={()=>pagar(e.id, e.sueldoMensual)}>Registrar</button>
                  <button className="btn btn-sm btn-outline-danger" onClick={()=>del(e.id)}>Eliminar</button>
                </td>
              </tr>
            ))}
            {viewItems.length===0 && (
              <tr><td colSpan={8} className="text-center text-muted">No hay empleados</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="card mt-3">
        <div className="card-header d-flex justify-content-between align-items-center">
          <span>Movimientos de empleados (pagos y cobros)</span>
          <button className="btn btn-sm btn-outline-secondary" onClick={loadMovs}>Actualizar</button>
        </div>
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-sm table-striped table-hover">
              <thead>
                <tr><th>Fecha</th><th>Empleado</th><th>Tipo</th><th>Descripción</th><th className="text-end">Monto</th></tr>
              </thead>
              <tbody>
                {movs.map(m => (
                  <tr key={m.id}>
                    <td>{new Date(m.fecha).toLocaleString()}</td>
                    <td>{m.Employee?.nombre || '-'}</td>
                    <td>
                      {m.categoria ? (
                        <span className={m.categoria==='adelanto' ? 'badge bg-warning text-dark' : 'badge bg-info text-dark'}>
                          {m.categoria==='adelanto'
                            ? `Pago por adelantado${m.mes ? ` del mes ${m.mes}` : ''}`
                            : `Pago de sueldo${m.mes ? ` del mes ${m.mes}` : ''}`}
                        </span>
                      ) : (
                        <span className={m.tipo==='pago' ? 'badge bg-info text-dark' : 'badge bg-secondary'}>{m.tipo}</span>
                      )}
                    </td>
                    <td>{m.descripcion}</td>
                    <td className="text-end">${formatter.format(m.monto||0)}</td>
                  </tr>
                ))}
                {movs.length===0 && (<tr><td colSpan="5" className="text-center">No hay movimientos</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}