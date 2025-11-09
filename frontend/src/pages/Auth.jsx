import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

export default function Auth() {
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      if (mode === 'register') {
        await api.post('/auth/register', form)
        const res = await api.post('/auth/login', { email: form.email, password: form.password })
        localStorage.setItem('token', res.data.token)
      } else {
        const res = await api.post('/auth/login', { email: form.email, password: form.password })
        localStorage.setItem('token', res.data.token)
      }
      navigate('/')
    } catch (e) {
      setError(e.response?.data?.error || e.message)
    }
  }

  return (
    <div className="container py-3" style={{ maxWidth: 600 }}>
      <h2 className="mb-3">{mode === 'login' ? 'Ingresar' : 'Registrarse'}</h2>
      <div className="mb-3 d-flex gap-2">
        <button className="btn btn-outline-secondary" onClick={() => setMode('login')}>Login</button>
        <button className="btn btn-outline-secondary" onClick={() => setMode('register')}>Registro</button>
      </div>
      <div className="card" style={{ maxWidth: 420 }}>
        <div className="card-header">{mode==='login' ? 'Iniciar sesión' : 'Crear cuenta'}</div>
        <div className="card-body">
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 8, maxWidth: 380 }}>
        {mode === 'register' && (
          <input className="form-control" placeholder="Nombre" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required />
        )}
        <input className="form-control" type="email" placeholder="Email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required />
        <input className="form-control" type="password" placeholder="Clave" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required />
        <button className="btn btn-primary" type="submit">Continuar</button>
      </form>
        </div>
      </div>
      {error && <p style={{ color:'red' }}>{error}</p>}
    </div>
  )
}