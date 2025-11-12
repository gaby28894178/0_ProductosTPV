import { useEffect, useState } from 'react'
import { formatEsMoneyLive, parseEsNumber } from '../utils/money'
import api from '../api'

export default function Gastos(){
  const [items, setItems] = useState([])
  const [form, setForm] = useState({ tipo:'gasto', descripcion:'', monto:0, employeeId:null })
  const [montoUi, setMontoUi] = useState('')
  const [error, setError] = useState('')
  const [employees, setEmployees] = useState([])

  const load = async ()=>{
    const res = await api.get('/expenses')
    setItems(res.data)
  }
  useEffect(()=>{ load(); (async()=>{ try{ const r = await api.get('/employees'); setEmployees(r.data) }catch{} })() },[])

  const submit = async e=>{
    e.preventDefault(); setError('')
    try{ await api.post('/expenses', form); setForm({ tipo:'gasto', descripcion:'', monto:0, employeeId:null }); setMontoUi(''); await load() }catch(e){ setError(e.response?.data?.error || e.message) }
  }

  const del = async id=>{ await api.delete(`/expenses/${id}`); await load() }

  return (
    <div className="container py-3">
      <h2>Gastos y pagos</h2>
      <div className="card">
        <div className="card-header">Registrar gasto o pago</div>
        <div className="card-body">
      <form onSubmit={submit} style={{ display:'flex', gap:8 }}>
        <label htmlFor="gasto-tipo" style={{ minWidth: 280 }}>Tipo de gasto
          <select id="gasto-tipo" className="form-select" value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value})}>
            <option value="gasto">Gasto (general)</option>
            <option value="construccion">Construcción</option>
            <option value="vehiculo">Vehículo</option>
            <option value="insumo_mayorista">Insumo mayorista</option>
            <option value="insumo_minorista">Insumo minorista</option>
            <option value="oficina">Oficina</option>
            <option value="electronicos_oficina">Electrónicos de oficina</option>
            <option value="herramientas">Herramientas</option>
            <option value="servicios">Servicios</option>
            <option value="consumos">Consumos</option>
            <option value="varios">Gasto vario</option>
            <option value="pago_proveedor">Pago a proveedor</option>
            <option value="pago_empleado">Pago a empleado</option>
            <option value="cobro_empleado">Cobro de empleado</option>
          </select>
        </label>
        {(form.tipo==='pago_empleado' || form.tipo==='cobro_empleado') && (
          <label htmlFor="gasto-emp" style={{ minWidth: 220 }}>Empleado
            <select id="gasto-emp" className="form-select" value={form.employeeId||''} onChange={e=>setForm({...form,employeeId: e.target.value ? Number(e.target.value) : null})}>
              <option value="">(Seleccionar)</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.nombre}</option>
              ))}
            </select>
          </label>
        )}
        <label htmlFor="gasto-descripcion" style={{ flex: 1 }}>Descripción
          <input id="gasto-descripcion" className="form-control" placeholder="Ej: Insumos de limpieza" value={form.descripcion} onChange={e=>setForm({...form,descripcion:e.target.value})} />
        </label>
        <label htmlFor="gasto-monto" style={{ minWidth: 180 }}>Monto (ARS)
          <input
            id="gasto-monto"
            className="form-control"
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={montoUi}
            onFocus={e=>{
              const v = String(montoUi||'')
              if (!v || v === '0,00') {
                setMontoUi('')
                requestAnimationFrame(()=> e.target.select())
              }
            }}
            onChange={e=>{
              const formatted = formatEsMoneyLive(e.target.value)
              setMontoUi(formatted)
              setForm({ ...form, monto: parseEsNumber(formatted) })
            }}
            onBlur={e=>{
              const n = parseEsNumber(e.target.value)
              setMontoUi(new Intl.NumberFormat('es-AR', { minimumFractionDigits:2, maximumFractionDigits:2 }).format(n))
              setForm({ ...form, monto: n })
            }}
          />
        </label>
        <button className="btn btn-primary" type="submit">Agregar</button>
      </form>
        </div>
      </div>
      {error && <p style={{color:'red'}}>{error}</p>}

      <ul className="list-group mt-3">
        {items.map(i=> (
          <li className="list-group-item d-flex justify-content-between align-items-center" key={i.id}>
            <span>{i.tipo} - {i.descripcion} - ${new Intl.NumberFormat('es-AR', { minimumFractionDigits:2, maximumFractionDigits:2 }).format(Number(i.monto||0))}</span>
            <button className="btn btn-sm btn-outline-danger" onClick={()=>del(i.id)}>Eliminar</button>
          </li>
        ))}
      </ul>
    </div>
  )
}