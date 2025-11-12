import { useState, useCallback } from 'react'

export const calcularValorNumerico = (valorFormateado) => {
  if (!valorFormateado) return 0
  const s = String(valorFormateado).replace(/[^\d.,]/g, '')
  if (!s) return 0
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  const idx = lastComma !== -1 ? lastComma : (lastDot !== -1 && (s.length - lastDot - 1) <= 2 ? lastDot : -1)
  if (idx === -1) {
    const entero = s.replace(/[^\d]/g, '')
    const n = parseFloat(entero || '0')
    return Number.isFinite(n) ? n : 0
  }
  const entero = s.slice(0, idx).replace(/[^\d]/g, '')
  const decimal = s.slice(idx + 1).replace(/[^\d]/g, '')
  const n = parseFloat(`${entero || '0'}.${decimal || '0'}`)
  return Number.isFinite(n) ? n : 0
}

const useValidadorPrecios = (valorInicial = '', opciones = {}) => {
  const { decimales = 2 } = opciones
  const [valor, setValor] = useState(valorInicial)
  const [valorNumerico, setValorNumerico] = useState(0)

  const esFormatoValidoEscritura = (val) => {
    if (val === '') return true
    // Permitir cualquier mezcla de dígitos, puntos y comas durante la escritura
    const regexBasico = /^[\d.,]*$/
    return regexBasico.test(val)
  }

  const formatearParteEntera = (parteEntera) => {
    let resultado = ''
    let contador = 0
    for (let i = parteEntera.length - 1; i >= 0; i--) {
      if (contador === 3) { resultado = '.' + resultado; contador = 0 }
      resultado = parteEntera[i] + resultado
      contador++
    }
    return resultado
  }

  const formatearFinal = useCallback(() => {
    if (!valor) return
    const s = valor.replace(/[^\d.,]/g, '')
    const lastComma = s.lastIndexOf(',')
    const lastDot = s.lastIndexOf('.')
    const idx = lastComma !== -1 ? lastComma : (lastDot !== -1 && (s.length - lastDot - 1) <= decimales ? lastDot : -1)
    let enteroDigits = ''
    let decimalDigits = ''
    if (idx === -1) {
      enteroDigits = s.replace(/[^\d]/g, '')
    } else {
      enteroDigits = s.slice(0, idx).replace(/[^\d]/g, '')
      decimalDigits = s.slice(idx + 1).replace(/[^\d]/g, '')
    }
    const parteEntera = formatearParteEntera(enteroDigits || '0')
    const parteDecimal = (decimalDigits || '').padEnd(decimales, '0').substring(0, decimales)
    const valorFinal = parteEntera + ',' + parteDecimal
    setValor(valorFinal)
    const numValor = parseFloat((enteroDigits || '0') + '.' + (parteDecimal || '0'))
    setValorNumerico(Number.isFinite(numValor) ? numValor : 0)
  }, [valor, decimales])

  const validarYFormatear = useCallback((inputValor) => {
    let s = String(inputValor||'').replace(/[^\d.,]/g, '')
    if (!esFormatoValidoEscritura(s)) return valor
    if (s === '') {
      setValor(''); setValorNumerico(0); return ''
    }
    const lastComma = s.lastIndexOf(',')
    const lastDot = s.lastIndexOf('.')
    const idx = lastComma !== -1 ? lastComma : (lastDot !== -1 && (s.length - lastDot - 1) <= decimales ? lastDot : -1)
    const lastChar = s[s.length-1]
    const hasTrailingSep = lastChar === ',' || lastChar === '.'
    let enteroDigits = ''
    let decimalDigits = ''
    if (idx === -1) {
      enteroDigits = s.replace(/[^\d]/g, '')
    } else {
      enteroDigits = s.slice(0, idx).replace(/[^\d]/g, '')
      decimalDigits = s.slice(idx + 1).replace(/[^\d]/g, '')
    }
    const parteEntera = formatearParteEntera(enteroDigits)
    let valorFormateado = parteEntera
    if (hasTrailingSep && decimalDigits === '') {
      valorFormateado += ','
    } else if (decimalDigits !== '') {
      valorFormateado += ',' + decimalDigits.substring(0, decimales)
    }
    setValor(valorFormateado)
    const num = parseFloat((enteroDigits || '0') + '.' + (decimalDigits ? decimalDigits.substring(0, decimales) : '0'))
    setValorNumerico(Number.isFinite(num) ? num : 0)
    return valorFormateado
  }, [valor, decimales])

  const establecerValor = useCallback((nuevoValorNumerico) => {
    const valorString = Number(nuevoValorNumerico||0).toFixed(decimales)
    const partes = valorString.split('.')
    let parteEntera = formatearParteEntera(partes[0])
    const parteDecimal = partes[1]
    const valorFinal = parteEntera + ',' + parteDecimal
    setValor(valorFinal)
    setValorNumerico(Number(nuevoValorNumerico||0))
  }, [decimales])

  return { valor, valorNumerico, setValor: validarYFormatear, formatearFinal, establecerValor }
}

export default useValidadorPrecios