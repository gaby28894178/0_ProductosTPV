import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiSettings } from 'react-icons/fi'
// Eliminamos navegación a Facturación; descarga directa del PDF
import api from '../api'
import ProductCapacityModal from '../components/ProductCapacityModal'
import { Pie } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
ChartJS.register(ArcElement, Tooltip, Legend)

export default function Dashboard(){
  const [period, setPeriod] = useState('day')
  const [data, setData] = useState({ totalVentas:0, totalGastos:0, ganancia:0, pagos:[], gastos:[] })
  const [cfg, setCfg] = useState({ capitalInicial:0, capitalExtra:0 })
  const [downloading, setDownloading] = useState(false)
  const [litrosCapacidad, setLitrosCapacidad] = useState([])
  const [allProducts, setAllProducts] = useState([])
  const [capModalOpen, setCapModalOpen] = useState(false)
  // Estado de tema para que los gráficos cambien colores al alternar claro/oscuro
  const [isDarkTheme, setIsDarkTheme] = useState(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('theme-dark')
    }
    return false
  })

  const load = async ()=>{
    const [res, cfgRes] = await Promise.all([
      api.get('/dashboard/summary', { params: { period } }),
      api.get('/config')
    ])
    setData(res.data)
    setCfg(cfgRes.data)
  }
  useEffect(()=>{ load() }, [period])

  // Cargar/recargar capacidad de litros por producto (resumen)
  const reloadCapacity = async ()=>{
    try{
      const res = await api.get('/production/capacity')
      setLitrosCapacidad(Array.isArray(res.data)?res.data:[])
    }catch{}
  }
  useEffect(()=>{ reloadCapacity() },[])

  // Cargar todos los productos para que los tabs incluyan también nuevos sin ventas ni mapeos
  useEffect(()=>{
    (async ()=>{
      try{
        const res = await api.get('/products')
        setAllProducts(Array.isArray(res.data)?res.data:[])
      }catch{}
    })()
  },[])

  // Observa cambios en la clase del <html> para detectar alternancia de tema
  useEffect(() => {
    if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return
    const el = document.documentElement
    const observer = new MutationObserver(() => {
      setIsDarkTheme(el.classList.contains('theme-dark'))
    })
    observer.observe(el, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  const descargarDashboardPdf = async ()=>{
    setDownloading(true)
    try{
      const pdf = await api.get(`/dashboard/invoice`, { params: { period }, responseType: 'blob' })
      const url = URL.createObjectURL(pdf.data)
      window.open(url, '_blank', 'noopener')
      setTimeout(()=> URL.revokeObjectURL(url), 60_000)
    }catch(e){ alert(e.response?.data?.error || e.message) } finally { setDownloading(false) }
  }

  const chartData = {
    labels: ['Ventas', 'Gastos', 'Ganancia'],
    datasets: [{ data: [data.totalVentas, data.totalGastos, Math.max(data.ganancia,0)], backgroundColor: ['#4fc3f7','#ef5350','#66bb6a'] }]
  }

  // Color de texto para gráficos: blanco en oscuro, negro en claro
  const textColor = isDarkTheme ? '#ffffff' : '#000000'

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    color: textColor,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: textColor }
      },
      tooltip: {
        titleColor: textColor,
        bodyColor: textColor,
        backgroundColor: isDarkTheme ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.95)',
        borderColor: isDarkTheme ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
        borderWidth: 1
      }
    }
  }

  const gananciaPositiva = data.ganancia >= 0
  const gananciaCardClass = gananciaPositiva ? 'border-success' : 'border-danger'
  const gananciaBadgeClass = gananciaPositiva ? 'bg-success' : 'bg-danger'
  const gananciaTextClass = gananciaPositiva ? 'text-success' : 'text-danger'

  // Capital invertido: % de gastos sobre capital total (inicial + extra)
  const capitalTotal = Number(cfg.capitalInicial||0) + Number(cfg.capitalExtra||0)
  const porcentajeInvertido = capitalTotal > 0 ? Math.min(100, Math.round((data.totalGastos / capitalTotal) * 100)) : 0

  const projection = data.projection || { nextDay:0, nextWeek:0, nextMonth:0 }
  const productCounts = Array.isArray(data.productCounts) ? data.productCounts : []
  // Índices auxiliares para tabs de productos
  const productIdsFromCapacity = Array.isArray(litrosCapacidad) ? Array.from(new Set(litrosCapacidad.map(c=> c.productId))) : []
  const productIdsFromAll = Array.isArray(allProducts) ? Array.from(new Set(allProducts.map(p=> p.id))) : []
  const allProductIds = Array.from(new Set([ ...productCounts.map(p=> p.productId), ...productIdsFromCapacity, ...productIdsFromAll ]))
  const productTabData = allProductIds.map(pid => {
    const pc = productCounts.find(p=> p.productId===pid)
    const caps = litrosCapacidad.filter(c=> c.productId===pid)
    const prod = allProducts.find(p=> p.id===pid)
    const suma = (arr, field) => arr.reduce((sum, x)=> sum + Math.trunc(Number(x[field]||0)), 0)
    const capacidadTotal = suma(caps, 'capacidadTotalLitros')
    const litrosCreados = suma(caps, 'litrosCreados')
    const litrosRestantes = Math.max(0, capacidadTotal - litrosCreados)
    const stockEmpaques = suma(caps, 'stockEmpaques')
    return {
      productId: pid,
      nombre: pc?.nombre || prod?.nombre || `#${pid}`,
      vendidosPeriodo: Math.trunc(Number(pc?.count||0)),
      ingresoPeriodo: Number(pc?.revenue||0),
      stockProducto: Math.trunc(Number((pc?.stock ?? prod?.stock)??0)),
      precioPublico: Number((pc?.precioPublico ?? prod?.precioPublico)??0),
      unidad: (prod?.unidad || 'litro'),
      capacidadTotal,
      litrosCreados,
      litrosRestantes,
      stockEmpaques,
      mappings: caps,
    }
  })
  const [activeProductId, setActiveProductId] = useState(null)
  useEffect(()=>{
    if (!activeProductId && productTabData.length>0) {
      setActiveProductId(productTabData[0].productId)
    }
  }, [productTabData.length])
  const maxProductCount = productCounts.reduce((m, p) => Math.max(m, Number(p.count||0)), 0)
  const countBadgeClass = (cnt) => {
    const c = Number(cnt||0)
    const r = maxProductCount > 0 ? c / maxProductCount : 0
    if (r >= 0.8) return 'badge bg-success'
    if (r >= 0.5) return 'badge bg-primary'
    if (r >= 0.3) return 'badge bg-warning text-dark'
    if (c > 0) return 'badge bg-secondary'
    return 'badge bg-light text-dark'
  }

  // Formato de moneda con puntos (miles) y coma (decimales)
  const fmtCurrency = (n) => new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n||0))
  // Formato entero para litros
  const fmtInt = (n) => Math.trunc(Number(n||0))

  // Total de sueldos (pagos a empleados) para liquidación
  const totalSueldos = Array.isArray(data.gastos)
    ? data.gastos.reduce((sum, g) => sum + (g.tipo === 'pago_empleado' ? Number(g.monto||0) : 0), 0)
    : 0

  // Desglose por categorías de uso (4 colores: rojo, amarillo, lila, naranja)
  const groupSums = { rojo:0, amarillo:0, lila:0, naranja:0 }
  data.gastos.forEach(g => {
    const t = g.tipo
    if (['gasto','consumos','varios','servicios'].includes(t)) groupSums.rojo += g.monto
    else if (['pago_proveedor','insumo_mayorista','insumo_minorista'].includes(t)) groupSums.amarillo += g.monto
    else if (['pago_empleado','electronicos_oficina','cobro_empleado'].includes(t)) groupSums.lila += g.monto
    else if (['construccion','vehiculo','herramientas','oficina'].includes(t)) groupSums.naranja += g.monto
    else groupSums.rojo += g.monto
  })

  const addCapital = async ()=>{
    const raw = prompt('Ingrese monto de capital a reingresar (ARS)', '0.00')
    if (raw===null) return
    const value = parseFloat(String(raw).replace(/[^0-9.\-]/g,''))
    if (!Number.isFinite(value) || value<=0) { alert('Monto inválido'); return }
    try { await api.post('/config/add-capital', { monto: value }); await load(); alert('Capital reingresado'); } catch(e){ alert(e.response?.data?.error || e.message) }
  }

  return (
    <div className="container py-2 page-dashboard">
      {/* Header con título a la izquierda y controles a la derecha */}
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h2 className="m-0 d-flex align-items-center">
          Dashboard
          <Link to="/config" className="ms-2 gear-btn" aria-label="Config" title="Config">
            <FiSettings size={36} aria-hidden="true" style={{ verticalAlign: 'text-bottom' }} />
          </Link>
        </h2>
        <div className="d-flex align-items-center gap-2">
          <select className="form-select form-select-sm" style={{ maxWidth: 160 }} value={period} onChange={e=>setPeriod(e.target.value)}>
            <option value="day">Día</option>
            <option value="week">Semana</option>
            <option value="month">Mes</option>
          </select>
          <button className="btn btn-sm btn-outline-secondary" onClick={addCapital}>Re ingresar capital</button>
          <button className="btn btn-sm btn-outline-primary" onClick={descargarDashboardPdf} disabled={downloading}>
            {downloading ? 'Descargando...' : 'Descargar PDF'}
          </button>
        </div>
      </div>

      {/* Capital a ancho completo (lado a lado) */}
      <div className="card border-secondary mb-2">
        <div className="card-header py-1 d-flex align-items-center gap-2">
          <Icon type="capital" className="text-secondary" />
          <small className="text-secondary fw-semibold">Capital</small>
        </div>
        <div className="card-body py-2">
          <div className="d-flex justify-content-between">
            <small className="text-secondary">Total: ${fmtCurrency(capitalTotal)}</small>
            <small className="text-secondary">Invertido: {porcentajeInvertido}%</small>
          </div>
          <div className="progress mt-2" style={{ height: 12 }}>
            <div className="progress-bar bg-secondary" role="progressbar" style={{ width: `${porcentajeInvertido}%` }} aria-valuenow={porcentajeInvertido} aria-valuemin="0" aria-valuemax="100"></div>
          </div>
        </div>
      </div>

      {/* Layout en dos columnas: izquierda liquidación y capital pequeño; derecha cards del dash */}
      <div className="row g-2 my-2 align-items-stretch">
        {/* Izquierda: Liquidación por arriba (a lo largo) */}
        <div className="col-12 col-md-5 d-flex">
          {/* Liquidación del período */}
          <div className="card h-100 w-100">
            <div className="card-header d-flex justify-content-between align-items-center">
              <span>Liquidación del período ({period==='day'?'día':period==='week'?'semana':'mes'})</span>
            </div>
            <div className="card-body">
              <div className="d-flex flex-column gap-1">
                <div className="border rounded-2 px-2 py-1 d-flex justify-content-between align-items-center">
                  <span className="fw-semibold d-flex align-items-center gap-1" style={{ color:'#6f42c1', fontSize:'0.9rem' }}>
                    <Icon type="sueldos" /> Sueldos
                  </span>
                  <span className="badge text-dark" style={{ background:'#d4b3ff', fontSize:'0.8rem' }}>${fmtCurrency(totalSueldos)}</span>
                </div>
                <div className="border rounded-2 px-2 py-1 d-flex justify-content-between align-items-center">
                  <span className="fw-semibold text-danger d-flex align-items-center gap-1" style={{ fontSize:'0.9rem' }}><Icon type="gastos" /> Gastos</span>
                  <span className="badge bg-danger" style={{ fontSize:'0.8rem' }}>${fmtCurrency(data.totalGastos)}</span>
                </div>
                <div className="border rounded-2 px-2 py-1 d-flex justify-content-between align-items-center">
                  <span className={`fw-semibold d-flex align-items-center gap-1 ${gananciaTextClass}`} style={{ fontSize:'0.9rem' }}><Icon type="ganancia" /> Ganancia</span>
                  <span className={`badge ${gananciaBadgeClass}`} style={{ fontSize:'0.8rem' }}>${fmtCurrency(data.ganancia)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Derecha: contenedor Dash con cards alineadas */}
        <div className="col-12 col-md-7 d-flex">
          <div className="card h-100 w-100">
            <div className="card-header">
              <span className="fw-semibold">Dash</span>
            </div>
            <div className="card-body">
              {/* Grilla uniforme para cards del Dash */}
              <div className="d-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                <div className="card border-primary h-100">
                  <div className="card-body py-1">
                    <div className="d-flex flex-column">
                      <span className="fw-semibold text-primary d-flex align-items-center gap-1"><Icon type="ventas" /> Ventas</span>
                      <span className="badge bg-primary mt-1 align-self-start">${fmtCurrency(data.totalVentas)}</span>
                    </div>
                  </div>
                </div>
                <div className="card border-danger h-100">
                  <div className="card-body py-1">
                    <div className="d-flex flex-column">
                      <span className="fw-semibold text-danger d-flex align-items-center gap-1"><Icon type="gastos" /> Gastos</span>
                      <span className="badge bg-danger mt-1 align-self-start">${fmtCurrency(data.totalGastos)}</span>
                    </div>
                  </div>
                </div>
                <div className={`card ${gananciaCardClass} h-100`}>
                  <div className="card-body py-1">
                    <div className="d-flex flex-column">
                      <span className={`fw-semibold ${gananciaTextClass} d-flex align-items-center gap-1`}><Icon type="ganancia" /> Ganancia</span>
                      <span className={`badge ${gananciaBadgeClass} mt-1 align-self-start`}>${fmtCurrency(data.ganancia)}</span>
                    </div>
                  </div>
                </div>
                {/* Proyección por período */}
                <div className="card border-warning h-100" style={{ gridColumn: '1 / -1' }}>
                  <div className="card-body py-1">
                    <div className="d-flex align-items-center gap-1">
                      <span className="fw-semibold text-warning d-flex align-items-center gap-1"><Icon type="proyeccion" /> Proyección</span>
                    </div>
                    <div className="mt-2 d-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                      <div className="d-flex flex-column align-items-center text-center">
                        <small className="text-warning">Día</small>
                        <span className="badge bg-warning text-dark mt-1" style={{ fontSize: '0.9rem' }}>${fmtCurrency(projection.nextDay)}</span>
                      </div>
                      <div className="d-flex flex-column align-items-center text-center">
                        <small className="text-warning">Semana</small>
                        <span className="badge bg-warning text-dark mt-1" style={{ fontSize: '0.9rem' }}>${fmtCurrency(projection.nextWeek)}</span>
                      </div>
                      <div className="d-flex flex-column align-items-center text-center">
                        <small className="text-warning">Mes</small>
                        <span className="badge bg-warning text-dark mt-1" style={{ fontSize: '0.9rem' }}>${fmtCurrency(projection.nextMonth)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Se movió la Liquidación a la columna izquierda superior */}
      {/* Tortas lado a lado, responsivas */}
      <div className="row g-2 mt-1">
        <div className="col-12 col-md-6">
          <div className="card">
            <div className="card-header">Ventas / Gastos / Ganancia</div>
            <div className="card-body">
              <div style={{ height: 240 }}>
                <Pie data={chartData} options={pieOptions} />
              </div>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-6">
          <div className="card">
            <div className="card-header">Gastos por categorías</div>
            <div className="card-body">
              <div style={{ height: 240 }}>
                <Pie data={{
                  labels: ['Operativos (Rojo)','Proveedores (Amarillo)','Personal (Lila)','Infraestructura (Naranja)'],
                  datasets: [{
                    data: [groupSums.rojo, groupSums.amarillo, groupSums.lila, groupSums.naranja],
                    backgroundColor: ['#dc3545','#ffc107','#6f42c1','#fd7e14']
                  }]
                }} options={pieOptions} />
              </div>
            </div>
          </div>
        </div>
      </div>
      <h3 className="mt-4">Pagos</h3>
      <table className="table table-sm table-striped table-hover">
        <thead>
          <tr><th>Fecha</th><th>Tipo</th><th>Descripción</th><th className="text-end">Monto</th></tr>
        </thead>
        <tbody>
          {data.pagos?.map(p => {
            const badgeClass = p.tipo==='pago_empleado' ? 'badge bg-info text-dark' : p.tipo==='pago_proveedor' ? 'badge bg-warning text-dark' : 'badge bg-secondary'
            const tipoLabel = p.tipo==='pago_empleado' ? 'empleado' : p.tipo==='pago_proveedor' ? 'proveedor' : 'cobro empleado'
            return (
              <tr key={p.id}>
                <td>{new Date(p.fecha).toLocaleString()}</td>
                <td><span className={badgeClass}>{tipoLabel}</span></td>
                <td>{p.descripcion}</td>
                <td className="text-end">${fmtCurrency(p.monto)}</td>
              </tr>
            )
          })}
          {(!data.pagos || data.pagos.length===0) && (
            <tr><td colSpan="4" className="text-center">No hay pagos en el período seleccionado</td></tr>
          )}
        </tbody>
      </table>

      <h3 className="mt-4">Gastos</h3>
      {/* Desglose por categorías de uso */}
      <div className="row g-2 mb-1">
        <div className="col-sm-6 col-md-3">
          <div className="card" style={{ borderColor:'#dc3545' }}>
            <div className="card-body py-2">
              <span className="badge" style={{ background:'#dc3545' }}>Rojo (operativos)</span>
              <div className="text-end fw-semibold">${fmtCurrency(groupSums.rojo)}</div>
            </div>
          </div>
        </div>
        <div className="col-sm-6 col-md-3">
          <div className="card" style={{ borderColor:'#ffc107' }}>
            <div className="card-body py-2">
              <span className="badge text-dark" style={{ background:'#ffc107' }}>Amarillo (proveedores)</span>
              <div className="text-end fw-semibold">${fmtCurrency(groupSums.amarillo)}</div>
            </div>
          </div>
        </div>
        <div className="col-sm-6 col-md-3">
          <div className="card" style={{ borderColor:'#6f42c1' }}>
            <div className="card-body py-2">
              <span className="badge" style={{ background:'#6f42c1' }}>Lila (personal)</span>
              <div className="text-end fw-semibold">${fmtCurrency(groupSums.lila)}</div>
            </div>
          </div>
        </div>
        <div className="col-sm-6 col-md-3">
          <div className="card" style={{ borderColor:'#fd7e14' }}>
            <div className="card-body py-2">
              <span className="badge" style={{ background:'#fd7e14' }}>Naranja (infraestructura)</span>
              <div className="text-end fw-semibold">${fmtCurrency(groupSums.naranja)}</div>
            </div>
          </div>
        </div>
      </div>
      <table className="table table-sm table-hover">
        <thead>
          <tr><th>Fecha</th><th>Tipo</th><th>Descripción</th><th className="text-end">Monto</th></tr>
        </thead>
        <tbody>
          {data.gastos?.map(g => {
            const rowClass = g.tipo==='gasto' ? 'table-danger' : g.tipo==='pago_proveedor' ? 'table-warning' : g.tipo==='pago_empleado' ? 'table-info' : 'table-secondary'
            const badgeClass = g.tipo==='gasto' ? 'badge bg-danger' : g.tipo==='pago_proveedor' ? 'badge bg-warning text-dark' : g.tipo==='pago_empleado' ? 'badge bg-info text-dark' : 'badge bg-secondary'
            const tipoLabel = g.tipo==='gasto' ? 'Gasto' : g.tipo==='pago_proveedor' ? 'Pago proveedor' : g.tipo==='pago_empleado' ? 'Pago empleado' : 'Cobro empleado'
            return (
              <tr key={g.id} className={rowClass}>
                <td>{new Date(g.fecha).toLocaleString()}</td>
                <td><span className={badgeClass}>{tipoLabel}</span></td>
                <td>{g.descripcion}</td>
                <td className="text-end">${fmtCurrency(g.monto)}</td>
              </tr>
            )
          })}
          {(!data.gastos || data.gastos.length===0) && (
            <tr><td colSpan="4" className="text-center">No hay gastos en el período seleccionado</td></tr>
          )}
        </tbody>
      </table>

      {/* Top productos por conteo */}
      <h3 className="mt-4">Top productos por conteo</h3>
      <div className="table-responsive">
        <table className="table table-sm table-hover">
          <thead>
            <tr>
              <th>Producto</th>
              <th className="text-end">Unidades</th>
              <th className="text-end">Ingreso</th>
              <th className="text-end">Stock restante</th>
              <th className="text-end">Precio unidad</th>
            </tr>
          </thead>
          <tbody>
            {productCounts.map(p => (
              <tr key={p.productId}>
                <td>{p.nombre}</td>
                <td className="text-end"><span className={countBadgeClass(p.count)}>{p.count}</span></td>
                <td className="text-end">${fmtCurrency(Number(p.revenue||0))}</td>
                <td className="text-end">{Math.trunc(Number(p.stock ?? 0))}</td>
                <td className="text-end">${fmtCurrency(Number(p.precioPublico ?? 0))}</td>
              </tr>
            ))}
            {productCounts.length===0 && (
              <tr><td colSpan="5" className="text-center">No hay ventas en el período</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <h3 className="mt-4">Capacidad de litros restante</h3>
      <div className="table-responsive">
        <table className="table table-sm table-hover">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Materia prima</th>
              <th className="text-end">Total (L)</th>
              <th className="text-end">Creado (L)</th>
              <th className="text-end">Restante (L)</th>
            </tr>
          </thead>
          <tbody>
            {litrosCapacidad.map(c => (
              <tr key={`${c.productId}_${c.materiaPrimaId}`}>
                <td>{productCounts.find(p=>p.productId===c.productId)?.nombre || `#${c.productId}`}</td>
                <td>{c.materiaPrimaNombre}</td>
                <td className="text-end">{fmtInt(c.capacidadTotalLitros)}</td>
                <td className="text-end">{fmtInt(c.litrosCreados)}</td>
                <td className="text-end">{fmtInt(c.litrosRestantes)}</td>
              </tr>
            ))}
            {litrosCapacidad.length===0 && (
              <tr><td colSpan="5" className="text-center">Sin mapeos configurados aún</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Tabs de rendimiento por producto: ventas, stock, producible con materia prima */}
      <h3 className="mt-4">Rendición por producto</h3>
      {productTabData.length===0 ? (
        <div className="text-muted">No hay datos de ventas ni capacidad.</div>
      ) : (
        <div className="card">
          <div className="card-header d-flex flex-wrap" style={{ gap:8 }}>
            {productTabData.map(pt => (
              <button
                key={pt.productId}
                className={`btn btn-sm ${activeProductId===pt.productId?'btn-primary':'btn-outline-primary'}`}
                onClick={()=> setActiveProductId(pt.productId)}
              >{pt.nombre}</button>
            ))}
          </div>
          <div className="card-body">
            {productTabData.filter(pt=> pt.productId===activeProductId).map(pt => (
              <div key={pt.productId}>
                <div className="d-grid" style={{ gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:8 }}>
                  <div className="card border-primary">
                    <div className="card-body py-2">
                      <span className="fw-semibold text-primary">Vendidos (período)</span>
                      <div className="display-6" style={{ fontSize:'1.6rem' }}>{pt.vendidosPeriodo}</div>
                      <small className="text-muted">Ingreso: ${fmtCurrency(pt.ingresoPeriodo)}</small>
                    </div>
                  </div>
                  <div className="card border-secondary">
                    <div className="card-body py-2">
                      <span className="fw-semibold text-secondary">Stock actual (producto)</span>
                      <div className="display-6" style={{ fontSize:'1.6rem' }}>{pt.stockProducto}</div>
                      <small className="text-muted">Precio público: ${fmtCurrency(pt.precioPublico)}</small>
                      <small className="text-muted">Faltan para llegar a cero: {pt.stockProducto}</small>
                    </div>
                  </div>
                  <div className="card border-success">
                    <div className="card-body py-2">
                      <span className="fw-semibold text-success">Producible con materia prima</span>
                      <div className="display-6" style={{ fontSize:'1.6rem' }}>{new Intl.NumberFormat('es-ES').format(pt.litrosRestantes)} {pt.unidad==='kilo' ? 'Kg' : 'L'}</div>
                      <small className="text-muted">Total mapeado: {new Intl.NumberFormat('es-ES').format(pt.capacidadTotal)} {pt.unidad==='kilo' ? 'Kg' : 'L'}</small>
                    </div>
                  </div>
                  <div className="card border-info">
                    <div className="card-body py-2">
                      <span className="fw-semibold text-info">Materia prima (disponible)</span>
                      <div className="display-6" style={{ fontSize:'1.6rem' }}>{new Intl.NumberFormat('es-ES').format(pt.capacidadTotal)} {pt.unidad==='kilo' ? 'Kg' : 'L'}</div>
                      <small className="text-muted">Empaques: {new Intl.NumberFormat('es-ES').format(pt.stockEmpaques)}</small>
                      
                    </div>
                  </div>
                </div>
                <div className="d-flex justify-content-end my-2" style={{ gap:8 }}>
                  <button className="btn btn-sm btn-outline-secondary" onClick={()=> setCapModalOpen(true)}>Gestionar materia prima (crear/eliminar mapeos)</button>
                  <button className="btn btn-sm btn-outline-primary" onClick={reloadCapacity}>Refrescar capacidad</button>
                </div>
                {/* Detalle por materia prima mapeada */}
                <div className="table-responsive mt-2">
                  <table className="table table-sm table-hover">
                    <thead>
                      <tr>
                        <th>Materia prima</th>
                        <th className="text-end">Empaques</th>
                        <th className="text-end">Total ({pt.unidad==='kilo' ? 'Kg' : 'L'})</th>
                        <th className="text-end">Creado ({pt.unidad==='kilo' ? 'Kg' : 'L'})</th>
                        <th className="text-end">Restante ({pt.unidad==='kilo' ? 'Kg' : 'L'})</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pt.mappings.map(m => (
                        <tr key={`${m.productId}_${m.materiaPrimaId}`}>
                          <td>{m.materiaPrimaNombre}</td>
                          <td className="text-end">{Math.trunc(Number(m.stockEmpaques||0))}</td>
                          <td className="text-end">{new Intl.NumberFormat('es-ES').format(Math.trunc(Number(m.capacidadTotalLitros||0)))}</td>
                          <td className="text-end">{new Intl.NumberFormat('es-ES').format(Math.trunc(Number(m.litrosCreados||0)))}</td>
                          <td className="text-end">{new Intl.NumberFormat('es-ES').format(Math.trunc(Number(m.litrosRestantes||0)))}</td>
                        </tr>
                      ))}
                      {pt.mappings.length===0 && (
                        <tr><td colSpan="5" className="text-center text-muted">Sin mapeos</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {capModalOpen && (
        (()=>{
          const prod = allProducts.find(p=> p.id===activeProductId)
          if (!prod) return null
          return (
            <ProductCapacityModal product={prod} onClose={()=> { setCapModalOpen(false); reloadCapacity() }} />
          )
        })()
      )}
    </div>
  )
}
  // Íconos simples inline para las cards
  const Icon = ({ type, className }) => {
    const props = { width: 18, height: 18, viewBox:'0 0 24 24', fill:'currentColor', className }
    if (type==='ventas') return (<svg {...props}><path d="M3 13h18v2H3zM3 17h18v2H3zM3 9h18v2H3zM3 5h18v2H3z"/></svg>)
    if (type==='gastos') return (<svg {...props}><path d="M12 1l3 5 6 1-4 4 1 6-6-3-6 3 1-6-4-4 6-1z"/></svg>)
    if (type==='ganancia') return (<svg {...props}><path d="M12 3a9 9 0 100 18 9 9 0 000-18zm1 5v3h3v2h-3v3h-2v-3H8v-2h3V8h2z"/></svg>)
    if (type==='proyeccion') return (<svg {...props}><path d="M19 3H5a2 2 0 00-2 2v14l4-4h12a2 2 0 002-2V5a2 2 0 00-2-2z"/></svg>)
    if (type==='capital') return (<svg {...props}><path d="M12 4l8 4v6c0 3.87-3.13 7-7 7s-7-3.13-7-7V8l6-4z"/></svg>)
    if (type==='sueldos') return (<svg {...props}><path d="M12 12c2.21 0 4-1.79 4-4S14.21 4 12 4 8 5.79 8 8s1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>)
    return null
  }