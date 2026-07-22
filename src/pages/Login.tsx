import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function Login() {
  const { session } = useAuth()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to="/" replace />

  function clearMessages() {
    setError(null)
    setInfo(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    clearMessages()
    setBusy(true)

    const { error } =
      mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })

    setBusy(false)

    if (error) {
      setError(error.message)
      return
    }

    if (mode === 'signup') {
      setInfo('Cuenta creada. Revisa tu correo si se pide confirmación, luego inicia sesión.')
      setMode('login')
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <div className="auth-marketing">
          <img src="/app-icon.svg" alt="" className="brand-mark auth-marketing-mark" />
          <h2 className="auth-marketing-title">
            Todo el inventario,
            <br />
            en un solo lugar.
          </h2>
          <p className="auth-marketing-copy">
            Escanea QR o código de barras y el equipo completo ve los mismos datos al instante.
          </p>
          <div className="auth-marketing-tags mono">
            <span>■ Tiempo real</span>
            <span>■ Sin roles</span>
            <span>■ PWA</span>
          </div>
        </div>

        <form className="card auth-card" onSubmit={handleSubmit}>
          <img src="/app-icon.svg" alt="" className="brand-mark auth-card-mark" />
          <h1>Bienvenido a INDI QR</h1>
          <p className="auth-subtitle">Escanea y registra materiales en segundos.</p>

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
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
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
