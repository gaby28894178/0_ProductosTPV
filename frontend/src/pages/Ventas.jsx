import { useEffect, useState, useMemo } from 'react'
import api from '../api'
import { swalError, swalSuccess, swalInfo, swalPromptNumber } from '../components/swal'
import SaleCustomerModal from '../components/SaleCustomerModal'
import styles from '../styles/modules/Ventas/Ventas.module.css'

export default function Ventas(){
  const [products, setProducts] = useState([])
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState([])
  const [sale, setSale] = useState(null)
  const [invoiceUrl, setInvoiceUrl] = useState('')
  const [error, setError] = useState('')
  const [billToText, setBillToText] = useState('')
  const [shipToText, setShipToText] = useState('')
  const [showModal, setShowModal] = useState(false)
  // Picker de productos con F10
  const [showPicker, setShowPicker] = useState(false)
  const [pickerIndex, setPickerIndex] = useState(0)
  const [cliente, setCliente] = useState({ nombre:'', direccion:'', ciudad:'', telefono:'', documento:'' })
  const [destino, setDestino] = useState({ nombre:'', direccion:'', ciudad:'', contacto:'', telefono:'' })
  // IDs asociados para editar en vez de duplicar
  const [clienteId, setClienteId] = useState(null)
  const [destinoId, setDestinoId] = useState(null)
  // Picker de clientes/destinos existentes
  const [showExistingPicker, setShowExistingPicker] = useState(false)
  const [customers, setCustomers] = useState([])
  const [customerQuery, setCustomerQuery] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState(null)
  // Destinos ya no se seleccionan desde Ventas; se mantiene sólo cliente
  const [destinations, setDestinations] = useState([])
  const [selectedDestinationId, setSelectedDestinationId] = useState(null)
  // IVA toggle
  const [conIva, setConIva] = useState(true)
  const [ivaPct, setIvaPct] = useState(21)
  const backendBase = useMemo(() => {
    const base = (api.defaults?.baseURL || '')
    return base.replace(/\/+$/, '').replace(/\/api\/?$/, '') || 'http://localhost:4000'
  }, [])

  // Mostrar unidad de venta según corresponda: por litro o por kilo
  const ventaTexto = (unidad)=> String(unidad||'').toLowerCase()==='litro' ? 'por litro' : 'por kilo'

  // Mayor stock disponible para resaltar en la UI
  const maxAvailable = useMemo(()=> {
    return products.reduce((m,p)=> Math.max(m, Math.trunc(Number(p?.stock||0))), 0)
  }, [products])

  // Tipo de material para visual (líquido / seco / pasta)
  const tipoMaterial = (p)=> {
    const unidad = String(p?.unidad||'').toLowerCase()
    if (unidad === 'litro') return 'líquido'
    const nombre = String(p?.nombre||'').toLowerCase()
    return nombre.includes('pasta') ? 'pasta' : 'seco'
  }

  // Intentar detectar capacidad de envase desde el nombre (e.g., "10Kg" / "5L")
  const envaseTextoDet = (p)=> {
    const n = String(p?.nombre||'').toLowerCase()
    const ml = n.match(/(\d+)\s*l\b/)
    const kg = n.match(/(\d+)\s*kg\b/)
    if (ml) return `${ml[1]} L`
    if (kg) return `${kg[1]} Kg`
    const unidad = String(p?.unidad||'').toLowerCase()
    return unidad === 'litro' ? '1 L' : 'Kg'
  }

  // Manejo de teclado para el modal de selector de productos:
  // - F10: abre el modal y posiciona el índice en el primer producto
  // - Escape: cierra el modal cuando está abierto
  // - Flechas: navegan por la lista
  // - Enter: agrega el producto seleccionado al carrito (si no está escribiendo en un input)

  const load = async ()=>{
    // Mostrar sólo productos vendibles (no mayoristas)
    const res = await api.get('/products?includeMayorista=false')
    const rows = Array.isArray(res.data) ? res.data.filter(p=> !p.esMayorista) : []
    setProducts(rows)
  }
  useEffect(()=>{ load() },[])

  // Importar carrito desde Presupuesto si existe (transferencia sin descontar antes)
  useEffect(()=>{
    try{
      const raw = localStorage.getItem('budgetCart')
      if (raw) {
        const items = JSON.parse(raw)
        if (Array.isArray(items)) setCart(items.map(c=> ({
          productId: c.productId,
          name: c.name,
          price: Number(c.price||0),
          quantity: Math.trunc(Number(c.quantity||1))
        })))
        localStorage.removeItem('budgetCart')
      }
    }catch{}
  },[])

  // Cargar clientes cuando se abre el selector de existentes
  useEffect(()=>{
    const loadExisting = async ()=>{
      try {
        const cs = await api.get('/customers')
        setCustomers(cs.data || [])
      } catch (e) {
        console.error('Error cargando clientes:', e)
        swalError(e.response?.data?.error || e.message, 'Carga de clientes')
      }
    }
    if (showExistingPicker) loadExisting()
  }, [showExistingPicker])


  // Atajar tecla F10 para abrir selector y navegación por teclado
  useEffect(()=>{
    const onKey = (e)=>{
      // Evitar interferir cuando se escribe en inputs/textarea
      const tag = (e.target && e.target.tagName) || ''
      const editable = ['INPUT','TEXTAREA','SELECT'].includes(tag)
      if (e.key === 'F10') {
        e.preventDefault()
        setShowPicker(true)
        setPickerIndex(0)
        return
      }
      if (showPicker) {
        if (e.key === 'Escape') { e.preventDefault(); setShowPicker(false); return }
        if (e.key === 'ArrowDown') { e.preventDefault(); setPickerIndex(i=> Math.min(products.length-1, i+1)); return }
        if (e.key === 'ArrowUp') { e.preventDefault(); setPickerIndex(i=> Math.max(0, i-1)); return }
        if (e.key === 'Enter' && !editable) {
          e.preventDefault()
          const p = products[pickerIndex]
          if (p) addToCart(p, 1)
          return
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return ()=> window.removeEventListener('keydown', onKey)
  }, [showPicker, products, pickerIndex])

  const addToCart = (p, qty = 1)=>{
    const qtyInt = Math.trunc(Number(qty||0))
    if (!qtyInt || qtyInt<=0) return
    // El estado de productos ya refleja el stock restante (se descuenta al agregar)
    const remaining = Math.trunc(Number(p.stock||0))
    if (remaining <= 0) { swalError(`Sin stock para ${(p.nombreBoleta || p.nombre)}. Disponible: 0`, 'Stock'); return }
    if (qtyInt > remaining) { swalError(`Stock insuficiente para ${(p.nombreBoleta || p.nombre)}. Disponible: ${remaining}`, 'Stock'); return }
    setCart(prev=>{
      const existing = prev.find(i=>i.productId===p.id)
      if(existing){ return prev.map(i=> i.productId===p.id ? { ...i, quantity: i.quantity + qtyInt } : i ) }
      return [...prev, { productId: p.id, quantity: qtyInt, name:(p.nombreBoleta || p.nombre), price:p.precioPublico }]
    })
    // Descuento visual del stock (optimista) por la cantidad agregada
    setProducts(prev => prev.map(x => x.id===p.id ? { ...x, stock: Math.max(0, Math.trunc(Number(x.stock||0)) - qtyInt) } : x))
  }

  const incItem = (productId)=>{
    const p = products.find(x=>x.id===productId)
    if (!p) return
    addToCart(p, 1)
  }
  const decItem = (productId)=>{
    setCart(prev=> prev.map(i=> i.productId===productId ? { ...i, quantity: Math.max(0, i.quantity-1) } : i ).filter(i=> i.quantity>0))
    // Devolver stock visualmente al decrementar
    setProducts(prev => prev.map(x => x.id===productId ? { ...x, stock: Math.trunc(Number(x.stock||0)) + 1 } : x))
  }
  const removeItem = (productId)=>{
    setCart(prev=> {
      const item = prev.find(i=> i.productId===productId)
      const qty = item ? item.quantity : 0
      // Devolver stock por la cantidad removida
      setProducts(old => old.map(x => x.id===productId ? { ...x, stock: Math.trunc(Number(x.stock||0)) + qty } : x))
      return prev.filter(i=> i.productId!==productId)
    })
  }

  const total = cart.reduce((a,b)=> a + b.price*b.quantity, 0)
  const totalConIva = conIva ? +(total * (1 + (Number(ivaPct||0)/100))).toFixed(2) : total

  const submitSale = async ()=>{
    setError('')
    try{
      const res = await api.post('/sales', { items: cart.map(c=>({ productId:c.productId, quantity:c.quantity })) })
      setSale(res.data)
      // refrescar productos para que el stock se actualice en la tabla
      await load()
      // cargar factura protegida con token y mostrarla en iframe
      try {
        // Fallback: si no hay texto preparado, armar desde estado de cliente/destino
        const parseLines = (txt)=> String(txt||'').split('\n').map(s=>s.trim()).filter(Boolean).slice(0,6)
        const billLinesFromText = parseLines(billToText)
        const shipLinesFromText = parseLines(shipToText)
        const billLines = billLinesFromText.length ? billLinesFromText : [
          cliente.nombre ? `Nombre: ${cliente.nombre}` : null,
          cliente.direccion ? `Dirección: ${cliente.direccion}` : null,
          cliente.ciudad ? `Localidad/Partido: ${cliente.ciudad}` : null,
          cliente.telefono ? `Teléfono: ${cliente.telefono}` : null,
          cliente.documento ? `CUIT/DNI: ${cliente.documento}` : null
        ].filter(Boolean).slice(0,6)
        const shipLines = shipLinesFromText.length ? shipLinesFromText : [
          destino.nombre, destino.direccion, destino.ciudad, destino.contacto,
          destino.telefono ? `Tel: ${destino.telefono}` : null
        ].filter(Boolean).slice(0,6)
        const pdf = await api.get(`/sales/${res.data.saleId}/invoice`, { responseType: 'blob', params: {
          bill_to: billLines.length ? billLines.join('|') : undefined,
          ship_to: shipLines.length ? shipLines.join('|') : undefined,
          iva: conIva ? 'si' : 'no',
          iva_pct: conIva ? Number(ivaPct||0) : undefined,
        } })
        const url = URL.createObjectURL(pdf.data)
        setInvoiceUrl(url)
      } catch (err) {
        // si falla, mostramos el error pero no rompemos la venta
        console.error('Error cargando factura:', err)
      }
      setCart([])
      setBillToText('')
      setShipToText('')
    }catch(e){
      const msg = e.response?.data?.error || e.message
      // Mostrar alerta cuando no hay stock o cualquier error de la venta
      swalError(msg, 'Venta fallida')
      setError(msg)
    }
  }

  useEffect(()=>{
    return ()=>{ if (invoiceUrl) URL.revokeObjectURL(invoiceUrl) }
  }, [invoiceUrl])

  // Cargar configuración de empresa para tomar el IVA desde assets/company.json
  useEffect(()=>{
    (async ()=>{
      try{
        const res = await fetch(`${backendBase}/assets/company.json`)
        if (!res.ok) return
        const cfg = await res.json()
        const pct = Number(cfg?.tax_rate)
        // Solo aplicar si es un porcentaje positivo; si es 0/invalid, mantener el default (21)
        if (Number.isFinite(pct) && pct > 0 && pct <= 100) setIvaPct(pct)
      }catch{}
    })()
  }, [backendBase])

  // Detectar tema actual y cambios (oscuro/claro) para ajustar colores de la UI
  const [isDarkTheme, setIsDarkTheme] = useState(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('theme-dark')
    }
    return false
  })
  useEffect(() => {
    if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return
    const el = document.documentElement
    const observer = new MutationObserver(() => {
      setIsDarkTheme(el.classList.contains('theme-dark'))
    })
    observer.observe(el, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])


  return (
    <div className="container-fluid py-0 page-ventas" style={{ marginTop: '6px' }}>
      {/* Encabezado y búsqueda en la misma fila */}
      <div className="row align-items-center g-2 mb-1">
        <div className="col-auto">
          <h2 className="mb-0">Ventas </h2>
         <span style={{ color: isDarkTheme ? '#ffffff' : '#f51111' }}>Buscar Productos</span>
        </div>
        <div className="col d-flex align-items-center">
          <div className="input-group input-group-sm align-items-center">
            <span className="input-group-text">🔍</span>
            <input
              type="text"
              className="form-control"
              placeholder="Buscar productos..."
              value={query}
              onChange={e=> setQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Tabla de productos */}
      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title mb-0">Productos Disponibles</h5>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-striped table-hover mb-0">
                  <thead className="table-dark">
                    <tr>
                      <th width="40%">Producto</th>
                      <th width="15%">Venta</th>
                      <th width="15%">Precio público</th>
                      <th width="15%">Stock</th>
                      <th width="15%">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(products.filter(p=>{
                      const q = String(query||'').trim().toLowerCase()
                      if (!q) return true
                      const nombre = String(p.nombreBoleta || p.nombre || '').toLowerCase()
                      const marca = String(p.marca||'').toLowerCase()
                      const unidad = String(p.unidad||'').toLowerCase()
                      return nombre.includes(q) || marca.includes(q) || unidad.includes(q)
                    })).map(p=> (
                      <tr key={p.id}>
                        <td>
                          <div className="d-flex align-items-center" style={{gap:'12px'}}>
                            {p.imagenUrl ? (
                              <img
                                src={p.imagenUrl}
                                alt={p.nombreBoleta || p.nombre}
                                width={48}
                                height={48}
                                className="rounded border"
                                style={{objectFit:'cover'}}
                                onError={(e)=>{ e.currentTarget.style.display='none' }}
                              />
                            ) : (
                              <div className="rounded border d-flex align-items-center justify-content-center" 
                                   style={{width:48, height:48, backgroundColor: 'var(--bs-secondary-bg)'}}>
                                <small className="text-muted">Sin img</small>
                              </div>
                            )}
                            <div>
                              <div className="fw-semibold">{p.nombreBoleta || p.nombre}</div>
                              <small className="text-muted">
                                {p.marca ? `${p.marca} • ` : ''}{ventaTexto(p.unidad)} • Tipo: {tipoMaterial(p)} • Envase: {envaseTextoDet(p)}
                              </small>
                            </div>
                          </div>
                        </td>
                        <td className="align-middle">
                          <div>{ventaTexto(p.unidad)}</div>
                          <small className="text-muted">Tipo: {tipoMaterial(p)} • Envase: {envaseTextoDet(p)}</small>
                        </td>
                        <td className="align-middle">${p.precioPublico}</td>
                        <td className="align-middle">
                          <span className={`badge ${Number(p.stock) > 0 ? 'bg-success' : 'bg-danger'}`}>
                            {Math.trunc(Number(p.stock||0))}
                          </span>
                          {Math.trunc(Number(p.stock||0)) === maxAvailable && Math.trunc(Number(p.stock||0))>0 && (
                            <span className="badge bg-primary ms-2">Mayor stock</span>
                          )}
                        </td>
                        <td className="align-middle">
                          <div className="btn-group btn-group-sm" role="group">
                            <button className="btn btn-primary" onClick={()=> addToCart(p, 1)}>
                              Agregar
                            </button>
                            <button className="btn btn-outline-secondary" onClick={async ()=>{
                              const nuevo = await swalPromptNumber({ 
                                title: `Nuevo stock para ${p.nombre}`, 
                                defaultValue: String(Math.trunc(Number(p.stock||0))), 
                                integerOnly: true, 
                                min: 0 
                              })
                              if (nuevo !== null && Number.isFinite(nuevo)) {
                                try { 
                                  await api.put(`/products/${p.id}`, { stock: nuevo }); 
                                  await load() 
                                }
                                catch(err){ 
                                  swalError(err.response?.data?.error || err.message, 'Actualizar stock') 
                                }
                              }
                            }}>
                              Editar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Carrito */}
      <div className="row mt-4">
        <div className="col-12">
          <div className="card">
            <div className="card-header bg-secondary text-white d-flex justify-content-between align-items-center">
              <strong>Carrito de Ventas</strong>
              <div className="d-flex align-items-center flex-wrap gap-2">
                <button className="btn btn-sm btn-light" onClick={()=> setShowModal(true)}>
                  <i className="bi bi-person-plus me-1"></i>Datos de cliente
                </button>
                <button className="btn btn-sm btn-warning text-white" onClick={()=> setShowExistingPicker(true)}>
                  <i className="bi bi-people me-1"></i>Seleccionar existente
                </button>
                <div className="form-check form-switch ms-2">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="chkConIva"
                    checked={conIva}
                    onChange={e=> setConIva(e.target.checked)}
                    style={{ backgroundColor: conIva ? '#198754' : '#dc3545', borderColor: conIva ? '#198754' : '#dc3545' }}
                  />
                  <label className="form-check-label text-white" htmlFor="chkConIva">
                    {conIva ? `Con IVA ${Number(ivaPct||0)}%` : 'Sin IVA'}
                  </label>
                </div>
              </div>
            </div>
            <div className="card-body p-0">
              {cart.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <i className="bi bi-cart-x display-4 d-block mb-2"></i>
                  No hay items en el carrito
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead className="table-secondary">
                      <tr>
                        <th width="40%">Producto</th>
                        <th width="12%" className="text-end">Precio Unit.</th>
                        <th width="12%" className="text-center">Cantidad</th>
                        <th width="12%" className="text-end">Subtotal</th>
                        <th width="24%" className="text-end">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cart.map(c=> {
                        const p = products.find(x=> x.id===c.productId)
                        return (
                          <tr key={c.productId}>
                            <td>
                              <div className="d-flex align-items-center" style={{gap:'12px'}}>
                                {p?.imagenUrl ? (
                                  <img 
                                    src={p.imagenUrl} 
                                    alt={c.name} 
                                    width={42} 
                                    height={42}
                                    className="rounded border"
                                    style={{objectFit:'cover'}}
                                    onError={(e)=>{ e.currentTarget.style.display='none' }} 
                                  />
                                ) : (
                                  <div className="rounded border d-flex align-items-center justify-content-center" 
                                       style={{width:42, height:42, backgroundColor: 'var(--bs-secondary-bg)'}}>
                                    <small className="text-muted">Sin img</small>
                                  </div>
                                )}
                                <div>
                                  <div className="fw-semibold">{c.name}</div>
                                  <small className="text-muted">
                                    {p ? `${p.marca ? p.marca+' • ' : ''}${ventaTexto(p.unidad)}` : ''}
                                  </small>
                                </div>
                              </div>
                            </td>
                            <td className="text-end align-middle">${c.price.toFixed(2)}</td>
                            <td className="text-center align-middle">
                              <span className="badge bg-primary fs-6">{c.quantity}</span>
                            </td>
                            <td className="text-end align-middle fw-bold">${(c.price*c.quantity).toFixed(2)}</td>
                            <td className="text-end align-middle">
                              <div className="btn-group" role="group">
                                <button className="btn btn-success px-3 py-1" title="Sumar 1" aria-label="Sumar 1" onClick={()=> incItem(c.productId)}>
                                  <i className="bi bi-plus-lg me-1"></i>
                                  <span>Sumar</span>
                                </button>
                                <button className="btn btn-warning text-white px-3 py-1" title="Restar 1" aria-label="Restar 1" onClick={()=> decItem(c.productId)}>
                                  <i className="bi bi-dash-lg me-1"></i>
                                  <span>Restar</span>
                                </button>
                                <button className="btn btn-danger px-3 py-1" title="Quitar" aria-label="Quitar" onClick={()=> removeItem(c.productId)}>
                                  <i className="bi bi-trash me-1"></i>
                                  <span>Quitar</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="card-footer">
              <div className="row align-items-center">
                <div className="col d-flex align-items-center flex-wrap gap-2">
                  <span className="badge fs-6 me-1" style={{ backgroundColor: '#dc3545', color: '#fff' }}>Subtotal: ${ total.toFixed(2) }</span>
                  {conIva ? (
                    <span className="badge fs-6 me-1" style={{ backgroundColor: '#ffc107', color: '#fff' }}>IVA {Number(ivaPct||0)}%: ${ (+(total * (Number(ivaPct||0)/100)).toFixed(2)).toFixed(2) }</span>
                  ) : (
                    <span className="badge fs-6 me-1" style={{ backgroundColor: '#dc3545', color: '#fff' }}>IVA: Exento</span>
                  )}
                  <span className="badge fs-6" style={{ backgroundColor: '#198754', color: '#fff' }}>Total: ${ totalConIva.toFixed(2) }</span>
                </div>
                <div className="col text-end">
                  <button className="btn btn-success btn-lg" disabled={cart.length===0} onClick={submitSale}>
                    <i className="bi bi-check-circle me-2"></i>Confirmar Venta
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="row mt-3">
          <div className="col-12">
            <div className="alert alert-danger alert-dismissible fade show" role="alert">
              <strong>Error:</strong> {error}
              <button type="button" className="btn-close" onClick={() => setError('')}></button>
            </div>
          </div>
        </div>
      )}

      {sale && (
        <div className="row mt-3">
          <div className="col-12">
            <div className="alert alert-success alert-dismissible fade show" role="alert">
              <strong>¡Venta creada exitosamente!</strong>
              <div className="mt-2">
                {invoiceUrl ? (
                  <a className="btn btn-outline-primary" href={invoiceUrl} target="_blank" rel="noreferrer">
                    <i className="bi bi-file-earmark-pdf me-2"></i>Abrir factura PDF
                  </a>
                ) : (
                  <span className="text-muted">Cargando factura…</span>
                )}
              </div>
              <button type="button" className="btn-close" onClick={() => setSale(null)}></button>
            </div>
          </div>
        </div>
      )}

      <SaleCustomerModal
        visible={showModal}
        onClose={()=> setShowModal(false)}
        cliente={cliente}
        setCliente={setCliente}
        destino={destino}
        setDestino={setDestino}
        customers={customers}
        setCustomers={setCustomers}
        clienteId={clienteId}
        setClienteId={setClienteId}
        destinations={destinations}
        setDestinations={setDestinations}
        setDestinoId={setDestinoId}
        setBillToText={setBillToText}
        setShipToText={setShipToText}
      />

      {/* Modal selector de productos (F10) */}
      {showPicker && (
        <div className={styles.overlay}>
          <div className="modal-dialog modal-lg">
            <div className={"modal-content " + styles.modalContent}>
              <div className="modal-header">
                <h5 className="modal-title">Seleccionar producto</h5>
                <button type="button" className="btn-close" onClick={()=> setShowPicker(false)}></button>
              </div>
              <div className={"modal-body " + styles.modalBodyScrollable}>
                <div className="row g-2">
                  {products.map((p, idx)=> (
                    <div key={p.id} className="col-12">
                      <div 
                        className={`card ${idx===pickerIndex ? 'border-primary bg-primary text-white' : ''}`}
                        style={{cursor: 'pointer', transition: 'all 0.2s'}}
                        onMouseEnter={()=> setPickerIndex(idx)}
                        onDoubleClick={()=> addToCart(p, 1)}
                      >
                        <div className="card-body py-2">
                          <div className="row align-items-center">
                            <div className="col-auto">
                              {p.imagenUrl ? (
                                <img
                                  src={p.imagenUrl}
                                  alt={p.nombre}
                                  width={50}
                                  height={50}
                                  className="rounded"
                                  style={{objectFit:'cover'}}
                                  onError={(e)=>{ e.currentTarget.style.display='none' }}
                                />
                              ) : (
                                <div className="rounded bg-secondary d-flex align-items-center justify-content-center" 
                                     style={{width:50, height:50}}>
                                  <small className={idx===pickerIndex ? 'text-white' : 'text-muted'}>Sin img</small>
                                </div>
                              )}
                            </div>
                            <div className="col">
                              <div className="fw-bold">{p.nombre}</div>
                              <small className={idx===pickerIndex ? 'text-white-50' : 'text-muted'}>
                                {p.marca ? `${p.marca} • ` : ''}
                                Venta: {ventaTexto(p.unidad)} • Tipo: {tipoMaterial(p)} • Envase: {envaseTextoDet(p)} • Stock: {Math.trunc(Number(p.stock||0))}
                              </small>
                            </div>
                            <div className="col-auto">
                              <span className={`badge ${idx===pickerIndex ? 'bg-light text-primary' : 'bg-primary'}`}>
                                ${p.precioPublico}
                              </span>
                              {Math.trunc(Number(p.stock||0)) === maxAvailable && Math.trunc(Number(p.stock||0))>0 && (
                                <span className={`badge ${idx===pickerIndex ? 'bg-light text-primary' : 'bg-success'} ms-2`}>Mayor stock</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline-secondary" onClick={()=> setShowPicker(false)}>Cerrar (Esc)</button>
                <button className="btn btn-primary" onClick={()=>{ const p = products[pickerIndex]; if(p) addToCart(p,1) }}>
                  Agregar (Enter)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal para seleccionar cliente existente */}
      {showExistingPicker && (
        <div className={styles.overlay}>
          <div className="modal-dialog modal-xl">
            <div className={"modal-content " + styles.modalContent}>
              <div className="modal-header">
                <div>
                  <h5 className="modal-title mb-0">Seleccionar cliente</h5>
                  <small className="text-muted">Elegí un cliente de la lista.</small>
                </div>
                <button type="button" className="btn-close" onClick={()=> setShowExistingPicker(false)}></button>
              </div>
              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-12">
                    <div className="card h-100">
                      <div className="card-header d-flex align-items-center justify-content-between">
                        <span className="fw-semibold">Clientes</span>
                        <span className="badge bg-primary">{customers.length} en total</span>
                      </div>
                      <div className="card-body p-0">
                        <div className="p-3 border-bottom">
                          <div className="input-group">
                            <span className="input-group-text">🔍</span>
                            <input className="form-control" placeholder="Buscar por nombre, ciudad o documento" value={customerQuery} onChange={e=> setCustomerQuery(e.target.value)} />
                          </div>
                        </div>
                        <div style={{maxHeight:'400px', overflow:'auto'}}>
                          {(customers.filter(c=>{
                            const q = String(customerQuery||'').trim().toLowerCase()
                            if (!q) return true
                            return (
                              String(c.nombre||'').toLowerCase().includes(q) ||
                              String(c.ciudad||'').toLowerCase().includes(q) ||
                              String(c.documento||'').toLowerCase().includes(q)
                            )
                          })).map(c=> (
                            <div 
                              key={c.id}
                              className={`p-3 border-bottom ${selectedCustomerId===c.id ? 'bg-primary text-white' : ''}`}
                              style={{cursor:'pointer'}}
                              onClick={()=>{ setSelectedCustomerId(c.id); }}
                              onDoubleClick={()=>{ setSelectedCustomerId(c.id); }}
                            >
                              <div className="d-flex justify-content-between align-items-start">
                                <div className="flex-grow-1">
                                  <div className="fw-bold">{c.nombre}</div>
                                  <small className={selectedCustomerId===c.id ? 'text-white-50' : 'text-muted'}>
                                    {c.direccion} • {c.ciudad} {c.documento ? `• ${c.documento}` : ''}
                                  </small>
                                </div>
                                {selectedCustomerId===c.id && <span className="badge bg-light text-primary ms-2">✓</span>}
                              </div>
                            </div>
                          ))}
                          {customers.length === 0 && (
                            <div className="p-4 text-center text-muted">
                              <i className="bi bi-people display-6 d-block mb-2"></i>
                              No hay clientes cargados
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline-secondary" onClick={()=> setShowExistingPicker(false)}>Cancelar</button>
                <button className="btn btn-primary" disabled={!selectedCustomerId} onClick={()=>{
                  const c = customers.find(x=> x.id===selectedCustomerId)
                  if (c) {
                    setCliente({ nombre: c.nombre||'', direccion: c.direccion||'', ciudad: c.ciudad||'', telefono: c.telefono||'', documento: c.documento||'' })
                    setClienteId(c.id)
                    const billLines = [
                      c.nombre ? `Nombre: ${c.nombre}` : null,
                      c.direccion ? `Dirección: ${c.direccion}` : null,
                      c.ciudad ? `Localidad/Partido: ${c.ciudad}` : null,
                      c.telefono ? `Teléfono: ${c.telefono}` : null,
                      c.documento ? `CUIT/DNI: ${c.documento}` : null
                    ].filter(Boolean)
                    setBillToText(billLines.join('\n'))
                  }
                  setShowExistingPicker(false)
                }}>
                  Usar selección
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}