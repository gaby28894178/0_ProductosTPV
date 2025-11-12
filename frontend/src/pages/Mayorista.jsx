import { useState, useEffect } from 'react'
import { capitalizeWords } from '../utils/text'
import { parseEsNumber, formatEsMoneyLive } from '../utils/money'
import useValidadorPrecios, { calcularValorNumerico } from '../utils/useValidadorPrecios'
import api from '../api'
import '../styles/Mayorista.css'
import stylesMayorista from '../styles/modules/Mayorista/Mayorista.module.css'
import { swalError, swalSuccess, swalPromptText, swalPromptNumber, swalConfirm } from '../components/swal'

export default function Mayorista(){
  const [items, setItems] = useState([])
  const [imageOptions, setImageOptions] = useState([])
  const [imageSelectorOpen, setImageSelectorOpen] = useState(false)
  const [imageDropdownOpen, setImageDropdownOpen] = useState(false)
  const [newImageTitle, setNewImageTitle] = useState('')
  const [newImageDesc, setNewImageDesc] = useState('')
  const [newImageFile, setNewImageFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [categoria, setCategoria] = useState('pastas') // 'pastas' | 'liquidos'
  const [empaque, setEmpaque] = useState('paquete') // pastas: paquete/balde; liquidos: bidon
  const [capacidad, setCapacidad] = useState(10) // kg o L según categoría
  // UI string para capacidad, para permitir campo en blanco y evitar mostrar "0" al enfocar
  const [uiCapacidad, setUiCapacidad] = useState('10')
  const [nombreBase, setNombreBase] = useState('Producto mayorista')
  const [marca, setMarca] = useState('CLEANPRO')
  const [precioMayorista, setPrecioMayorista] = useState(0)
  // UI de precios como texto para ocultar "0" mientras se escribe
  const [uiMayorista, setUiMayorista] = useState('')
  const [stock, setStock] = useState(0)
  const [rendimientoLitrosPorEmpaque, setRendimientoLitrosPorEmpaque] = useState(100)
  const [uiRendimiento, setUiRendimiento] = useState('100')
  const [imagenUrl, setImagenUrl] = useState('')
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [errors, setErrors] = useState({ nombre:false, precioMayorista:false, stock:false, capacidad:false })
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState('id') // 'id' | 'fecha'
  const [sortDir, setSortDir] = useState('desc') // 'asc' | 'desc'
  const precioVal = useValidadorPrecios('', { decimales: 2 })

  const unidad = categoria === 'pastas' ? 'kilo' : 'litro'
  const nombre = `${nombreBase} - ${empaqueLabel(empaque)} ${capacidad}${unidad === 'kilo' ? 'Kg' : 'L'}`

  function empaqueLabel(e){
    if (e === 'paquete') return 'Paquete'
    if (e === 'balde') return 'Balde'
    if (e === 'bidon') return 'Bidón'
    return e
  }

  const fmtNumber = (n)=> new Intl.NumberFormat('es-ES', { minimumFractionDigits:2, maximumFractionDigits:2 }).format(Number(n||0))

  // Helper con reintentos para evitar fallas transitorias cuando el backend reinicia
  const getWithRetry = async (url, opts = {}, { retries = 3, delayMs = 400 } = {}) => {
    let lastErr
    for (let i = 0; i < retries; i++) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const res = await api.get(url, opts)
        return res
      } catch (e) {
        lastErr = e
        // Si es un error de red/conexión, intentamos nuevamente
        const isNetwork = String(e?.code||'').includes('ERR_NETWORK') || /Network Error/i.test(String(e?.message||''))
        if (!isNetwork) break
        // eslint-disable-next-line no-await-in-loop
        await new Promise(r => setTimeout(r, delayMs))
      }
    }
    throw lastErr
  }

  const loadMayoristas = async ()=>{
    try{
      const res = await getWithRetry('/products?includeMayorista=true')
      const onlyMayorista = Array.isArray(res.data) ? res.data.filter(p=> !!p.esMayorista) : []
      setItems(onlyMayorista)
    }catch(e){
      // Evitar romper la UI si el backend está reiniciando o sin conexión
      console.error('Error cargando mayoristas:', e)
      setItems([])
    }
  }
  const loadImages = async ()=>{
    try{
      const res = await getWithRetry('/images/product-images')
      setImageOptions(Array.isArray(res.data) ? res.data : [])
    }catch(e){ /* silencioso para no romper la UI si no hay carpeta */ }
  }
  useEffect(()=>{ loadMayoristas(); loadImages(); },[])

  const uploadImage = async ()=>{
    try{
      if (!newImageFile) { await swalError('Seleccioná un archivo de imagen', 'Subir imagen'); return }
      setUploading(true)
      const fd = new FormData()
      fd.append('file', newImageFile)
      if (newImageTitle) fd.append('title', newImageTitle)
      if (newImageDesc) fd.append('description', newImageDesc)
      const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
      const token = localStorage.getItem('token')
      const res = await fetch(`${BASE}/images/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
      })
      if (!res.ok) {
        let msg = `Error ${res.status}`
        const ct = res.headers.get('content-type') || ''
        if (ct.includes('application/json')) {
          try { const j = await res.json(); msg = j.error || msg } catch {}
        } else {
          try { const t = await res.text(); if (t) msg = t } catch {}
        }
        throw new Error(msg)
      }
      await loadImages()
      setNewImageFile(null); setNewImageTitle(''); setNewImageDesc('')
      setUploadModalOpen(false)
      await swalSuccess('Imagen subida', 'Imágenes')
    }catch(e){ await swalError(e.message || 'Error subiendo imagen', 'Subir imagen') } finally { setUploading(false) }
  }

  const editImageMetadata = async (opt)=>{
    try{
      const title = await swalPromptText({ title: 'Título', defaultValue: opt.title || '' })
      if (title === null) return
      const description = await swalPromptText({ title: 'Descripción', defaultValue: opt.description || '' })
      if (description === null) return
      await api.put('/images/metadata', { filename: opt.filename, title, description })
      await loadImages()
      await swalSuccess('Imagen actualizada', 'Imágenes')
    }catch(e){ await swalError(e.response?.data?.error || e.message, 'Editar imagen') }
  }

  const submit = async ()=>{
    try{
      // Aseguramos que si el usuario hace click sin salir del input,
      // se tomen los valores escritos en los campos de texto.
      const precioMayoristaNum = parseEsNumber(uiMayorista || precioMayorista)
      const capacidadNum = (()=>{
        const raw = String(uiCapacidad||capacidad||'').replace(/[^0-9]/g,'')
        const n = parseInt(raw||'0', 10)
        return Number.isFinite(n) ? n : 0
      })()
      // Validaciones requeridas
      const nombreOk = String(nombreBase||'').trim().length > 0
      const capacidadOk = Number.isFinite(Number(capacidadNum)) && Number(capacidadNum) > 0
      const stockStr = String(stock||'')
      const stockOk = /^[0-9]+$/.test(stockStr)
      const pmOk = Number.isFinite(Number(precioMayoristaNum)) && String(uiMayorista||'').trim().length > 0
      const newErrors = { nombre: !nombreOk, capacidad: !capacidadOk, stock: !stockOk, precioMayorista: !pmOk }
      setErrors(newErrors)
      if (Object.values(newErrors).some(Boolean)) {
        const fields = [
          !nombreOk ? 'Nombre base' : null,
          !capacidadOk ? 'Capacidad' : null,
          !stockOk ? 'Stock' : null,
          !pmOk ? 'Costo unitario (materia prima)' : null,
        ].filter(Boolean).join(', ')
        return swalError(`Completá correctamente: ${fields}`, 'Validación')
      }
      const body = {
        nombre,
        descripcion: `${empaqueLabel(empaque)} ${capacidadNum}${unidad==='kilo'?'Kg':'L'}`,
        unidad,
        marca,
        stock: Math.max(0, parseInt(stock||0,10)),
        precioMayorista: Number(precioMayoristaNum||0),
        precioPublico: 0,
        esMayorista: true,
        rendimientoLitrosPorEmpaque: Math.trunc(Number(uiRendimiento||rendimientoLitrosPorEmpaque||0)),
        imagenUrl: String(imagenUrl||'').trim()
      }
      await api.post('/products', body)
      swalSuccess('Producto mayorista creado')
      setStock(0); setPrecioMayorista(0); setUiMayorista(''); setUiRendimiento(''); setRendimientoLitrosPorEmpaque(0); setImagenUrl(''); setErrors({ nombre:false, precioMayorista:false, stock:false, capacidad:false })
      // Sin cambiar capacidad, sincronizamos UI con el estado actual
      setUiCapacidad(String(capacidadNum>0?capacidadNum:''))
      await loadMayoristas()
    }catch(e){ swalError(e.response?.data?.error || e.message, 'Crear producto mayorista') }
  }

  return (
    <div className="container pt-0 pb-2" style={{ marginTop: 0 }}>
      <h2 className="mb-1">Ingreso mayorista</h2>
      <p className="text-muted mb-2">Cargá productos por paquete, balde o bidón. La unidad se ajusta automáticamente (Kg para pastas, L para líquidos).</p>
      <div className="card">
        <div className="card-body">
          <div className="row g-2">
            <div className="col-md-4">
              <label className="form-label">Categoría</label>
              <select className="form-select" value={categoria} onChange={e=>{ const v=e.target.value; setCategoria(v); setEmpaque(v==='pastas'?'paquete':'bidon') }}>
                <option value="pastas">Pastas</option>
                <option value="liquidos">Líquidos</option>
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">Rendimiento (L por empaque)</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className="form-control"
                placeholder="ej: 100"
                value={uiRendimiento}
                onChange={e=> setUiRendimiento(String(e.target.value||'').replace(/[^0-9]/g,''))}
                onBlur={e=> setRendimientoLitrosPorEmpaque(Math.trunc(Number(String(e.target.value||'').replace(/[^0-9]/g,'')))||0)}
              />
              <small className="text-muted">Ej.: 1 balde 20L → 100 L preparados</small>
            </div>
            <div className="col-md-4">
              <label className="form-label">Empaque</label>
              <select className="form-select" value={empaque} onChange={e=> setEmpaque(e.target.value)}>
                {categoria==='pastas' ? (
                  <>
                    <option value="paquete">Paquete</option>
                    <option value="balde">Balde</option>
                  </>
                ) : (
                  <option value="bidon">Bidón</option>
                )}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">Capacidad ({unidad==='kilo'?'Kg':'L'})</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className={`form-control ${errors.capacidad?'is-invalid':''}`}
                placeholder={unidad==='kilo'?'Kg':'L'}
                value={String(uiCapacidad)}
                onChange={e=>{
                  const v = String(e.target.value||'').replace(/[^0-9]/g,'')
                  setUiCapacidad(v)
                }}
                onFocus={e=>{
                  const v = String(uiCapacidad||'')
                  if (!v || v === '0') {
                    setUiCapacidad('')
                  } else {
                    requestAnimationFrame(()=> e.target.select())
                  }
                }}
                onBlur={e=>{
                  const raw = String(e.target.value||'').replace(/[^0-9]/g,'')
                  const n = parseInt(raw||'0',10)
                  setCapacidad(n)
                  setUiCapacidad(n>0 ? String(n) : '')
                }}
                required
              />
              {errors.capacidad && <div className="invalid-feedback">Ingresá un número mayor a 0</div>}
            </div>
            <div className="col-md-6">
              <label className="form-label">Producto nombre interno materia prima</label>
              <input
                className={`form-control ${errors.nombre?'is-invalid':''}`}
                value={nombreBase}
                onChange={e=> setNombreBase(capitalizeWords(e.target.value))}
                onFocus={e=>{
                  const v = String(nombreBase||'')
                  if (!v || v === 'Producto mayorista') {
                    setNombreBase('')
                  } else {
                    requestAnimationFrame(()=> e.target.select())
                  }
                }}
                required
              />
              {errors.nombre && <div className="invalid-feedback">Campo requerido</div>}
            </div>
            <div className="col-md-6">
              <label className="form-label">Marca (por defecto CLEANPRO)</label>
              <input
                className="form-control"
                value={marca}
                onChange={e=> setMarca(e.target.value)}
                onFocus={e=>{
                  const v = String(marca||'')
                  if (v === 'CLEANPRO') {
                    setMarca('')
                  } else {
                    requestAnimationFrame(()=> e.target.select())
                  }
                }}
              />
              <small className="text-muted">Si es marca comprada, reemplazá este valor.</small>
            </div>
            <div className="col-md-12">
              <label className="form-label">Imagen (local)</label>
              <div className="d-flex position-relative" style={{ gap:8 }}>
                <button type="button" className="btn btn-outline-secondary" onClick={()=> setImageSelectorOpen(true)}>Ver miniaturas</button>
                <button type="button" className="btn btn-outline-primary" onClick={()=> setImageDropdownOpen(prev=> !prev)}>Desplegable con miniaturas</button>
                {imageDropdownOpen && (
                  <div className="card" style={{ position:'absolute', top:'100%', left:0, zIndex:1000, width:'90%', maxHeight:285, overflowY:'auto', boxShadow:'0 6px 12px rgba(0,0,0,0.15)' }}>
                    <div className="list-group list-group-flush">
                      {imageOptions.map(opt=> (
                        <button
                          key={opt.filename}
                          type="button"
                          className="list-group-item list-group-item-action d-flex align-items-center"
                          onClick={()=>{ setImagenUrl(opt.url); setImageDropdownOpen(false); }}
                        >
                          <img src={opt.thumbUrl || opt.url} alt={opt.filename} style={{ height:45, width:45, objectFit:'contain', border:'1px solid #eee', borderRadius:4, marginRight:12 }} />
                          <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', width:'90%' }}>{opt.title || opt.filename}</span>
                        </button>
                      ))}
                      {imageOptions.length === 0 && (
                        <div className="list-group-item text-muted">No hay imágenes disponibles.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <small className="text-muted">Las imágenes vienen de <code>/assets/product-images</code>. Podés agregar archivos allí.</small>
              {imagenUrl && (
                <div style={{ marginTop:4 }}>
                  <img alt="preview" src={imagenUrl} style={{ width:'90%', maxHeight:140, objectFit:'contain', border:'1px solid #ddd', borderRadius:4 }} onError={(ev)=>{ ev.currentTarget.style.display='none' }} />
                </div>
              )}
              {/* Se quita el campo de URL externa: las imágenes se seleccionan desde cargaimagen.json */}
            </div>
            <div className="col-md-4">
              <label className="form-label">Costo unitario (materia prima)</label>
              <input
                type="text"
                inputMode="decimal"
                className={`form-control ${errors.precioMayorista?'is-invalid':''}`}
                placeholder="0,00"
                value={precioVal.valor}
                onChange={e=>{
                  const nuevo = precioVal.setValor(e.target.value)
                  const num = calcularValorNumerico(nuevo)
                  setPrecioMayorista(num)
                }}
                onFocus={e=>{
                  const v = String(precioVal.valor||'')
                  if (!v || v === '0' || v === '0,00') {
                    precioVal.setValor('')
                  } else {
                    requestAnimationFrame(()=> e.target.select())
                  }
                }}
                onBlur={e=>{
                  precioVal.formatearFinal()
                  const n = precioVal.valorNumerico
                  setPrecioMayorista(n)
                  setUiMayorista(fmtNumber(n))
                }}
                required
              />
              {errors.precioMayorista && <div className="invalid-feedback">Campo requerido</div>}
            </div>
            <div className="col-md-4">
              <label className="form-label">Stock (empaques)</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className={`form-control ${errors.stock?'is-invalid':''}`}
                placeholder="0"
                value={String(stock)}
                onChange={e=> {
                  const v = String(e.target.value||'').replace(/[^0-9]/g,'')
                  setStock(v)
                }}
                onFocus={e=>{
                  const v = String(stock||'')
                  if (!v || v === '0') {
                    setStock('')
                  } else {
                    requestAnimationFrame(()=> e.target.select())
                  }
                }}
                required
              />
              {errors.stock && <div className="invalid-feedback">Ingresá un número entero</div>}
              <small className="text-muted d-block mt-1">
                Total a generar por ingreso: <strong>{
                  String(
                    Math.trunc(Number(String(stock||'').replace(/[^0-9]/g,''))||0) * Math.trunc(Number(String(uiRendimiento||rendimientoLitrosPorEmpaque||0).replace(/[^0-9]/g,''))||0)
                  )
                }</strong> L
              </small>
            </div>
          </div>
        </div>
        <div className="card-footer d-flex justify-content-end" style={{gap:8}}>
          <button className="btn btn-primary" onClick={submit}>Crear producto</button>
        </div>
      </div>
      <div className="mt-3">
        <small className="text-muted">Ejemplo de nombre generado: <strong>{nombre}</strong></small>
      </div>
      {/* Grilla de productos mayoristas */}
      <div className="mt-4">
        <h5 className="mb-2">Productos mayoristas</h5>
        <div className="d-flex justify-content-between align-items-center" style={{ gap:12 }}>
          <input className="form-control" style={{ maxWidth: 320 }} placeholder="Buscar por nombre, marca o ID" value={search} onChange={e=> setSearch(e.target.value)} />
          <div className="d-flex" style={{ gap:8 }}>
            <select className="form-select" style={{ maxWidth: 160 }} value={sortField} onChange={e=> setSortField(e.target.value)}>
              <option value="id">Ordenar por ID</option>
              <option value="fecha">Ordenar por fecha</option>
            </select>
            <select className="form-select" style={{ maxWidth: 140 }} value={sortDir} onChange={e=> setSortDir(e.target.value)}>
              <option value="desc">Descendente</option>
              <option value="asc">Ascendente</option>
            </select>
          </div>
        </div>
        <table className="table table-striped tabla-productos uniform-gray" style={{ width:'100%' }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Unidad</th>
              <th>Marca</th>
              <th>Empaques</th>
              <th>Mayorista</th>
              <th>Capacidad (L)</th>
              <th>Imagen</th>
              <th>Fecha</th>
              <th className="text-end">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {(items
              .filter(p=>{
                const q = String(search||'').toLowerCase()
                if(!q) return true
                return String(p.nombre||'').toLowerCase().includes(q) || String(p.marca||'').toLowerCase().includes(q) || String(p.id).includes(q)
              })
              .sort((a,b)=>{
                const A = sortField==='fecha' ? new Date(a.createdAt).getTime() : Number(a.id||0)
                const B = sortField==='fecha' ? new Date(b.createdAt).getTime() : Number(b.id||0)
                return sortDir==='asc' ? A - B : B - A
              })
              ).map(p=> (
              <tr key={p.id}>
                <td>{p.id}</td>
                <td>
                  <div className="d-flex flex-column">
                    <span>{p.nombre}</span>
                    <div className="mt-1">
                      <span className="badge bg-info text-dark">{Math.trunc(Number(p.rendimientoLitrosPorEmpaque||0))} L/emp</span>
                    </div>
                  </div>
                </td>
                <td>{p.unidad}</td>
                <td>{p.marca}</td>
                <td>{Math.trunc(Number(p.stock||0))}</td>
                <td>${fmtNumber(p.precioMayorista)}</td>
                <td>{Math.trunc(Number(p.stock||0)) * Math.trunc(Number(p.rendimientoLitrosPorEmpaque||0))}</td>
                <td>{p.imagenUrl ? <img alt="img" src={p.imagenUrl} style={{ height:32 }} /> : '-'}</td>
                <td>{ (p.createdAt ? new Date(p.createdAt).toLocaleString('es-AR', { dateStyle:'short', timeStyle:'short' }) : '') }</td>
                <td className="text-end" style={{whiteSpace:'nowrap'}}>
                  <button className="btn btn-sm btn-outline-primary me-2" onClick={async ()=>{
                    try {
                      const nombre = await swalPromptText({ title: 'Nombre', defaultValue: p.nombre })
                      if (nombre===null) return
                      const marca = await swalPromptText({ title: 'Marca', defaultValue: p.marca||'' })
                      if (marca===null) return
                      const descripcion = await swalPromptText({ title: 'Descripción', defaultValue: p.descripcion||'' })
                      if (descripcion===null) return
                      // Unidad con validación simple (litro/kilo)
                      let unidad = await swalPromptText({ title: 'Unidad (litro/kilo)', defaultValue: p.unidad })
                      if (unidad===null) return
                      unidad = String(unidad||'').trim().toLowerCase()==='kilo' ? 'kilo' : 'litro'
                      const stockVal = await swalPromptNumber({ title: 'Stock (empaques)', defaultValue: String(Math.trunc(Number(p.stock||0))), integerOnly: true, min: 0 })
                      if (stockVal===null) return
                      const pmayorVal = await swalPromptNumber({ title: 'Precio mayorista', defaultValue: String(p.precioMayorista), min: 0 })
                      if (pmayorVal===null) return
                      // Se elimina precio público del editor de mayorista
                      const rendimientoVal = await swalPromptNumber({ title: 'Rendimiento (L por empaque)', defaultValue: String(p.rendimientoLitrosPorEmpaque||0), integerOnly:true, min: 0 })
                      if (rendimientoVal===null) return
                      const imagenUrl = await swalPromptText({ title: 'Imagen (URL)', defaultValue: p.imagenUrl||'' })
                      if (imagenUrl===null) return
                      const payload = {
                        nombre: String(nombre).trim(),
                        marca: String(marca||'').trim(),
                        descripcion: String(descripcion||'').trim(),
                        unidad,
                        stock: Math.trunc(Number(stockVal)||0),
                        precioMayorista: Number(pmayorVal)||0,
                        // precioPublico no aplica en mayorista
                        esMayorista: true,
                        rendimientoLitrosPorEmpaque: Math.trunc(Number(rendimientoVal)||0),
                        imagenUrl: String(imagenUrl||'').trim()
                      }
                      await api.put(`/products/${p.id}`, payload)
                      await loadMayoristas()
                      await swalSuccess('Producto mayorista actualizado', 'Mayorista')
                    } catch(e) {
                      await swalError(e.response?.data?.error || e.message, 'Editar mayorista')
                    }
                  }}>Editar</button>
                  <button className="btn btn-sm btn-outline-danger" onClick={async ()=>{
                    try {
                      const ok = await swalConfirm({ title: 'Eliminar producto', text: `¿Eliminar ${p.nombre}?` })
                      if(!ok) return
                      await api.delete(`/products/${p.id}`)
                      await loadMayoristas()
                      await swalSuccess('Producto mayorista eliminado')
                    } catch(e) {
                      await swalError(e.response?.data?.error || e.message, 'Eliminar mayorista')
                    }
                  }}>Eliminar</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={10} className="text-center text-muted">No hay productos mayoristas cargados.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {/* Modal selector de miniaturas */}
      {imageSelectorOpen && (
        <div className="modal fade show" style={{ display:'block', backgroundColor:'rgba(0, 174, 255, 0.22)', backdropFilter:'blur(4px)' }}>
      <div className="modal-dialog modal-xl" style={{ maxWidth:'98vw', marginTop:'1vh' }}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Elegir imagen</h5>
                <button type="button" className="btn-close" onClick={()=> setImageSelectorOpen(false)}></button>
              </div>
              <div className="modal-body" style={{ maxHeight:'60vh', overflowY:'auto' }}>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <button className="btn btn-outline-success" onClick={()=> setUploadModalOpen(true)}>Agregar imagen</button>
                </div>
                {imageOptions.length === 0 && (
                  <div className="text-muted">No hay imágenes en <code>/backend/assets/product-images</code>.</div>
                )}
                <div className="row row-cols-2 row-cols-md-5 g-1" style={{ gap:0 }}>
                  {imageOptions.map(opt=> (
                    <div key={opt.filename} className="col">
                      <div className="card h-100">
                        <div className="card-body d-flex flex-column align-items-center" style={{ padding: 1, width: '100%' }}>
                          <div className="desc-badge mb-1">{opt.title || opt.filename}</div>
                          <div className="position-relative w-100" style={{ maxHeight:400 }}>
                            <img
                              src={opt.thumbUrl || opt.url}
                              alt={opt.filename}
                              style={{ maxHeight:400, width:'100%', objectFit:'contain', cursor:'pointer' }}
                              onClick={()=>{ setImagenUrl(opt.url); setImageSelectorOpen(false); }}
                            />
                            {/* Banda diagonal naranja "clean pro" */}
                            <div className="position-absolute" style={{ top:'50%', left:'50%', transform:'translate(-50%, -50%) rotate(-18deg)', background:'rgba(255,140,0,0.95)', color:'#fff', padding:'3px 8px', borderRadius:4, boxShadow:'0 2px 6px rgba(0,0,0,0.25)', pointerEvents:'none', whiteSpace:'nowrap', width:'70%', textAlign:'center' }}>
                              <span style={{ color:'#fff', fontWeight:700, letterSpacing:0.5 }}>clean</span>
                              <span style={{ color:'#ffeb3b', fontWeight:700, marginLeft:6, letterSpacing:0.5 }}>pro</span>
                            </div>
                          </div>
                          <div className="mt-auto w-100">
                            <button className="btn btn-sm btn-outline-warning w-100 rounded-3 border-2 shadow-sm fw-semibold d-flex align-items-center justify-content-center gap-2 edit-btn" onClick={()=> editImageMetadata(opt)}>
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
                                <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-9.5 9.5a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l9.5-9.5Z"/>
                                <path d="M11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5ZM10.5 3.207 12.793 5.5 5.854 12.439a.5.5 0 0 1-.168.11l-3.5 1.4 1.4-3.5a.5.5 0 0 1 .11-.168L10.5 3.207Z"/>
                              </svg>
                              <span>Editar</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={()=> setImageSelectorOpen(false)}>Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {uploadModalOpen && (
        <div className="modal fade show" style={{ display:'block', position:'fixed', inset:0, backgroundColor:'rgba(0,0,0,0.25)', backdropFilter:'blur(4px)', zIndex:2000 }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Subir imagen</h5>
                <button type="button" className="btn-close" onClick={()=> setUploadModalOpen(false)}></button>
              </div>
              <div className="modal-body">
                <div className="d-grid" style={{ gap:8 }}>
                  <input type="file" accept=".png,.jpg,.jpeg,.webp,.gif,.svg" className="form-control" onChange={e=> setNewImageFile(e.target.files?.[0] || null)} />
                  <input type="text" className="form-control" placeholder="Nombre / título" value={newImageTitle} onChange={e=> setNewImageTitle(e.target.value)} />
                  <input type="text" className="form-control" placeholder="Descripción (opcional)" value={newImageDesc} onChange={e=> setNewImageDesc(e.target.value)} />
                  <div>
                    <button className="btn btn-outline-success" disabled={uploading} onClick={uploadImage}>{uploading?'Subiendo…':'Subir imagen'}</button>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={()=> setUploadModalOpen(false)}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}