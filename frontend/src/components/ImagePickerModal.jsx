import { useEffect, useState } from 'react'
import api from '../api'

export default function ImagePickerModal({ visible, onClose, onSelect }){
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')

  useEffect(()=>{
    if (!visible) return
    const load = async ()=>{
      setLoading(true); setError('')
      try{
        const res = await api.get('/images/product-images')
        setImages(Array.isArray(res.data) ? res.data : [])
      }catch(e){ setError(e.response?.data?.error || e.message) }
      finally{ setLoading(false) }
    }
    load()
  }, [visible])

  if (!visible) return null
  const filtered = images.filter(it=>{
    const s = String(q||'').toLowerCase(); if(!s) return true
    const title = String(it.title||'').toLowerCase()
    const fn = String(it.filename||'').toLowerCase()
    return title.includes(s) || fn.includes(s)
  })

  return (
    <div className="modal fade show" style={{ display:'block', backgroundColor:'rgba(0,0,0,0.4)' }}>
      <div className="modal-dialog modal-xl" style={{ maxWidth:'95vw' }}>
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Elegir imagen</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body" style={{ maxHeight:'65vh', overflowY:'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <input className="form-control" style={{ maxWidth:320 }} placeholder="Buscar por nombre" value={q} onChange={e=> setQ(e.target.value)} />
              {loading && <span className="text-muted">Cargando...</span>}
            </div>
            {error && <div className="alert alert-danger">{error}</div>}
            <table className="table table-hover">
              <thead><tr><th>Miniatura</th><th>Archivo</th><th>Título</th><th className="text-end">Acciones</th></tr></thead>
              <tbody>
                {filtered.map(it=> (
                  <tr key={it.filename}>
                    <td><img src={it.thumbUrl || it.url} alt={it.filename} style={{ height:52, width:52, objectFit:'contain', border:'1px solid #eee', borderRadius:4 }} /></td>
                    <td>{it.filename}</td>
                    <td>{it.title || '-'}</td>
                    <td className="text-end">
                      <button className="btn btn-sm btn-primary" onClick={()=> onSelect && onSelect(it)}>Usar</button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={4} className="text-center text-muted">No hay imágenes disponibles.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  )
}