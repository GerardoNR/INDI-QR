import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { STOCK_BAJO_MAX } from '../lib/constants'

export function NavBar() {
  const { session } = useAuth()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [hayBajoStock, setHayBajoStock] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  useEffect(() => {
    if (!session) return
    supabase
      .from('materiales')
      .select('*', { count: 'exact', head: true })
      .lte('cantidad', STOCK_BAJO_MAX)
      .then(({ count }) => setHayBajoStock((count ?? 0) > 0))
  }, [session])

  if (!session) return null

  const email = session.user.email ?? ''
  const inicial = email.charAt(0).toUpperCase()

  return (
    <nav className={`navbar${pathname.startsWith('/scanner') ? ' navbar-dark' : ''}`}>
      <div className="brand-lockup">
        <NavLink to="/" style={{ display: 'flex', alignItems: 'center' }}>
          <img src="/app-icon.svg" alt="" className="brand-mark" />
        </NavLink>
      </div>
      <div className="navbar-scroll">
        <div className="navbar-links">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
            Inicio
          </NavLink>
          <NavLink to="/scanner" className={({ isActive }) => (isActive ? 'active' : '')}>
            Escanear
          </NavLink>
          <NavLink to="/listado" className={({ isActive }) => (isActive ? 'active' : '')}>
            Listado
          </NavLink>
          <NavLink to="/almacenes" className={({ isActive }) => (isActive ? 'active' : '')}>
            Almacenes
          </NavLink>
          <NavLink to="/categorias" className={({ isActive }) => (isActive ? 'active' : '')}>
            Categorías
          </NavLink>
          <NavLink to="/estadisticas" className={({ isActive }) => (isActive ? 'active' : '')}>
            Estadísticas
          </NavLink>
        </div>
      </div>

      <div className="navbar-avatar-wrap" ref={menuRef}>
        <button
          type="button"
          className="navbar-avatar"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Cuenta"
        >
          {inicial}
          {hayBajoStock && <span className="navbar-avatar-dot" title="Hay materiales con pocas existencias" />}
        </button>
        {menuOpen && (
          <div className="navbar-menu">
            <div className="navbar-menu-email">{email}</div>
            {hayBajoStock && (
              <NavLink to="/" className="navbar-menu-alert" onClick={() => setMenuOpen(false)}>
                ● Hay materiales con pocas existencias
              </NavLink>
            )}
            <button
              type="button"
              className="link-btn danger"
              onClick={() => supabase.auth.signOut()}
            >
              Salir
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}
