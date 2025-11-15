import { useEffect, useState } from 'react'
import { capitalizeWords } from '../utils/text'
import { parseEsNumber, formatEsMoneyLive, formatEs } from '../utils/money'
import useValidadorPrecios, { calcularValorNumerico } from '../utils/useValidadorPrecios'
import api from '../api'
import stylesProductos from '../styles/modules/Productos/Productos.module.css'
import { swalError, swalSuccess, swalConfirm, swalPromptText, swalPromptNumber } from '../components/swal'
import ProductCapacityModal from '../components/ProductCapacityModal'
import ImagePickerModal from '../components/ImagePickerModal'
import { resolveAssetUrl } from '../utils/assets'

export default function Productos(){
  const [items, setItems] = useState([])
  const [form, setForm] = useState({ nombreBoleta:'', descripcion:'', unidad:'litro', marca:'', stock:0, precioMayorista:0, precioPublico:0 })
  // UI inputs para evitar mostrar "0" mientras se escribe y formatear precios
  const [ui, setUi] = useState({ stock:'', pmayor:'', ppublico:'' })
  // Campos adicionales cuando se selecciona un mayorista (materia prima)
  // El rendimiento (L por empaque) se define en el mayorista; aquí no se edita
  const [litrosCrear, setLitrosCrear] = useState('')
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState('id') // 'id' | 'fecha'
  const [sortDir, setSortDir] = useState('desc') // 'asc' | 'desc'
  const [capacityProduct, setCapacityProduct] = useState(null)
  // Editor de imagen del producto
  const [imageEditProduct, setImageEditProduct] = useState(null)
  // Selector de productos mayoristas (materias primas) para producir
  const [mayoristas, setMayoristas] = useState([])
  const [selectorAbierto, setSelectorAbierto] = useState(false)
  const [selectorBuscar, setSelectorBuscar] = useState('')
  const [mayoristaSel, setMayoristaSel] = useState(null)
  // Validadores para precios
  const pmayorVal = useValidadorPrecios('', { decimales: 2 })
  const ppublicoVal = useValidadorPrecios('', { decimales: 2 })
  // Resumen rápido de capacidad potencial según mayorista y rendimiento elegido
  const stockEmpaquesSel = Math.trunc(Number(mayoristaSel?.stock||0))
  const rendimientoSelInt = Math.trunc(Number(mayoristaSel?.rendimientoLitrosPorEmpaque||100))
  const capacidadTotalSel = Math.max(0, stockEmpaquesSel * rendimientoSelInt)

  const load = async ()=>{
    // Pedimos explícitamente sólo productos no mayoristas y filtramos por seguridad
    const res = await api.get('/products?includeMayorista=false')
    const rows = Array.isArray(res.data) ? res.data.filter(p=> !p.esMayorista) : []
    setItems(rows)
  }
  const loadMayoristas = async ()=>{
    const res = await api.get('/products?includeMayorista=true')
    const rows = Array.isArray(res.data) ? res.data.filter(p=> !!p.esMayorista) : []
    setMayoristas(rows)
  }
  useEffect(()=>{ load(); loadMayoristas() },[])

  const fmtNumber = (n)=> new Intl.NumberFormat('es-ES', { minimumFractionDigits:2, maximumFractionDigits:2 }).format(Number(n||0))

  const onSubmit = async e=>{
    e.preventDefault()
    setError('')
    try{
      const nombreFinal = String(form.nombreBoleta||'').trim()
      const payload = {
        // Usamos un único nombre descriptivo (boleta) y lo sincronizamos con nombre
        nombre: nombreFinal,
        nombreBoleta: nombreFinal,
        descripcion: form.descripcion,
        unidad: form.unidad,
        marca: form.marca,
        // Si hay mayorista seleccionado, el stock se registrará vía producción;
        // evitamos doble ingreso usando el campo "Litros a registrar".
        stock: mayoristaSel ? 0 : (parseInt(ui.stock||'0', 10) || 0),
        precioMayorista: parseEsNumber(ui.pmayor),
        precioPublico: parseEsNumber(ui.ppublico),
        // imagenUrl ya no se carga desde Productos: se hereda del mayorista
        imagenUrl: mayoristaSel?.imagenUrl ? String(mayoristaSel.imagenUrl).trim() : undefined,
      }
      const res = await api.post('/products', payload)
      const created = res?.data
      // Si se seleccionó materia prima, crear mapeo y (opcional) registrar litros
      if (mayoristaSel && created?.id) {
        const rendimiento = Math.trunc(Number(mayoristaSel?.rendimientoLitrosPorEmpaque||100))
        if (Number.isFinite(rendimiento) && rendimiento>0) {
          try { await api.post('/product-materials', { productId: created.id, materiaPrimaId: mayoristaSel.id, rendimientoLitrosPorEmpaque: rendimiento }) } catch {}
        }
        const litros = Math.trunc(Number((litrosCrear||'').replace(/[^0-9]/g,'')))
        if (litros>0) {
          // Confirmar antes de registrar producción, ya que consumirá empaques de materia prima
          const ok = await swalConfirm({
            title: 'Registrar litros producidos',
            text: `Se registrarán ${litros} L usando la materia prima "${mayoristaSel.nombre}". Esto consumirá empaques y reducirá la capacidad restante.`,
          })
          if (ok) {
            try {
              await api.post('/production/produce', { productId: created.id, materiaPrimaId: mayoristaSel.id, litros, nota: 'Registro automático al crear producto' })
            } catch (err) {
              // Mostrar error si excede capacidad o datos inválidos
              setError(err?.response?.data?.error || err?.message)
            }
          }
        }
      }
      setForm({ nombreBoleta:'', descripcion:'', unidad:'litro', marca:'', stock:0, precioMayorista:0, precioPublico:0 })
      setUi({ stock:'', pmayor:'', ppublico:'' })
      setLitrosCrear('')
      setMayoristaSel(null)
      await load()
    }catch(e){ setError(e.response?.data?.error || e.message) }
  }

  const fmtDate = (d)=>{
    try { return new Date(d).toLocaleString('es-AR', { dateStyle:'short', timeStyle:'short' }) } catch { return '' }
  }
  const norm = (s)=> String(s||'').toLowerCase()
  const viewItems = items
    .filter(p=>{
      const q = norm(search)
      if(!q) return true
      return norm(p.nombre).includes(q) || norm(p.nombreBoleta).includes(q) || norm(p.marca).includes(q) || String(p.id).includes(q)
    })
    .sort((a,b)=>{
      const A = sortField==='fecha' ? new Date(a.createdAt).getTime() : Number(a.id||0)
      const B = sortField==='fecha' ? new Date(b.createdAt).getTime() : Number(b.id||0)
      return sortDir==='asc' ? A - B : B - A
    })

  return (
    <div className={"container py-3 " + stylesProductos.wrap}>
      <h2 className="mb-3">Productos</h2>
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <span>Agregar producto</span>
          <button className="btn btn-sm btn-secondary" onClick={()=> setSelectorAbierto(true)}>Buscar producto mayorista</button>
        </div>
        <div className="card-body">
      <form onSubmit={onSubmit} style={{ display:'grid', gap:6, gridTemplateColumns:'repeat(3, minmax(200px, 1fr))', maxWidth:'100%' }}>
        <label htmlFor="nombreBoleta">Nombre del producto (se usará en la boleta)
          <input className="form-control form-control-sm" id="nombreBoleta" value={form.nombreBoleta} onChange={e=>setForm({...form,nombreBoleta:capitalizeWords(e.target.value)})} placeholder="Ej: jabón líquido azul" required />
        </label>
        <label htmlFor="marca">Marca
          <input className="form-control form-control-sm" id="marca" value={form.marca} onChange={e=>setForm({...form,marca:e.target.value})} />
        </label>

        {mayoristaSel && (
          <div style={{ gridColumn:'1 / span 2' }} className="alert alert-info d-flex justify-content-between align-items-center">
            <div>
              <strong>Mayorista seleccionado:</strong> {mayoristaSel.nombre} {mayoristaSel.marca ? `- ${mayoristaSel.marca}` : ''} ({mayoristaSel.unidad})
            </div>
            <button type="button" className="btn btn-sm btn-outline-dark" onClick={()=> setMayoristaSel(null)}>Quitar selección</button>
          </div>
        )}

        <label htmlFor="descripcion" style={{ gridColumn:'1 / span 3' }}>Descripción
          <textarea className="form-control form-control-sm" id="descripcion" value={form.descripcion} onChange={e=>setForm({...form,descripcion:e.target.value})} rows={2} />
        </label>

        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span>Unidad</span>
          <label><input type="radio" name="unidad" checked={form.unidad==='litro'} onChange={()=>setForm({...form,unidad:'litro'})}/> Litro</label>
          <label><input type="radio" name="unidad" checked={form.unidad==='kilo'} onChange={()=>setForm({...form,unidad:'kilo'})}/> Kilo</label>
        </div>

        {/* Imagen (URL) removida del formulario de Productos. Se hereda desde Mayorista. */}

        {mayoristaSel && (
          <>
            {/* Se oculta el campo de rendimiento aquí; se gestiona en Mayorista */}

            <label htmlFor="litrosCrear">Litros a registrar (sumar al stock)
              <input
                className="form-control form-control-sm"
                id="litrosCrear"
                type="text"
                inputMode="numeric"
                placeholder="ej: 100"
                value={litrosCrear}
                onChange={e=> setLitrosCrear(String(e.target.value||'').replace(/[^0-9]/g,''))}
              />
            </label>

            {/* Resumen de capacidad potencial para el mayorista seleccionado */}
            <div style={{ gridColumn:'1 / span 3' }} className="alert alert-secondary d-flex justify-content-between align-items-center">
              <span><strong>Capacidad potencial</strong></span>
              <span>Stock empaques: <strong>{stockEmpaquesSel}</strong></span>
              <span>Total: <strong>{capacidadTotalSel} L</strong> · Creado: <strong>0 L</strong> · Restante: <strong>{capacidadTotalSel} L</strong></span>
            </div>
          </>
        )}

        {!mayoristaSel && (
          <label htmlFor="stock">Stock (cantidad)
            <input
              className="form-control form-control-sm"
              id="stock"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="0"
              value={ui.stock}
              onChange={e=>{
                const v = String(e.target.value||'').replace(/[^0-9]/g,'')
                setUi(prev=> ({...prev, stock: v}))
              }}
              onFocus={e=>{
                const v = String(ui.stock||'')
                if (!v || v === '0') {
                  setUi(prev=> ({...prev, stock: ''}))
                } else {
                  // Seleccionar todo para reemplazar rápido
                  requestAnimationFrame(()=> e.target.select())
                }
              }}
            />
          </label>
        )}

        <label htmlFor="pmayor">Precio mayorista
          <input
            className="form-control form-control-sm"
            id="pmayor"
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={pmayorVal.valor}
            onChange={e=>{
              const nuevo = pmayorVal.setValor(e.target.value)
              const num = calcularValorNumerico(nuevo)
              setForm(prev=> ({...prev, precioMayorista: num}))
            }}
            onBlur={e=>{
              pmayorVal.formatearFinal()
              const n = pmayorVal.valorNumerico
              setForm(prev=> ({ ...prev, precioMayorista: n }))
            }}
          />
        </label>

        <label htmlFor="ppublico">Precio público
          <input
            className="form-control form-control-sm"
            id="ppublico"
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={ppublicoVal.valor}
            onChange={e=>{
              const nuevo = ppublicoVal.setValor(e.target.value)
              const num = calcularValorNumerico(nuevo)
              setForm(prev=> ({...prev, precioPublico: num}))
            }}
            onBlur={e=>{
              ppublicoVal.formatearFinal()
              const n = ppublicoVal.valorNumerico
              setForm(prev=> ({ ...prev, precioPublico: n }))
            }}
          />
        </label>

        <div style={{ gridColumn:'1 / span 3' }}>
          <button className="btn btn-primary" type="submit">Agregar producto</button>
        </div>
      </form>
        </div>
      </div>
      {error && <p style={{color:'red'}}>{error}</p>}

      <div className="d-flex justify-content-between align-items-center" style={{ marginTop:8, gap:8 }}>
        <input className="form-control form-control-sm" style={{ maxWidth: 280 }} placeholder="Buscar por nombre, marca o ID" value={search} onChange={e=> setSearch(e.target.value)} />
        <div className="d-flex align-items-center" style={{ gap:6 }}>
          <select className="form-select form-select-sm" style={{ maxWidth: 150 }} value={sortField} onChange={e=> setSortField(e.target.value)}>
            <option value="id">Ordenar por ID</option>
            <option value="fecha">Ordenar por fecha</option>
          </select>
          <select className="form-select form-select-sm" style={{ maxWidth: 130 }} value={sortDir} onChange={e=> setSortDir(e.target.value)}>
            <option value="desc">Descendente</option>
            <option value="asc">Ascendente</option>
          </select>
        </div>
      </div>

      <table className="table table-striped tabla-productos" style={{ marginTop:4, width:'100%' }}>
        <thead>
          <tr><th>ID</th><th>Nombre</th><th>Unidad</th><th>Marca</th><th>Stock</th><th>Mayorista</th><th>Público</th><th>Imagen</th><th>Fecha</th><th className="text-end">Acciones</th></tr>
        </thead>
        <tbody>
          {viewItems.map(p=> (
            <tr key={p.id}>
              <td>{p.id}</td><td>{p.nombreBoleta || p.nombre}</td><td>{p.unidad}</td><td>{p.marca}</td><td>{Math.trunc(Number(p.stock||0))}</td><td>${fmtNumber(p.precioMayorista)}</td><td>${fmtNumber(p.precioPublico)}</td>
              <td>{p.imagenUrl ? <img alt="img" src={resolveAssetUrl(p.imagenUrl)} style={{ height:32 }} /> : '-'}</td>
              <td>{fmtDate(p.createdAt)}</td>
              <td className="text-end" style={{whiteSpace:'nowrap'}}>
                <button className="btn btn-sm btn-outline-success me-2" title="Capacidad y litros" onClick={()=> setCapacityProduct(p)}>Litros</button>
                <button className="btn btn-sm btn-outline-secondary me-2" onClick={()=> setImageEditProduct(p)}>Imagen</button>
                <button className="btn btn-sm btn-outline-primary me-2" onClick={async ()=>{
                  try {
                    const nombreBoleta = await swalPromptText({ title: 'Nombre (boleta)', defaultValue: p.nombreBoleta || p.nombre || '' })
                    if (nombreBoleta===null) return
                    const marca = await swalPromptText({ title: 'Marca', defaultValue: p.marca||'' })
                    if (marca===null) return
                    const descripcion = await swalPromptText({ title: 'Descripción', defaultValue: p.descripcion||'' })
                    if (descripcion===null) return
                    // Unidad con validación simple
                    let unidad = await swalPromptText({ title: 'Unidad (litro/kilo)', defaultValue: p.unidad })
                    if (unidad===null) return
                    unidad = String(unidad||'').trim().toLowerCase()==='kilo' ? 'kilo' : 'litro'
                    const stockVal = await swalPromptNumber({ title: 'Stock', defaultValue: String(Math.trunc(Number(p.stock||0))), integerOnly: true, min: 0 })
                    if (stockVal===null) return
                    const pmayorVal = await swalPromptNumber({ title: 'Precio mayorista', defaultValue: String(p.precioMayorista), min: 0 })
                    if (pmayorVal===null) return
                    const ppublicoVal = await swalPromptNumber({ title: 'Precio público', defaultValue: String(p.precioPublico), min: 0 })
                    if (ppublicoVal===null) return
                    const nombreFinal = String(nombreBoleta||'').trim()
                    const payload = {
                      nombre: nombreFinal,
                      nombreBoleta: nombreFinal,
                      marca: String(marca||'').trim(),
                      descripcion: String(descripcion||'').trim(),
                      unidad,
                      stock: Math.trunc(Number(stockVal)||0),
                      precioMayorista: Number(pmayorVal)||0,
                      precioPublico: Number(ppublicoVal)||0,
                      // imagenUrl no se edita aquí: se muestra pero se gestiona en Mayorista
                    }
                    await api.put(`/products/${p.id}`, payload)
                    await load()
                    await swalSuccess('Producto actualizado', 'Productos')
                  } catch(e) {
                    await swalError(e.response?.data?.error || e.message, 'Editar producto')
                  }
                }}>Editar</button>
                <button className="btn btn-sm btn-outline-danger" onClick={async ()=>{
                  const ok = await swalConfirm({ title:`Eliminar producto`, text:`¿Eliminar ${p.nombre}?` })
                  if(!ok) return
                  try{ await api.delete(`/products/${p.id}`); await load(); await swalSuccess('Producto eliminado') }catch(e){ await swalError(e.response?.data?.error || e.message, 'Eliminar producto') }
                }}>Eliminar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {capacityProduct && (
        <ProductCapacityModal product={capacityProduct} onClose={()=> setCapacityProduct(null)} />
      )}

      {/* Modal para seleccionar imagen del producto */}
      {imageEditProduct && (
        <ImagePickerModal
          visible={!!imageEditProduct}
          onClose={()=> setImageEditProduct(null)}
          onSelect={async (it)=>{
            try{
              // Almacenar ruta relativa para portabilidad
              const rel = String(new URL(it.url).pathname || '').replace(/^\//,'') // assets/product-images/...
              await api.put(`/products/${imageEditProduct.id}`, { imagenUrl: rel })
              await load()
              setImageEditProduct(null)
              await swalSuccess('Imagen actualizada')
            }catch(e){ await swalError(e.response?.data?.error || e.message, 'Actualizar imagen') }
          }}
        />
      )}

      {/* Modal selector mayorista */}
      {selectorAbierto && (
        <div className="modal fade show" style={{ display:'block', backgroundColor:'rgba(0,0,0,0.4)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Buscar producto mayorista</h5>
                <button type="button" className="btn-close" onClick={()=> setSelectorAbierto(false)}></button>
              </div>
              <div className="modal-body">
                <input className="form-control mb-2" placeholder="Buscar por nombre o marca" value={selectorBuscar} onChange={e=> setSelectorBuscar(e.target.value)} />
                <table className="table table-hover">
                  <thead><tr><th>ID</th><th>Nombre</th><th>Marca</th><th>Unidad</th><th>Stock</th><th></th></tr></thead>
                  <tbody>
                    {mayoristas.filter(m=>{
                      const q = String(selectorBuscar||'').toLowerCase()
                      if(!q) return true
                      return String(m.nombre||'').toLowerCase().includes(q) || String(m.marca||'').toLowerCase().includes(q)
                    }).map(m=> (
                      <tr key={m.id}>
                        <td>{m.id}</td>
                        <td>{m.nombre}</td>
                        <td>{m.marca||''}</td>
                        <td>{m.unidad}</td>
                        <td>{Math.trunc(Number(m.stock||0))}</td>
                        <td className="text-end"><button className="btn btn-sm btn-primary" onClick={()=>{
                          // Seleccionar mayorista sin sobrescribir el nombre ni la unidad del producto final.
                          // Sólo sugerimos marca (si existe) y mantenemos el nombre que el usuario ingresó.
                          setMayoristaSel(m);
                          setForm(prev=> ({
                            ...prev,
                            // Mantener unidad elegida por el usuario (por defecto: litro)
                            unidad: prev.unidad,
                            // Sugerir marca del mayorista si el campo está vacío
                            marca: prev.marca ? prev.marca : (m.marca || ''),
                            // No tocar el nombre público del producto final
                            nombre: prev.nombre
                          }));
                          setSelectorAbierto(false)
                        }}>Usar</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={()=> setSelectorAbierto(false)}>Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}