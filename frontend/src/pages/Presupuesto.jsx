import { useEffect, useMemo, useState } from 'react'
import api from '../api'
import { swalError, swalSuccess } from '../components/swal'

export default function Presupuesto(){
  const [products, setProducts] = useState([])
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState([])
  const [error, setError] = useState('')
  const [conIva, setConIva] = useState(true)
  const [ivaPct, setIvaPct] = useState(21)

  useEffect(()=>{
    const load = async ()=>{
      try{
        // Usar el endpoint correcto y excluir mayoristas (materia prima)
        const res = await api.get('/products?includeMayorista=false')
        const rows = Array.isArray(res.data) ? res.data.filter(p=> !p.esMayorista) : []
        setProducts(rows)
      }catch(e){ setError('No se pudo cargar productos') }
    }
    load()
  },[])

  // Cargar IVA por defecto desde la empresa
  useEffect(()=>{
    const loadTax = async ()=>{
      try{
        const r = await api.get('/company')
        const pct = Number(r.data?.tax_rate || 21)
        if (Number.isFinite(pct) && pct >= 0 && pct <= 100) setIvaPct(pct)
      }catch{}
    }
    loadTax()
  },[])

  const addToCart = (p, qty=1)=>{
    setCart(prev=>{
      const existing = prev.find(c=> c.productId===p.id)
      if (existing) return prev.map(c=> c.productId===p.id ? { ...c, quantity: c.quantity + qty } : c)
      return [...prev, { productId: p.id, name: p.nombre, price: Number(p.precioPublico||0), quantity: qty, image: p.imagenUrl||'' }]
    })
  }
  const incItem = (id)=> setCart(prev=> prev.map(c=> c.productId===id ? { ...c, quantity: c.quantity+1 } : c))
  const decItem = (id)=> setCart(prev=> prev.map(c=> c.productId===id ? { ...c, quantity: Math.max(1, c.quantity-1) } : c))
  const removeItem = (id)=> setCart(prev=> prev.filter(c=> c.productId!==id))
  const clearCart = ()=> setCart([])

  const filtered = useMemo(()=>{
    const q = query.trim().toLowerCase()
    if (!q) return products
    return products.filter(p=>{
      const nombre = String(p.nombre||'').toLowerCase()
      const marca = String(p.marca||'').toLowerCase()
      const unidad = String(p.unidad||'').toLowerCase()
      return nombre.includes(q) || marca.includes(q) || unidad.includes(q)
    })
  }, [products, query])

  const total = useMemo(()=> cart.reduce((acc, c)=> acc + c.price * c.quantity, 0), [cart])
  const ivaMonto = useMemo(()=> conIva ? +(total * (Number(ivaPct||0)/100)).toFixed(2) : 0, [total, conIva, ivaPct])
  const totalConIva = useMemo(()=> conIva ? +(total * (1 + (Number(ivaPct||0)/100))).toFixed(2) : total, [total, conIva, ivaPct])

  const generarPresupuestoPdf = async ()=>{
    if (cart.length===0) { await swalError('Agregá productos al presupuesto.'); return }
    try{
      const items = cart.map(c=> ({ name: c.name, qty: c.quantity, price: c.price, image: c.image }))
      localStorage.setItem('presupuestoItems', JSON.stringify(items))
      localStorage.setItem('presupuestoIva', JSON.stringify({ conIva, ivaPct }))
      // Imprimir en iframe oculto sin salir de la página
      let iframe = document.getElementById('boletaPrintFrame')
      if (!iframe) {
        iframe = document.createElement('iframe')
        iframe.id = 'boletaPrintFrame'
        iframe.style.position = 'fixed'
        iframe.style.right = '0'
        iframe.style.bottom = '0'
        iframe.style.width = '0'
        iframe.style.height = '0'
        iframe.style.border = '0'
        iframe.style.visibility = 'hidden'
        document.body.appendChild(iframe)
      }
      // BoletaPreview detecta print=1 y ejecuta window.print() dentro del iframe
      iframe.src = '/boleta-preview?mode=presupuesto&print=1'
    }catch(e){ await swalError('No se pudo abrir el PDF de presupuesto.') }
  }

  const enviarAVenta = async ()=>{
    if (cart.length===0) { await swalError('No hay productos para vender.'); return }
    try{
      localStorage.setItem('budgetCart', JSON.stringify(cart))
      window.location.href = '/ventas'
    }catch(e){ await swalError('No se pudo enviar a Ventas.') }
  }

  return (
    <div className="container pt-1">
      <div className="row g-1 align-items-center mb-1">
        <div className="col-auto"><h2 className="mb-0">Presupuesto</h2></div>
        <div className="col">
          <div className="input-group input-group-sm">
            <span className="input-group-text">🔍</span>
            <input className="form-control" placeholder="Buscar por nombre, marca o unidad" value={query} onChange={e=> setQuery(e.target.value)} />
            <button className="btn btn-outline-secondary" onClick={()=> setQuery('')}>Limpiar</button>
          </div>
        </div>
        <div className="col-auto d-flex gap-2">
          <button className="btn btn-warning text-white" onClick={generarPresupuestoPdf} disabled={cart.length===0}>
            <i className="bi bi-filetype-pdf me-1"></i>Generar PDF (Presupuesto)
          </button>
          <button className="btn btn-success" onClick={enviarAVenta} disabled={cart.length===0}>
            <i className="bi bi-cart-check me-1"></i>Vender
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger">{error}</div>
      )}

      <div className="row g-1">
        <div className="col-12 col-lg-5">
          <div className="card">
            <div className="card-header">Productos</div>
            <div className="card-body p-0">
              <table className="table table-striped mb-0">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Precio Público</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p=> (
                    <tr key={p.id}>
                      <td>
                        <div className="d-flex align-items-center" style={{gap:'12px'}}>
                          {p.imagenUrl ? (
                            <img src={p.imagenUrl} alt={p.nombre} width={42} height={42} className="rounded border" style={{objectFit:'cover'}} onError={(e)=>{ e.currentTarget.style.display='none' }} />
                          ) : (
                            <div className="rounded border d-flex align-items-center justify-content-center" style={{width:42, height:42, backgroundColor: 'var(--bs-secondary-bg)'}}>
                              <small className="text-muted">Sin img</small>
                            </div>
                          )}
                          <div>
                            <div className="fw-semibold">{p.nombre}</div>
                            <small className="text-muted">{p.marca ? p.marca+' • ' : ''}{p.unidad}</small>
                          </div>
                        </div>
                      </td>
                      <td className="align-middle">${Number(p.precioPublico||0)}</td>
                      <td className="align-middle">
                        <div className="btn-group btn-group-sm" role="group">
                          <button className="btn btn-primary" onClick={()=> addToCart(p,1)}>Agregar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-7">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <strong>Carrito Presupuesto</strong>
              <div className="d-flex align-items-center flex-wrap" style={{gap:'8px'}}>
                <div className="form-check form-check-inline m-0">
                  <input id="pres-iva" className="form-check-input" type="checkbox" checked={conIva} onChange={(e)=> setConIva(e.target.checked)} />
                  <label className="form-check-label" htmlFor="pres-iva">IVA</label>
                </div>
                <input className="form-control form-control-sm" type="number" min="0" max="100" step="1" value={ivaPct} onChange={(e)=> setIvaPct(Number(e.target.value||0))} style={{ width: 80 }} title="IVA %" />
                <span className="badge fs-6" style={{ backgroundColor: '#dc3545', color: '#fff' }}>Subtotal: ${ total.toFixed(2) }</span>
                <span className="badge fs-6" style={{ backgroundColor: '#ffc107', color: '#000' }}>IVA {Number(ivaPct||0)}%: ${ ivaMonto.toFixed(2) }</span>
                <span className="badge fs-6" style={{ backgroundColor: '#198754', color: '#fff' }}>Total: ${ totalConIva.toFixed(2) }</span>
                <button className="btn btn-sm btn-outline-secondary ms-2" onClick={clearCart} disabled={cart.length===0}>Vaciar</button>
              </div>
            </div>
            <div className="card-body p-0">
              {cart.length===0 ? (
                <div className="p-3 text-center text-muted">Agregá productos al presupuesto</div>
              ) : (
                <table className="table mb-0">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th className="text-end">Precio</th>
                      <th className="text-center">Cant.</th>
                      <th className="text-end">Subtotal</th>
                      <th className="text-end">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map(c=> (
                      <tr key={c.productId}>
                        <td>
                          <div className="d-flex align-items-center" style={{gap:'12px'}}>
                            {c.image ? (
                              <img src={c.image} alt={c.name} width={38} height={38} className="rounded border" style={{objectFit:'cover'}} onError={(e)=>{ e.currentTarget.style.display='none' }} />
                            ) : null}
                            <div>
                              <div className="fw-semibold">{c.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="text-end align-middle">${c.price.toFixed(2)}</td>
                        <td className="text-center align-middle"><span className="badge bg-primary fs-6">{c.quantity}</span></td>
                        <td className="text-end align-middle fw-bold">${(c.price*c.quantity).toFixed(2)}</td>
                        <td className="text-end align-middle">
                          <div className="btn-group" role="group">
                            <button className="btn btn-success btn-sm" onClick={()=> incItem(c.productId)}>Sumar</button>
                            <button className="btn btn-warning btn-sm text-white" onClick={()=> decItem(c.productId)}>Restar</button>
                            <button className="btn btn-danger btn-sm" onClick={()=> removeItem(c.productId)}>Quitar</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="card-footer d-flex justify-content-end gap-2">
              <button className="btn btn-warning text-white" onClick={generarPresupuestoPdf} disabled={cart.length===0}>
                <i className="bi bi-filetype-pdf me-1"></i>Presupuesto PDF
              </button>
              <button className="btn btn-success" onClick={enviarAVenta} disabled={cart.length===0}>
                <i className="bi bi-cart-check me-1"></i>Vender
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}