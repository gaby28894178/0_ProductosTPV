// Utilidad de dinero para es-AR: miles con punto y decimales con coma
// - formatEsMoneyLive: formatea en vivo mientras se escribe, siempre 2 decimales
// - parseEsNumber: convierte texto con formato es-AR a número JS
// - formatEs: formatea un número a es-AR con 2 decimales

export function parseEsNumber(s){
  const raw = String(s||'')
    .trim()
    .replace(/\./g, '')
    .replace(',', '.')
  const n = parseFloat(raw)
  return Number.isFinite(n) ? n : 0
}

export function formatEsMoneyLive(s){
  const raw = String(s || '').replace(/[^\d.,]/g, '')
  if (!raw) return ''
  const lastDot = raw.lastIndexOf('.')
  const lastComma = raw.lastIndexOf(',')
  const sepIndex = Math.max(lastDot, lastComma)
  let intRaw, decRaw, hasSep
  if (sepIndex >= 0) {
    hasSep = true
    intRaw = raw.slice(0, sepIndex).replace(/[^0-9]/g, '')
    decRaw = raw.slice(sepIndex + 1).replace(/[^0-9]/g, '').slice(0, 2)
  } else {
    hasSep = false
    intRaw = raw.replace(/[^0-9]/g, '')
    decRaw = ''
  }
  intRaw = intRaw.replace(/^0+(?=\d)/, '')
  if (intRaw === '') intRaw = '0'
  const intFormatted = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  if (hasSep) {
    return decRaw.length ? `${intFormatted},${decRaw}` : `${intFormatted},`
  }
  return intFormatted
}

export function formatEs(n){
  const num = Number(n)||0
  return new Intl.NumberFormat('es-AR', { minimumFractionDigits:2, maximumFractionDigits:2 }).format(num)
}