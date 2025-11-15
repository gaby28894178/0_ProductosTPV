import { useEffect, useState } from 'react'
import api from '../api'
import { swalConfirm, swalError, swalSuccess, swalPromptText, swalSelectList, swalCreateDestination, swalInfo } from '../components/swal'

export default function Clientes(){
  const [items, setItems] = useState([])
  const [form, setForm] = useState({ nombre:'', email:'', telefono:'', direccion:'', ciudad:'', documento:'' })
  const [selected, setSelected] = useState(new Set())
  const [error, setError] = useState('')
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailForm, setEmailForm] = useState({ subject:'', html:'', emails:'', folleto:null, preset:[] })
  const [presetEmails, setPresetEmails] = useState([])
  const [sending, setSending] = useState(false)
  // Edición con modal y selector de destinos
  const [showEditModal, setShowEditModal] = useState(false)
  const [editCliente, setEditCliente] = useState(null)
  const [destinations, setDestinations] = useState([])
  const [destQuery, setDestQuery] = useState('')
  const [selectedDestinationId, setSelectedDestinationId] = useState(null)
  const [newDest, setNewDest] = useState({ nombre:'', direccion:'', ciudad:'' })

  const load = async ()=>{
    setError('')
    try{ const res = await api.get('/customers'); setItems(res.data) }catch(e){ setError(e.response?.data?.error || e.message) }
  }
  useEffect(()=>{ load() }, [])

  // Cargar correos preconfigurados desde backend (/config/emails)
  useEffect(()=>{
    const loadPreset = async ()=>{
      try{
        const res = await api.get('/config/emails')
        const arr = Array.isArray(res.data?.emails) ? res.data.emails : []
        setPresetEmails(arr)
      }catch{}
    }
    loadPreset()
  }, [])

  const submit = async e=>{
    e.preventDefault(); setError('')
    try{ await api.post('/customers', form); setForm({ nombre:'', email:'', telefono:'', direccion:'', ciudad:'', documento:'' }); await load() }catch(e){ setError(e.response?.data?.error || e.message) }
  }

  const edit = async (c)=>{
    setEditCliente({ ...c })
    setShowEditModal(true)
    // Cargar destinos del cliente
    try{
      const ds = await api.get('/destinations')
      const own = (ds.data || []).filter(d=> d.customerId === c.id)
      setDestinations(own)
      setSelectedDestinationId(own[0]?.id || null)
      setNewDest({ nombre:'', direccion:'', ciudad:'', contacto:'' })
    }catch(e){ console.warn('Destinations load error', e) }
  }

  const del = async (id)=>{
    const ok = await swalConfirm({ title:'Eliminar cliente', text:'¿Seguro que querés eliminar este cliente?' })
    if (!ok) return
    try{ await api.delete(`/customers/${id}`); await load(); await swalSuccess('Cliente eliminado') }catch(e){ await swalError(e.response?.data?.error || e.message) }
  }

  const toggle = id=>{
    const s = new Set(selected)
    s.has(id) ? s.delete(id) : s.add(id)
    setSelected(s)
  }

  const enviarPublicidad = ()=>{
    if (selected.size === 0) { swalError('Seleccioná al menos un cliente', 'Aviso'); return }
    setEmailForm({ subject:'', html:'', emails:'', folleto:null, preset:[] })
    setShowEmailModal(true)
  }

  const submitPublicidad = async ()=>{
    if (sending) return
    const { subject, html, emails, folleto, preset } = emailForm
    if (!subject.trim() || !(html && html.trim())) { swalError('Completá asunto y mensaje'); return }
    setSending(true)
    try {
      const ids = Array.from(selected)
      const fd = new FormData()
      fd.append('ids', JSON.stringify(ids))
      fd.append('subject', subject.trim())
      fd.append('html', html)
      // Unificar correos: preseleccionados + adicionales escritos (separados por coma)
      const extra = (emails || '').split(',').map(e=>e.trim()).filter(Boolean)
      const all = [...(Array.isArray(preset)?preset:[]), ...extra]
      const joined = all.filter(Boolean).join(',')
      if (joined) fd.append('emails', joined)
      if (folleto) fd.append('folleto', folleto)
      const res = await api.post('/customers/bulk-email', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      const list = res.data.recipients?.join(', ') || ''
      await swalSuccess(`Correo enviado a ${res.data.count} destinatarios${list ? `:\n${list}` : ''}`)
      setShowEmailModal(false)
    } catch (e) {
      await swalError(e.response?.data?.error || e.message)
    } finally { setSending(false) }
  }

  return (
    <div className="container py-3 mt-2">
      <h2>Clientes</h2>
      {error && <div className="alert alert-danger">{error}</div>}
      <div className="card mb-3">
        <div className="card-header">Crear cliente</div>
        <form className="card-body" onSubmit={submit} style={{ display:'grid', gap:8 }}>
          <div className="row g-2">
            <div className="col-md-4"><label>Nombre <input className="form-control" value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})} required /></label></div>
            <div className="col-md-4"><label>Email <input className="form-control" type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></label></div>
            <div className="col-md-4"><label>Teléfono <input className="form-control" value={form.telefono} onChange={e=>setForm({...form,telefono:e.target.value})} /></label></div>
          </div>
          <div className="row g-2">
            <div className="col-md-4"><label>Dirección <input className="form-control" value={form.direccion} onChange={e=>setForm({...form,direccion:e.target.value})} /></label></div>
            <div className="col-md-4"><label>Ciudad <input className="form-control" value={form.ciudad} onChange={e=>setForm({...form,ciudad:e.target.value})} /></label></div>
            <div className="col-md-4"><label>CUIT/DNI <input className="form-control" value={form.documento} onChange={e=>setForm({...form,documento:e.target.value})} /></label></div>
          </div>
          <div className="d-flex justify-content-end" style={{ gap: 8 }}>
            <button className="btn btn-primary" type="submit">Guardar</button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <span>Listado</span>
          <div className="d-flex" style={{ gap: 8 }}>
            <button className="btn btn-success" onClick={enviarPublicidad}>Enviar publicidad</button>
          </div>
        </div>
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-striped">
              <thead>
                <tr>
                  <th><input type="checkbox" onChange={e=>{
                    const checked = e.target.checked
                    setSelected(checked ? new Set(items.map(i=>i.id)) : new Set())
                  }} /></th>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Teléfono</th>
                  <th>Ciudad</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map(c=> (
                  <tr key={c.id}>
                    <td><input type="checkbox" checked={selected.has(c.id)} onChange={()=>toggle(c.id)} /></td>
                    <td>{c.nombre}</td>
                    <td>{c.email || '-'}</td>
                    <td>{c.telefono || '-'}</td>
                    <td>{c.ciudad || '-'}</td>
                    <td>
                      <button className="btn btn-sm btn-outline-primary me-2" onClick={()=>edit(c)}>Editar</button>
                      <button className="btn btn-sm btn-outline-danger" onClick={()=>del(c.id)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal edición de cliente con selector de destino */}
      {showEditModal && editCliente && (
        <div className="modal d-block" tabIndex="-1" style={{ background:'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Editar cliente y destino</h5>
                <button type="button" className="btn-close" onClick={()=> setShowEditModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-md-6">
                    <h6>Cliente</h6>
                    <div className="mb-2"><label className="form-label">Nombre<input className="form-control" value={editCliente.nombre} onChange={e=> setEditCliente({...editCliente, nombre:e.target.value})} /></label></div>
                    <div className="mb-2"><label className="form-label">Email<input className="form-control" type="email" value={editCliente.email||''} onChange={e=> setEditCliente({...editCliente, email:e.target.value})} /></label></div>
                    <div className="mb-2"><label className="form-label">Teléfono<input className="form-control" value={editCliente.telefono||''} onChange={e=> setEditCliente({...editCliente, telefono:e.target.value})} /></label></div>
                    <div className="mb-2"><label className="form-label">Dirección<input className="form-control" value={editCliente.direccion||''} onChange={e=> setEditCliente({...editCliente, direccion:e.target.value})} /></label></div>
                    <div className="mb-2"><label className="form-label">Ciudad<input className="form-control" value={editCliente.ciudad||''} onChange={e=> setEditCliente({...editCliente, ciudad:e.target.value})} /></label></div>
                    <div className="mb-2"><label className="form-label">CUIT/DNI<input className="form-control" value={editCliente.documento||''} onChange={e=> setEditCliente({...editCliente, documento:e.target.value})} /></label></div>
                  </div>
                  <div className="col-md-6">
                    <h6>Destinos del cliente</h6>
                    <div className="d-flex" style={{gap:8}}>
                      <button className="btn btn-outline-primary" onClick={async ()=>{
                        const opts = destinations.map(d=>({ id:String(d.id), label:d.nombre, sub:`${d.direccion || ''} • ${d.ciudad || ''}` }))
                        if (opts.length === 0) { await swalInfo('No hay destinos cargados'); return }
                        const sel = await swalSelectList({ title:'Seleccionar destino', options: opts, placeholder:'Buscar destino...' })
                        if (sel) setSelectedDestinationId(Number(sel))
                      }}>Buscar/Seleccionar destino</button>
                      <button className="btn btn-outline-success" onClick={async ()=>{
                        const data = await swalCreateDestination({ title:'Nuevo destino' })
                        if (!data) return
                        try{
                          const created = await api.post('/destinations', { ...data, customerId: editCliente.id })
                          const d = created.data
                          setDestinations(prev=> [d, ...prev])
                          setSelectedDestinationId(d.id)
                          await swalSuccess('Destino creado')
                        }catch(e){ await swalError(e.response?.data?.error || e.message, 'Destino') }
                      }}>Crear destino</button>
                    </div>
                    <div className="mt-2">
                      <small className="text-muted">Seleccionado: {selectedDestinationId ? destinations.find(d=>d.id===selectedDestinationId)?.nombre : 'ninguno'}</small>
                    </div>
                    <div className="mt-2 p-2 border rounded">
                      <div className="mb-2"><label className="form-label">Nuevo destino – Nombre<input className="form-control" value={newDest.nombre} onChange={e=> setNewDest({...newDest, nombre:e.target.value})} /></label></div>
                      <div className="mb-2"><label className="form-label">Dirección de destino<input className="form-control" value={newDest.direccion} onChange={e=> setNewDest({...newDest, direccion:e.target.value})} /></label></div>
                      <div className="mb-2"><label className="form-label">Localidad/Partido<input className="form-control" value={newDest.ciudad} onChange={e=> setNewDest({...newDest, ciudad:e.target.value})} /></label></div>
                      <div className="d-flex justify-content-end" style={{gap:8}}>
                        <button className="btn btn-outline-secondary" onClick={()=> setNewDest({ nombre:'', direccion:'', ciudad:'' })}>Limpiar</button>
                        <button className="btn btn-outline-primary" onClick={async ()=>{
                          try{
                            if (!newDest.nombre.trim()) { await swalError('Nombre requerido','Destino'); return }
                            const created = await api.post('/destinations', { ...newDest, contacto: newDest.nombre, customerId: editCliente.id })
                            const d = created.data
                            setDestinations(prev=> [d, ...prev])
                            setSelectedDestinationId(d.id)
                            await swalSuccess('Destino creado')
                          }catch(e){ await swalError(e.response?.data?.error || e.message, 'Destino') }
                        }}>Crear destino</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={()=> setShowEditModal(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={async ()=>{
                  try{
                    const { nombre, email, telefono, direccion, ciudad, documento } = editCliente
                    await api.put(`/customers/${editCliente.id}`, { nombre, email, telefono, direccion, ciudad, documento })
                    await load()
                    await swalSuccess('Cliente actualizado')
                    setShowEditModal(false)
                  }catch(e){ await swalError(e.response?.data?.error || e.message) }
                }}>Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal envío de publicidad */}
      {showEmailModal && (
        <div className="modal d-block" tabIndex="-1" style={{ background:'rgba(0,0,0,0.4)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Enviar publicidad</h5>
                <button type="button" className="btn-close" onClick={()=>setShowEmailModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="mb-2">
                  <label className="form-label">Asunto</label>
                  <input className="form-control" value={emailForm.subject} onChange={e=>setEmailForm({...emailForm, subject: e.target.value})} />
                </div>
                <div className="mb-2">
                  <label className="form-label">Mensaje (HTML permitido)</label>
                  <textarea className="form-control" rows="4" value={emailForm.html} onChange={e=>setEmailForm({...emailForm, html: e.target.value})}></textarea>
                </div>
                <div className="mb-2">
                  <label className="form-label">Destinatarios (múltiple, preconfigurados)</label>
                  <select multiple className="form-select" value={emailForm.preset} onChange={e=>setEmailForm({...emailForm, preset: Array.from(e.target.selectedOptions).map(o=>o.value)})}>
                    {presetEmails.length === 0 && (<option value="">Sin correos configurados</option>)}
                    {presetEmails.map((em,i)=> (<option key={i} value={em}>{em}</option>))}
                  </select>
                  {presetEmails.length === 0 && (
                    <div className="text-muted small mt-1">Tip: Configurá `DEFAULT_EMAILS` o `SMTP_FROM` en el backend para poblar el selector. Podés elegir múltiples con Ctrl/Cmd.</div>
                  )}
                </div>
                <div className="mb-2">
                  <label className="form-label">Correos adicionales (separados por coma)</label>
                  <input className="form-control" placeholder="ej: uno@mail.com, dos@mail.com" value={emailForm.emails} onChange={e=>setEmailForm({...emailForm, emails: e.target.value})} />
                </div>
                <div className="mb-2">
                  <label className="form-label">Folleto (imagen)</label>
                  <input className="form-control" type="file" accept="image/*" onChange={e=>setEmailForm({...emailForm, folleto: e.target.files?.[0] || null})} />
                </div>
                <div className="alert alert-info">
                  Destinatarios seleccionados ({selected.size}): {Array.from(selected).map(id => items.find(i=>i.id===id)?.email).filter(Boolean).join(', ') || 'sin emails cargados'}
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={()=>setShowEmailModal(false)} disabled={sending}>Cancelar</button>
                <button className="btn btn-primary" onClick={submitPublicidad} disabled={sending}>{sending ? 'Enviando...' : 'Enviar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}