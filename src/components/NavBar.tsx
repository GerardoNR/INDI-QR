import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { STOCK_BAJO_MAX } from '../lib/constants'

function LogOutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  )
}

export function NavBar() {
  const { session } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [hayBajoStock, setHayBajoStock] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
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
    // Renueva el token si venció mientras la pestaña estaba en segundo
    // plano — de lo contrario RLS filtra todas las filas sin dar error y
    // el aviso de "pocas existencias" desaparece aunque sí haya faltantes.
    supabase.auth.getSession().then(() => {
      supabase
        .from('materiales')
        .select('*', { count: 'exact', head: true })
        .lte('cantidad', STOCK_BAJO_MAX)
        .then(({ count }) => setHayBajoStock((count ?? 0) > 0))
    })
  }, [session])

  // Navega hasta que el propio contexto de auth confirme la sesión en null.
  // Si en vez de esto se llamara a navigate() justo al resolver signOut(),
  // Login.tsx podía montarse con la sesión vieja todavía en el contexto (el
  // evento SIGNED_OUT no llega en el mismo tick) y rebotar de vuelta a "/".
  useEffect(() => {
    if (signingOut && !session) navigate('/login', { replace: true })
  }, [signingOut, session, navigate])

  async function handleSignOut() {
    setMenuOpen(false)
    setSigningOut(true)
    try {
      await supabase.auth.signOut()
    } catch {
      // Si signOut() falla (red, etc.) igual sacamos al usuario de la página.
      navigate('/login', { replace: true })
    }
  }

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

      <button
        type="button"
        className="navbar-theme-toggle"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
      >
        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      </button>

      <div className="navbar-avatar-wrap" ref={menuRef}>
        <button
          type="button"
          className="navbar-avatar"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Cuenta"
        >
          {inicial}
          {hayBajoStock && <span className="navbar-avatar-dot" title="Hay material con pocas existencias" />}
        </button>
        {menuOpen && (
          <div className="navbar-menu">
            <div className="navbar-menu-email">{email}</div>
            {hayBajoStock && (
              <NavLink to="/" className="navbar-menu-alert" onClick={() => setMenuOpen(false)}>
                ● Hay material con pocas existencias
              </NavLink>
            )}
            <button type="button" className="navbar-menu-signout" onClick={handleSignOut}>
              <LogOutIcon />
              Salir
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}
