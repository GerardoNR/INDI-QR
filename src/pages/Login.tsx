import { useRef, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.6 5.3A10.6 10.6 0 0 1 12 5c6.2 0 10 7 10 7a13.6 13.6 0 0 1-3.05 3.9M6.3 6.7C3.6 8.5 2 12 2 12s3.8 7 10 7c1.4 0 2.66-.36 3.75-.9" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="M3 3l18 18" />
    </svg>
  )
}

export function Login() {
  const { session } = useAuth()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const submittingRef = useRef(false)

  if (session) return <Navigate to="/" replace />

  function clearMessages() {
    setError(null)
    setInfo(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submittingRef.current) return
    submittingRef.current = true

    clearMessages()
    setBusy(true)

    try {
      const { error } =
        mode === 'login'
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password })

      if (error) {
        setError(error.message)
        return
      }

      if (mode === 'signup') {
        // signUp puede devolver una sesión activa si "Confirm email" está
        // desactivado en el proyecto; la cerramos para no loguear
        // automáticamente y mantener el flujo: crear cuenta -> volver a login.
        await supabase.auth.signOut()
        setInfo('Cuenta creada. Revisa tu correo si se pide confirmación, luego inicia sesión.')
        setMode('login')
      }
    } finally {
      submittingRef.current = false
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <div className="auth-marketing">
          <img src="/app-icon.svg" alt="" className="brand-mark auth-marketing-mark" />
          <h2 className="auth-marketing-title">
            Todo el material de tus bodegas,
            <br />
            en un solo lugar.
          </h2>
          <p className="auth-marketing-copy">
            Escanea QR o código de barras y tu equipo de obra ve los mismos datos al instante.
          </p>
          <div className="auth-marketing-tags mono">
            <span>■ Tiempo real</span>
            <span>■ Sin roles</span>
            <span>■ PWA</span>
          </div>
        </div>

        <form className="card auth-card" onSubmit={handleSubmit}>
          <img src="/logo-indi.png" alt="" className="auth-card-logo" />
          <h1>Bienvenido a INDI QR</h1>
          <p className="auth-subtitle">Escanea y registra material de construcción en segundos.</p>

          <div className="auth-tabs">
            <button
              type="button"
              className={mode === 'login' ? 'active' : ''}
              onClick={() => {
                setMode('login')
                clearMessages()
              }}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              className={mode === 'signup' ? 'active' : ''}
              onClick={() => {
                setMode('signup')
                clearMessages()
              }}
            >
              Crear cuenta
            </button>
          </div>

          <label>
            Correo
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>

          <label>
            Contraseña
            <div className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </label>

          {error && <p className="auth-error">{error}</p>}
          {info && <p className="auth-info">{info}</p>}

          <button type="submit" disabled={busy}>
            {busy ? 'Un momento…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
        </form>
      </div>
    </div>
  )
}
