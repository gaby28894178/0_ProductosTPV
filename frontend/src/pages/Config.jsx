import { useEffect, useState } from 'react'
import api from '../api'
import { swalConfirm, swalError, swalSuccess, swalPromptText } from '../components/swal'

// Formateo y parseo de dinero con punto de miles y coma decimal (es-AR)
function formatMoneyEs(value){
  const n = Number(value) || 0
  return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}
function parseMoneyEs(str){
  if (typeof str !== 'string') return Number(str) || 0
  const s = str
    .replace(/\./g, '')       // quitar puntos de miles
    .replace(',', '.')         // convertir coma decimal a punto
    .replace(/[^0-9.\-]/g,'') // limpiar caracteres no numéricos
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

export default function Config(){
  const [cfg, setCfg] = useState({ capitalInicial:0, proyeccionSemanal:0, proyeccionMensual:0, backupName:'', backupSemanalActivo:false, backupSemanalDia:1, backupSemanalHora:'09:00' })
  const [capitalStr, setCapitalStr] = useState('0,00')
  const [weeklyStr, setWeeklyStr] = useState('0,00')
  const [monthlyStr, setMonthlyStr] = useState('0,00')
  const [autoMode, setAutoMode] = useState(true)
  const [companyPass, setCompanyPass] = useState('')

  const load = async ()=>{
    const res = await api.get('/config');
    setCfg(res.data)
    setCapitalStr(formatMoneyEs(res.data?.capitalInicial || 0))
    setWeeklyStr(formatMoneyEs(res.data?.proyeccionSemanal || 0))
    setMonthlyStr(formatMoneyEs(res.data?.proyeccionMensual || 0))
    try{
      // No prellenamos la contraseña por seguridad; sólo verificamos que el endpoint exista
      await api.get('/company')
    }catch(e){ /* opcional: ignoramos error si endpoint no disponible */ }
  }
  useEffect(()=>{ load() },[])

  const save = async ()=>{ await api.put('/config', cfg); await load() }
  const downloadBackup = async ()=>{
    try{
      const res = await api.get('/config/backup', { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      const base = (cfg.backupName && cfg.backupName.trim()) || 'respaldo'
      const name = base.toLowerCase().endsWith('.sqlite') ? base : `${base}.sqlite`
      a.download = name
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(()=> URL.revokeObjectURL(url), 60_000)
    }catch(e){ swalError(e.response?.data?.error || e.message) }
  }
  const restoreBackup = async (file)=>{
    try{
      const data = await file.arrayBuffer()
      await api.post('/config/restore', data, {
        headers: { 'Content-Type': 'application/octet-stream' }
      })
      swalSuccess('Restauración completada. Reiniciá el backend para aplicar completamente.')
    }catch(e){ swalError(e.response?.data?.error || e.message) }
  }
  const resetDb = async ()=>{
    const ok = await swalConfirm({ title:'Resetear base de datos', text:'Se borrarán clientes, destinos, productos, ventas, gastos y usuarios.' })
    if (!ok) return
    const pass = await swalPromptText({ title:'Clave de seguridad', inputLabel:'Ingresá la contraseña para resetear', placeholder:'********' })
    if (!pass) {
      swalError('Operación cancelada. Falta la contraseña.')
      return
    }
    try{
      await api.post('/config/reset', { password: pass })
      await swalSuccess('Base de datos reseteada. Se borraron todos los usuarios y datos.')
      localStorage.removeItem('token')
      location.href = '/auth'
    }catch(e){ swalError(e.response?.data?.error || e.message) }
  }

  const saveCompanyPass = async ()=>{
    try{
      await api.put('/company', { reset_password: companyPass })
      await swalSuccess('Contraseña actualizada correctamente.')
    }catch(e){ swalError(e.response?.data?.error || e.message) }
  }

  return (
    <div className="container py-2">
      <h2>Configuración</h2>
      <div className="row g-2">
        <div className="col-12 col-md-6">
          <div className="card h-100">
            <div className="card-header">Parámetros financieros</div>
            <div className="card-body" style={{ display:'grid', gap:8 }}>
        <div className="form-check form-switch">
          <input className="form-check-input" type="checkbox" id="autoModeSwitch" checked={autoMode} onChange={e=>{
            const enabled = e.target.checked
            setAutoMode(enabled)
            if (enabled){
              const mensual = (cfg.capitalInicial || 0) * 2
              const semanal = mensual / 4
              setCfg(prev=> ({ ...prev, proyeccionMensual: mensual, proyeccionSemanal: semanal }))
              setMonthlyStr(formatMoneyEs(mensual))
              setWeeklyStr(formatMoneyEs(semanal))
            }
          }} />
          <label className="form-check-label" htmlFor="autoModeSwitch">Calcular proyecciones automáticamente</label>
        </div>
        <label>Capital inicial
          <input
            className="form-control"
            type="text"
            inputMode="decimal"
            value={capitalStr}
            onChange={e=>{
              const raw = e.target.value
              setCapitalStr(raw)
              const parsed = parseMoneyEs(raw)
              // En modo automático: mensual = 2×capital y semanal = mensual ÷ 4
              if (autoMode){
                const mensual = parsed * 2
                const semanal = mensual / 4
                setCfg({ ...cfg, capitalInicial: parsed, proyeccionMensual: mensual, proyeccionSemanal: semanal })
                setMonthlyStr(formatMoneyEs(mensual))
                setWeeklyStr(formatMoneyEs(semanal))
              } else {
                // En manual: sólo actualizamos capital
                setCfg({ ...cfg, capitalInicial: parsed })
              }
            }}
            onBlur={()=> setCapitalStr(formatMoneyEs(cfg.capitalInicial || 0))}
          />
        </label>
        <label>Proyección semanal (calculada)
          <input
            className="form-control"
            type="text"
            inputMode="decimal"
            value={weeklyStr}
            readOnly
            onBlur={()=> setWeeklyStr(formatMoneyEs(cfg.proyeccionSemanal || 0))}
          />
        </label>
        <label>Proyección mensual {autoMode ? '(2× inversión)' : '(editable)'}
          <input
            className="form-control"
            type="text"
            inputMode="decimal"
            value={monthlyStr}
            readOnly={autoMode}
            onChange={e=>{
              if (autoMode) return
              const raw = e.target.value
              setMonthlyStr(raw)
              const mensual = parseMoneyEs(raw)
              const semanal = mensual / 4
              setCfg({ ...cfg, proyeccionMensual: mensual, proyeccionSemanal: semanal })
              setWeeklyStr(formatMoneyEs(semanal))
            }}
            onBlur={()=> setMonthlyStr(formatMoneyEs(cfg.proyeccionMensual || 0))}
          />
        </label>
        <button className="btn btn-primary" onClick={save}>Guardar</button>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-6">
          <div className="card h-100">
            <div className="card-header">Respaldo de Base de Datos</div>
            <div className="card-body" style={{ display:'grid', gap:8 }}>
          <label>Nombre de respaldo
            <input
              className="form-control"
              type="text"
              placeholder="ej. respaldo_quimica.sqlite"
              value={cfg.backupName || ''}
              onChange={e=> setCfg({ ...cfg, backupName: e.target.value })}
            />
          </label>
          <small className="text-muted">Este nombre se usará al generar o guardar copias de la base.</small>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-outline-primary" onClick={save}>Guardar nombre</button>
            <button className="btn btn-primary" onClick={downloadBackup}>Guardar respaldo</button>
          </div>
          <div>
            <label className="form-label">Restaurar base desde archivo</label>
            <input type="file" className="form-control" accept=".sqlite" onChange={e=>{
              const f = e.target.files?.[0]
              if (f) restoreBackup(f)
            }} />
            <small className="text-muted">Se reemplazará la base actual. Luego reiniciar backend.</small>
          </div>
          <hr />
          <div>
            <label className="form-label">Backup semanal</label>
            <div className="form-check form-switch mb-2">
              <input className="form-check-input" type="checkbox" id="backupSemanalSwitch" checked={!!cfg.backupSemanalActivo} onChange={e=> setCfg({ ...cfg, backupSemanalActivo: e.target.checked })} />
              <label className="form-check-label" htmlFor="backupSemanalSwitch">Activar</label>
            </div>
            <div className="row g-2 align-items-end">
              <div className="col-6">
                <label>Día
                  <select className="form-select" value={cfg.backupSemanalDia ?? 1} onChange={e=> setCfg({ ...cfg, backupSemanalDia: parseInt(e.target.value, 10) })}>
                    <option value={0}>Domingo</option>
                    <option value={1}>Lunes</option>
                    <option value={2}>Martes</option>
                    <option value={3}>Miércoles</option>
                    <option value={4}>Jueves</option>
                    <option value={5}>Viernes</option>
                    <option value={6}>Sábado</option>
                  </select>
                </label>
              </div>
              <div className="col-6">
                <label>Hora
                  <input className="form-control" type="time" value={cfg.backupSemanalHora || '09:00'} onChange={e=> setCfg({ ...cfg, backupSemanalHora: e.target.value })} />
                </label>
              </div>
            </div>
            <small className="text-muted">Se guarda en la configuración para uso futuro. (No programado automáticamente aún)</small>
            <div className="mt-2">
              <button className="btn btn-outline-primary" onClick={save}>Guardar backup semanal</button>
            </div>
          </div>
            </div>
          </div>
        </div>
      </div>
      <div className="row g-2 mt-2">
        <div className="col-12">
          <div className="card">
            <div className="card-header">Mantenimiento</div>
            <div className="card-body" style={{ display:'grid', gap:8 }}>
          <p className="text-muted" style={{ margin:0 }}>Esta acción limpia la base: borra clientes, destinos, productos, ventas, gastos y usuarios. No borra la configuración.</p>
          <button className="btn btn-danger" onClick={resetDb}>Resetear base de datos</button>
        </div>
          </div>
        </div>
      </div>
      <div className="row g-2 mt-2">
        <div className="col-12 col-md-6">
          <div className="card h-100">
            <div className="card-header">Seguridad</div>
            <div className="card-body" style={{ display:'grid', gap:8 }}>
              <label>Contraseña de reset
                <input
                  className="form-control"
                  type="password"
                  placeholder="********"
                  value={companyPass}
                  onChange={e=> setCompanyPass(e.target.value)}
                />
              </label>
              <small className="text-muted">Se usa para confirmar el reseteo de la base. Guardala y mantenela privada.</small>
              <div>
                <button className="btn btn-outline-primary" onClick={saveCompanyPass}>Guardar contraseña</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}