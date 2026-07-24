import { useEffect, useRef, useState, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useTheme, type ThemePreference } from '../context/ThemeContext'
import { STOCK_BAJO_MAX } from '../lib/constants'

// Cambia esto por un correo real de soporte antes de producción.
const SUPPORT_EMAIL = 'soporte@indiqr.app'

const FAQ = [
  {
    pregunta: '¿Cómo registro un material nuevo?',
    respuesta:
      'Ve a "Escanear" y apunta la cámara al código de barras o QR. Si no se lee, puedes escribir el código a mano desde la misma pantalla.',
  },
  {
    pregunta: 'Agregué/edité algo y no lo veo, o veo datos viejos',
    respuesta:
      'La app no se actualiza sola en segundo plano: recarga la página o vuelve a entrar a la sección. Los datos se piden de nuevo cada vez que abres una pantalla.',
  },
  {
    pregunta: '¿Cómo cambio entre modo claro y oscuro?',
    respuesta: 'Aquí mismo, en la sección "Tema" de este menú — elige Claro, Oscuro o Sistema.',
  },
  {
    pregunta: '¿Cómo exporto mi inventario a Excel o PDF?',
    respuesta: 'Ve a "Listado" y usa los botones "PDF" o "Excel" en la parte de arriba.',
  },
  {
    pregunta: 'Olvidé mi contraseña, ¿qué hago?',
    respuesta:
      'Todavía no hay recuperación automática. Usa "Reportar un problema" en este menú para que te ayudemos a restablecerla.',
  },
]

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

function MonitorIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  )
}

function MoreVerticalIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  )
}

function FlagIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <path d="M4 22V15" />
    </svg>
  )
}

function HelpCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7v.5" />
      <line x1="12" y1="17" x2="12" y2="17.1" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: () => ReactElement }[] = [
  { value: 'light', label: 'Claro', icon: SunIcon },
  { value: 'dark', label: 'Oscuro', icon: MoonIcon },
  { value: 'system', label: 'Sistema', icon: MonitorIcon },
]

export function NavBar() {
  const { session } = useAuth()
  const { preference, setPreference } = useTheme()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [hayBajoStock, setHayBajoStock] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const optionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (optionsRef.current && !optionsRef.current.contains(e.target as Node)) setOptionsOpen(false)
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
    setOptionsOpen(false)
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
    <>
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

      <div className="navbar-options-wrap" ref={optionsRef}>
        <button
          type="button"
          className="navbar-options-btn"
          onClick={() => setOptionsOpen((v) => !v)}
          aria-label="Más opciones"
        >
          <MoreVerticalIcon />
        </button>
        {optionsOpen && (
          <div className="navbar-menu">
            <div className="navbar-menu-header">
              <div className="navbar-avatar" title={email}>
                {inicial}
                {hayBajoStock && <span className="navbar-avatar-dot" title="Hay material con pocas existencias" />}
              </div>
              <span className="navbar-menu-email">{email}</span>
            </div>
            {hayBajoStock && (
              <NavLink to="/" className="navbar-menu-alert" onClick={() => setOptionsOpen(false)}>
                ● Hay material con pocas existencias
              </NavLink>
            )}

            <div className="navbar-menu-sep" />

            <span className="navbar-menu-label">Tema</span>
            <div className="theme-picker">
              {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  className={`theme-chip${preference === value ? ' selected' : ''}`}
                  onClick={() => setPreference(value)}
                >
                  <span className="theme-chip-icon">
                    <Icon />
                  </span>
                  {label}
                </button>
              ))}
            </div>

            <div className="navbar-menu-sep" />

            <span className="navbar-menu-label">Accesos</span>
            <a
              className="navbar-menu-item"
              href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Reporte de problema — INDI QR')}`}
              onClick={() => setOptionsOpen(false)}
            >
              <FlagIcon />
              Reportar un problema
            </a>
            <button
              type="button"
              className="navbar-menu-item"
              onClick={() => {
                setOptionsOpen(false)
                setHelpOpen(true)
              }}
            >
              <HelpCircleIcon />
              Ayuda / Soporte
            </button>

            <div className="navbar-menu-sep" />

            <button type="button" className="navbar-menu-signout" onClick={handleSignOut}>
              <LogOutIcon />
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </nav>

    {/* Portal a document.body: el backdrop-filter de .navbar crea un
        containing block nuevo para descendientes position:fixed, así que
        si este overlay se quedara dentro de <nav> quedaría centrado
        respecto al navbar (57px de alto) en vez de la pantalla completa. */}
    {helpOpen &&
      createPortal(
        <div className="help-overlay" onClick={() => setHelpOpen(false)}>
          <div className="help-modal" onClick={(e) => e.stopPropagation()}>
            <div className="help-modal-header">
              <h3>Ayuda / Soporte</h3>
              <button type="button" className="help-modal-close" onClick={() => setHelpOpen(false)} aria-label="Cerrar">
                <CloseIcon />
              </button>
            </div>
            <p className="hint">Preguntas frecuentes:</p>
            <div className="faq-list">
              {FAQ.map((item) => (
                <div className="faq-item" key={item.pregunta}>
                  <p className="faq-question">{item.pregunta}</p>
                  <p className="faq-answer">{item.respuesta}</p>
                </div>
              ))}
            </div>
            <p className="hint">
              ¿No encontraste lo que buscabas?{' '}
              <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Ayuda — INDI QR')}`}>Escríbenos</a>.
            </p>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
