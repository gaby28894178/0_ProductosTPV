import './App.css'
import { Routes, Route, Navigate } from 'react-router-dom'
import Nav from './components/Nav'
import Auth from './pages/Auth'
import Productos from './pages/Productos'
import Ventas from './pages/Ventas'
import Gastos from './pages/Gastos'
import Empleados from './pages/Empleados'
import Config from './pages/Config'
import Dashboard from './pages/Dashboard'
import Facturas from './pages/Facturas'
import Clientes from './pages/Clientes'
import Mayorista from './pages/Mayorista'
import BoletaPreview from './pages/BoletaPreview';

function PrivateRoute({ children }) {
  const token = localStorage.getItem('token')
  return token ? children : <Navigate to="/auth" />
}

export default function App() {
  return (
    <div>
      <Nav />
      <div style={{ padding: '8px 12px' }}>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/productos" element={<PrivateRoute><Productos /></PrivateRoute>} />
          <Route path="/ventas" element={<PrivateRoute><Ventas /></PrivateRoute>} />
          <Route path="/gastos" element={<PrivateRoute><Gastos /></PrivateRoute>} />
          <Route path="/empleados" element={<PrivateRoute><Empleados /></PrivateRoute>} />
          <Route path="/clientes" element={<PrivateRoute><Clientes /></PrivateRoute>} />
          <Route path="/config" element={<PrivateRoute><Config /></PrivateRoute>} />
          <Route path="/facturas" element={<PrivateRoute><Facturas /></PrivateRoute>} />
          <Route path="/mayorista" element={<PrivateRoute><Mayorista /></PrivateRoute>} />
          <Route path="/boleta-preview" element={<BoletaPreview />} />
        </Routes>
      </div>
    </div>
  )
}
