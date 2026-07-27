import { useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { translateAuthError } from '../utils/authErrors'
import { traducirError } from '../utils/errorMessages'
import { EyeIcon, EyeOffIcon } from '../components/AuthIcons'
import { PasswordStrengthMeter } from '../components/PasswordStrengthMeter'
import { isPasswordAcceptable } from '../utils/validation'

export function Restablecer() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState(false)
  const [confirmError, setConfirmError] = useState(false)
  const [success, setSuccess] = useState(false)
  const [busy, setBusy] = useState(false)
  const submittingRef = useRef(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submittingRef.current) return
    submittingRef.current = true
    setError(null)

    if (!navigator.onLine) {
      setError('No tienes conexión a internet. Conéctate e intenta de nuevo.')
      submittingRef.current = false
      return
    }
    if (!isPasswordAcceptable(password)) {
      setError('Tu contraseña es muy débil. Hazla más segura (barra de abajo).')
      setPasswordError(true)
      submittingRef.current = false
      return
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      setConfirmError(true)
      submittingRef.current = false
      return
    }

    setBusy(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setError(translateAuthError(error.message))
        return
      }
      setSuccess(true)
    } catch (e) {
      setError(traducirError(e))
    } finally {
      submittingRef.current = false
      setBusy(false)
    }
  }

  if (success) {
    return (
      <div className="auth-page">
        <div className="card auth-card auth-card-standalone">
          <h1>Contraseña actualizada</h1>
          <p className="auth-subtitle">Ya puedes iniciar sesión con tu nueva contraseña.</p>
          <button type="button" onClick={() => navigate('/login', { replace: true })}>
            Ir a iniciar sesión
          </button>
        </div>
      </div>
    )
  }

  // El enlace del correo trae el token en la URL; supabase-js lo detecta
  // solo y arma una sesión de recuperación antes de que este componente
  // termine de montar — por eso se espera a "loading" en vez de asumir que
  // ya hay sesión desde el primer render.
  if (loading) {
    return <p className="page-loading">Verificando enlace…</p>
  }

  if (!session) {
    return (
      <div className="auth-page">
        <div className="card auth-card auth-card-standalone">
          <h1>Enlace inválido o vencido</h1>
          <p className="auth-subtitle">
            Pide un enlace nuevo desde "¿Olvidaste tu contraseña?" en la pantalla de inicio de sesión.
          </p>
          <button type="button" onClick={() => navigate('/login', { replace: true })}>
            Volver a iniciar sesión
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <form className="card auth-card auth-card-standalone" onSubmit={handleSubmit} noValidate>
        <h1>Restablecer contraseña</h1>
        <p className="auth-subtitle">Ingresa tu nueva contraseña.</p>

        <label>
          Nueva contraseña
          <div className="password-field">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              className={passwordError ? 'field-error' : undefined}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setPasswordError(false)
              }}
              autoComplete="new-password"
              autoFocus
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
        <PasswordStrengthMeter password={password} />

        <label>
          Confirmar contraseña
          <input
            type={showPassword ? 'text' : 'password'}
            required
            minLength={6}
            className={confirmError ? 'field-error' : undefined}
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value)
              setConfirmError(false)
            }}
            autoComplete="new-password"
          />
        </label>

        {error && <p className="auth-error">{error}</p>}

        <button type="submit" disabled={busy}>
          {busy ? 'Guardando…' : 'Actualizar contraseña'}
        </button>
      </form>
    </div>
  )
}
