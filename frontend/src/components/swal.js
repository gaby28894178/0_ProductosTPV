import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'

export const swalError = (message, title = 'Error') => {
  return Swal.fire({ icon: 'error', title, text: String(message || 'Ocurrió un error') })
}

export const swalSuccess = (message, title = 'Listo') => {
  return Swal.fire({ icon: 'success', title, text: String(message || 'Operación exitosa') })
}

export const swalInfo = (message, title = 'Aviso') => {
  return Swal.fire({ icon: 'info', title, text: String(message || '') })
}

export const swalConfirm = async ({ title = 'Confirmar', text = '', confirmButtonText = 'Confirmar', cancelButtonText = 'Cancelar' } = {}) => {
  const res = await Swal.fire({ icon: 'question', title, text, showCancelButton: true, confirmButtonText, cancelButtonText })
  return res.isConfirmed
}

export const swalPromptNumber = async ({
  title = 'Ingrese un número',
  inputLabel = '',
  defaultValue = '',
  min = null,
  max = null,
  integerOnly = false,
} = {}) => {
  const opts = integerOnly
    ? {
        input: 'text',
        inputAttributes: { inputmode: 'numeric', pattern: '[0-9]*' },
      }
    : {
        input: 'number',
        inputAttributes: { step: 'any' },
      }
  const res = await Swal.fire({
    title,
    inputLabel,
    inputValue: defaultValue,
    showCancelButton: true,
    confirmButtonText: 'Aceptar',
    cancelButtonText: 'Cancelar',
    ...opts,
    inputValidator: (value) => {
      if (value === '' || value === null) return 'Ingrese un valor'
      const raw = String(value)
      if (integerOnly) {
        if (!/^[0-9]+$/.test(raw)) return 'Ingrese un número entero'
        const num = parseInt(raw, 10)
        if (min !== null && num < min) return `Debe ser ≥ ${min}`
        if (max !== null && num > max) return `Debe ser ≤ ${max}`
        return undefined
      } else {
        const num = Number(raw)
        if (!Number.isFinite(num)) return 'Valor inválido'
        if (min !== null && num < min) return `Debe ser ≥ ${min}`
        if (max !== null && num > max) return `Debe ser ≤ ${max}`
        return undefined
      }
    },
  })
  if (res.isConfirmed) return integerOnly ? parseInt(String(res.value), 10) : Number(res.value)
  return null
}

export const swalPromptText = async ({ title = 'Ingrese texto', inputLabel = '', defaultValue = '', placeholder = '' } = {}) => {
  const res = await Swal.fire({
    title,
    input: 'text',
    inputLabel,
    inputValue: defaultValue,
    inputPlaceholder: placeholder,
    showCancelButton: true,
    confirmButtonText: 'Aceptar',
    cancelButtonText: 'Cancelar',
    inputValidator: (v) => (!v || !String(v).trim() ? 'Ingrese un valor' : undefined),
  })
  return res.isConfirmed ? res.value : null
}

// Selector con búsqueda en SweetAlert: recibe opciones [{id,label,sub}] y devuelve id seleccionado
export const swalSelectList = async ({ title = 'Seleccionar', options = [], placeholder = 'Buscar...' } = {}) => {
  const html = `
    <div style="text-align:left">
      <input id="swal-search" class="swal2-input" placeholder="${placeholder}">
      <div id="swal-list" style="max-height:300px; overflow:auto; text-align:left"></div>
    </div>`
  let selectedId = null
  const result = await Swal.fire({
    title,
    html,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Seleccionar',
    cancelButtonText: 'Cancelar',
    width: 600,
    didOpen: () => {
      const $search = document.getElementById('swal-search')
      const $list = document.getElementById('swal-list')
      const render = (q='') => {
        const norm = String(q).trim().toLowerCase()
        const filtered = options.filter(o => !norm || (String(o.label||'').toLowerCase().includes(norm) || String(o.sub||'').toLowerCase().includes(norm)))
        $list.innerHTML = filtered.map(o => `
          <div class="swal2-actions" style="display:flex; justify-content:space-between; align-items:center; padding:6px 10px; border-bottom:1px solid #eee; cursor:pointer" data-id="${o.id}">
            <div>
              <div style="font-weight:600">${o.label}</div>
              ${o.sub ? `<div style="font-size:12px; color:#666">${o.sub}</div>` : ''}
            </div>
            ${selectedId===o.id ? '<span class="swal2-confirm" style="padding:4px 8px">Seleccionado</span>' : ''}
          </div>
        `).join('')
        Array.from($list.querySelectorAll('[data-id]')).forEach(el => {
          el.addEventListener('click', () => { selectedId = el.getAttribute('data-id'); render($search.value) })
        })
      }
      $search.addEventListener('input', e => render(e.target.value))
      render('')
      $search.focus()
    },
    preConfirm: () => {
      if (!selectedId) {
        Swal.showValidationMessage('Elegí un elemento de la lista')
        return false
      }
      return selectedId
    }
  })
  return result.isConfirmed ? result.value : null
}

// Formulario estilo SweetAlert para crear destino
export const swalCreateDestination = async ({ title='Nuevo destino' } = {}) => {
  const html = `
    <div style="text-align:left">
      <label>Nombre<input id="dest-nombre" class="swal2-input"></label>
      <label>Dirección de destino<input id="dest-direccion" class="swal2-input"></label>
      <label>Localidad/Partido<input id="dest-ciudad" class="swal2-input"></label>
    </div>`
  const res = await Swal.fire({
    title,
    html,
    showCancelButton: true,
    confirmButtonText: 'Crear',
    cancelButtonText: 'Cancelar',
    preConfirm: () => {
      const nombre = document.getElementById('dest-nombre')?.value?.trim()
      if (!nombre) { Swal.showValidationMessage('Nombre requerido'); return false }
      const direccion = document.getElementById('dest-direccion')?.value?.trim() || ''
      const ciudad = document.getElementById('dest-ciudad')?.value?.trim() || ''
      // contacto se iguala al nombre para compatibilidad backend, pero no se muestra
      const contacto = nombre
      return { nombre, direccion, ciudad, contacto }
    }
  })
  return res.isConfirmed ? res.value : null
}