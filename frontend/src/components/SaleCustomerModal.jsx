import React from 'react'
import api from '../api'
import { swalError, swalSuccess } from './swal'
import './saleModal.css'

export default function SaleCustomerModal({
  visible,
  onClose,
  cliente,
  setCliente,
  destino,
  setDestino,
  customers,
  setCustomers,
  clienteId,
  setClienteId,
  destinations,
  setDestinations,
  setDestinoId,
  setBillToText,
  setShipToText,
}){
  if (!visible) return null

  const handleSave = async ()=>{
    try {
      const doc = String(cliente.documento||'').trim()
      let currentCustomers = customers
      if (!clienteId && doc && (!Array.isArray(currentCustomers) || currentCustomers.length === 0)) {
        try {
          const cs = await api.get('/customers')
          currentCustomers = cs.data || []
          setCustomers(currentCustomers)
        } catch {}
      }
      const matchByDoc = doc ? (currentCustomers.find(c => String(c.documento||'').trim() === doc) || null) : null
      let currentClienteId = clienteId || (matchByDoc ? matchByDoc.id : null)
      if (currentClienteId) {
        await api.put(`/customers/${currentClienteId}`, cliente)
      } else {
        const clienteRes = await api.post('/customers', cliente)
        currentClienteId = clienteRes.data.id
        setClienteId(currentClienteId)
      }
      // No persistimos el destino creado desde Ventas: es temporal para este comprobante
      // Si el usuario selecciona un destino existente desde el picker, ese sí se mantiene.
      const billLines = [
        cliente.nombre ? `Nombre: ${cliente.nombre}` : null,
        cliente.direccion ? `Dirección: ${cliente.direccion}` : null,
        cliente.ciudad ? `Localidad/Partido: ${cliente.ciudad}` : null,
        cliente.telefono ? `Teléfono: ${cliente.telefono}` : null,
        cliente.documento ? `CUIT/DNI: ${cliente.documento}` : null,
      ].filter(Boolean)
      const shipLines = []
      setBillToText(billLines.join('\n'))
      setShipToText(shipLines.join('\n'))
      onClose()
      swalSuccess('Cliente guardado', 'Cliente')
    } catch (err) {
      swalError(err.response?.data?.error || err.message, 'Cliente')
    }
  }

  return (
    <div className="sale-modal-overlay">
      <div className="card sale-modal-card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Datos de cliente</h5>
          <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>Cerrar</button>
        </div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-6">
              <h6 className="mb-2">Cliente</h6>
              <div className="mb-2">
                <label className="form-label">Nombre</label>
                <input className="form-control" value={cliente.nombre} onChange={e=> setCliente({...cliente, nombre:e.target.value})} />
              </div>
              <div className="mb-2">
                <label className="form-label">Dirección</label>
                <input className="form-control" value={cliente.direccion} onChange={e=> setCliente({...cliente, direccion:e.target.value})} />
              </div>
              <div className="mb-2">
                <label className="form-label">Localidad/Partido</label>
                <input className="form-control" value={cliente.ciudad} onChange={e=> setCliente({...cliente, ciudad:e.target.value})} />
              </div>
              <div className="mb-2">
                <label className="form-label">Teléfono</label>
                <input className="form-control" value={cliente.telefono||''} onChange={e=> setCliente({...cliente, telefono:e.target.value})} />
              </div>
              <div className="mb-2">
                <label className="form-label">CUIT/DNI</label>
                <input className="form-control" value={cliente.documento} onChange={e=> setCliente({...cliente, documento:e.target.value})} />
              </div>
            </div>
            {/* Bloque Destino removido: sólo se usan datos del Cliente */}
          </div>
        </div>
        <div className="card-footer d-flex justify-content-end sale-modal-footer">
          <button className="btn btn-outline-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave}>Guardar</button>
        </div>
      </div>
    </div>
  )
}