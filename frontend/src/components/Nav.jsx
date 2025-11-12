import { Link, NavLink, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { FiHome, FiUsers, FiSettings, FiUserCheck, FiFileText, FiShoppingBag, FiDollarSign, FiPackage, FiShoppingCart, FiList } from 'react-icons/fi'
import ThemeToggle from './ThemeToggle'
import styles from '../styles/modules/Nav/Nav.module.css'

export default function Nav() {
  const token = localStorage.getItem('token')
  const location = useLocation()
  const [loadingLink, setLoadingLink] = useState('')

  useEffect(()=>{ setLoadingLink('') }, [location.pathname])
  return (
    <nav className={styles.navBar + " navbar navbar-expand-lg navbar-light bg-gradient shadow-sm fixed-top w-100"}>
      <div className="container-fluid">
        <Link className="navbar-brand" to="/">
          <span className={styles.brandClean}>Clean</span>
          <span className={styles.brandPro}>Pro</span>
        </Link>
        <div className="collapse navbar-collapse order-lg-1" id="navbarNav">
          <ul className="navbar-nav me-auto mb-2 mb-lg-0">
            {/* Icono de Config a la izquierda de Dashboard */}
            <li className="nav-item">
              <NavLink end className={"nav-link icon-only " + styles.navLink + (loadingLink==="/config" ? " " + styles.loading : "")} to="/config" aria-label="Config" title="Config" onClick={()=>{ setLoadingLink('/config') }}>
                <FiSettings className={styles.navIcon} aria-hidden="true" />
              </NavLink>
            </li>

            {/* Dashboard */}
            <li className="nav-item">
              <NavLink end className={"nav-link " + styles.navLink + (loadingLink==="/" ? " " + styles.loading : "")} to="/" onClick={()=>{ setLoadingLink('/') }}>
                <FiHome className={styles.navIcon} aria-hidden="true" />
                Dashboard
              </NavLink>
            </li>

            {/* Gastos al lado de Dashboard */}
            <li className="nav-item">
              <NavLink className={"nav-link " + styles.navLink + (loadingLink==="/gastos" ? " " + styles.loading : "")} to="/gastos" onClick={()=>{ setLoadingLink('/gastos') }}>
                <FiDollarSign className={styles.navIcon} aria-hidden="true" />
                Gastos
              </NavLink>
            </li>

            {/* Empleados luego Clientes */}
            <li className="nav-item">
              <NavLink className={"nav-link " + styles.navLink + (loadingLink==="/empleados" ? " " + styles.loading : "")} to="/empleados" onClick={()=>{ setLoadingLink('/empleados') }}>
                <FiUserCheck className={styles.navIcon} aria-hidden="true" />
                Empleados
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink className={"nav-link " + styles.navLink + (loadingLink==="/clientes" ? " " + styles.loading : "")} to="/clientes" onClick={()=>{ setLoadingLink('/clientes') }}>
                <FiUsers className={styles.navIcon} aria-hidden="true" />
                Clientes
              </NavLink>
            </li>

            {/* Secuencia: Mayorista, Productos, Facturas, Lista de Precios, Ventas */}
            <li className="nav-item">
              <NavLink className={"nav-link " + styles.navLink + (loadingLink==="/mayorista" ? " " + styles.loading : "")} to="/mayorista" onClick={()=>{ setLoadingLink('/mayorista') }}>
                <FiShoppingBag className={styles.navIcon} aria-hidden="true" />
                Mayorista
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink className={"nav-link " + styles.navLink + (loadingLink==="/productos" ? " " + styles.loading : "")} to="/productos" onClick={()=>{ setLoadingLink('/productos') }}>
                <FiPackage className={styles.navIcon} aria-hidden="true" />
                Productos
              </NavLink>
            </li>
            {/* Presupuesto antes de Ventas */}
            <li className="nav-item">
              <NavLink className={"nav-link " + styles.navLink + (loadingLink==="/presupuesto" ? " " + styles.loading : "")} to="/presupuesto" onClick={()=>{ setLoadingLink('/presupuesto') }}>
                <FiList className={styles.navIcon} aria-hidden="true" />
                Presupuesto
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink className={"nav-link " + styles.navLink + (loadingLink==="/facturas" ? " " + styles.loading : "")} to="/facturas" onClick={()=>{ setLoadingLink('/facturas') }}>
                <FiFileText className={styles.navIcon} aria-hidden="true" />
                Facturas
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink className={"nav-link " + styles.navLink + (loadingLink==="/lista-precios" ? " " + styles.loading : "")} to="/lista-precios" onClick={()=>{ setLoadingLink('/lista-precios') }}>
                <FiList className={styles.navIcon} aria-hidden="true" />
                Lista de Precios
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink className={"nav-link " + styles.navLink + (loadingLink==="/ventas" ? " " + styles.loading : "")} to="/ventas" onClick={()=>{ setLoadingLink('/ventas') }}>
                <FiShoppingCart className={styles.navIcon} aria-hidden="true" />
                Ventas
              </NavLink>
            </li>
          </ul>
        </div>
        {/* Siempre visibles y a la derecha en desktop y móvil */}
        <div className="d-flex align-items-center ms-auto order-lg-2" style={{ gap: 8 }}>
          <ThemeToggle />
          {!token ? (
            <Link className="btn btn-outline-primary" to="/auth">Ingresar</Link>
          ) : (
            <button className="btn btn-warning" onClick={() => { localStorage.removeItem('token'); location.href='/auth' }}>Salir</button>
          )}
          <button className="navbar-toggler ms-2" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
            <span className="navbar-toggler-icon"></span>
          </button>
        </div>
      </div>
    </nav>
  )
}