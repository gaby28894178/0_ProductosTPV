import axios from 'axios'

// Usa VITE_API_URL si está definido; de lo contrario, fallback al backend local en 3001
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const api = axios.create({
  baseURL: BASE,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export default api