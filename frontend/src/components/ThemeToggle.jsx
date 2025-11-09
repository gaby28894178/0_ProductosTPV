import { useEffect, useMemo, useState } from 'react'

// Toggle de tema con switch estilo iOS y iconos sol/luna
export default function ThemeToggle({ className = '' }) {
  const systemPrefersDark = useMemo(() => window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches, [])
  const initialTheme = useMemo(() => localStorage.getItem('theme') || (systemPrefersDark ? 'dark' : 'light'), [systemPrefersDark])
  const [theme, setTheme] = useState(initialTheme)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('theme-dark')
    } else {
      root.classList.remove('theme-dark')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  return (
    <label className={`theme-switch ${className}`} title={theme === 'dark' ? 'Oscuro' : 'Claro'}>
      <input
        type="checkbox"
        checked={theme === 'dark'}
        onChange={(e) => setTheme(e.target.checked ? 'dark' : 'light')}
        aria-label="Cambiar tema"
      />
      <span className="slider">
        <span className="icon left">☀️</span>
        <span className="icon right">🌙</span>
      </span>
    </label>
  )
}