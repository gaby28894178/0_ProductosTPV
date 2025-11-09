import { Link, NavLink } from 'react-router-dom'
import { FiHome, FiUsers, FiSettings, FiUserCheck, FiFileText, FiShoppingBag, FiDollarSign, FiPackage, FiShoppingCart } from 'react-icons/fi'
import ThemeToggle from './ThemeToggle'
import styles from '../styles/modules/Nav/Nav.module.css'

export default function Nav() {
  const token = localStorage.getItem('token')
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
              <NavLink className={"nav-link icon-only " + styles.navLink} to="/config" aria-label="Config" title="Config">
                <FiSettings className={styles.navIcon} aria-hidden="true" />
              </NavLink>
            </li>

            {/* Dashboard */}
            <li className="nav-item">
              <NavLink className={"nav-link " + styles.navLink} to="/">
                <FiHome className={styles.navIcon} aria-hidden="true" />
                Dashboard
              </NavLink>
            </li>

            {/* Orden alfabético */}
            <li className="nav-item">
              <NavLink className={"nav-link " + styles.navLink} to="/clientes">
                <FiUsers className={styles.navIcon} aria-hidden="true" />
                Clientes
              </NavLink>
            </li>

            <li className="nav-item">
              <NavLink className={"nav-link " + styles.navLink} to="/empleados">
                <FiUserCheck className={styles.navIcon} aria-hidden="true" />
                Empleados
              </NavLink>
            </li>

            <li className="nav-item">
              <NavLink className={"nav-link " + styles.navLink} to="/facturas">
                <FiFileText className={styles.navIcon} aria-hidden="true" />
                Facturas
              </NavLink>
            </li>

            <li className="nav-item">
              <NavLink className={"nav-link " + styles.navLink} to="/mayorista">
                <FiShoppingBag className={styles.navIcon} aria-hidden="true" />
                Mayorista
              </NavLink>
            </li>

            <li className="nav-item">
              <NavLink className={"nav-link " + styles.navLink} to="/gastos">
                <FiDollarSign className={styles.navIcon} aria-hidden="true" />
                Gastos
              </NavLink>
            </li>

            <li className="nav-item">
              <NavLink className={"nav-link " + styles.navLink} to="/productos">
                <FiPackage className={styles.navIcon} aria-hidden="true" />
                Productos
              </NavLink>
            </li>

            <li className="nav-item">
              <NavLink className={"nav-link " + styles.navLink} to="/ventas">
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