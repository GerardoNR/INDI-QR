import { useRef, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { translateAuthError } from '../utils/authErrors'
import { traducirError } from '../utils/errorMessages'
import { EyeIcon, EyeOffIcon } from '../components/AuthIcons'
import { PasswordStrengthMeter } from '../components/PasswordStrengthMeter'
import {
  domainAcceptsMail,
  formatTelefono,
  isPasswordAcceptable,
  isValidEmail,
  isValidPhone,
  sanitizeNombre,
} from '../utils/validation'

type Mode = 'login' | 'signup' | 'forgot'

type FieldErrors = Partial<Record<'nombre' | 'telefono' | 'email' | 'password' | 'terminos', boolean>>

export function Login() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('login')

  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [aceptaTerminos, setAceptaTerminos] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotEmailError, setForgotEmailError] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [busy, setBusy] = useState(false)
  const submittingRef = useRef(false)
  // Si el proyecto tiene "Confirm email" desactivado, signUp() deja una
  // sesión activa por un instante antes de que se alcance a llamar
  // signOut() para cerrarla — sin esto, ese instante bastaba para que
  // "if (session) return <Navigate>" sacara a Login de la pantalla y
  // volviera a montarlo de cero al cerrar sesión, perdiendo el mensaje de
  // "Cuenta creada" que se acababa de mostrar.
  const suppressRedirectRef = useRef(false)

  if (session && !suppressRedirectRef.current) return <Navigate to="/" replace />

  function clearMessages() {
    setError(null)
    setInfo(null)
  }

  function goToMode(next: Mode) {
    setMode(next)
    clearMessages()
    setFieldErrors({})
    setForgotEmailError(false)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submittingRef.current) return
    submittingRef.current = true
    clearMessages()

    // Antes de tocar red: valida lo que ya se puede validar localmente, y
    // detecta sin conexión de una — así el usuario no espera un timeout de
    // fetch para enterarse de que no hay internet.
    if (!navigator.onLine) {
      setError('No tienes conexión a internet. Conéctate e intenta de nuevo.')
      submittingRef.current = false
      return
    }

    // Se revisan todos los campos de una sola pasada (en vez de cortar en el
    // primer error) para poder marcar en rojo TODOS los que faltan a la vez,
    // no solo el primero.
    const checks: Array<[keyof FieldErrors, boolean, string]> = [
      ['email', !isValidEmail(email), 'Ingresa un correo válido.'],
    ]
    if (mode === 'signup') {
      checks.push(
        ['nombre', !nombre.trim(), 'Ingresa tu nombre.'],
        ['telefono', !isValidPhone(telefono), 'Ingresa un teléfono válido (10 dígitos).'],
        ['password', !isPasswordAcceptable(password), 'Tu contraseña es muy débil. Hazla más segura (barra de abajo).'],
        ['terminos', !aceptaTerminos, 'Debes aceptar los Términos y Condiciones y el Aviso de Privacidad para crear tu cuenta.'],
      )
    }

    const errors: FieldErrors = {}
    let firstMessage: string | null = null
    for (const [key, failed, message] of checks) {
      if (failed) {
        errors[key] = true
        firstMessage ??= message
      }
    }

    if (firstMessage) {
      setFieldErrors(errors)
      setError(firstMessage)
      submittingRef.current = false
      return
    }
    setFieldErrors({})
    setBusy(true)

    // Solo al crear cuenta vale la pena pagar el costo de un DNS lookup: en
    // login la cuenta ya existe (revisarla aquí solo agregaría latencia sin
    // prevenir nada), pero al registrarse evita cuentas con un dominio
    // inventado o mal escrito al que nunca va a llegar un correo real.
    if (mode === 'signup' && !(await domainAcceptsMail(email))) {
      setFieldErrors({ email: true })
      setError('Ese dominio de correo no existe. Verifica que esté bien escrito.')
      submittingRef.current = false
      setBusy(false)
      return
    }

    // Se activa antes de llamar signUp(): en cuanto esa promesa resuelve
    // (con "Confirm email" desactivado en el proyecto) ya hay una sesión
    // activa y el listener de AuthContext puede reaccionar antes de que
    // esta misma función alcance a llamar signOut() más abajo.
    if (mode === 'signup') suppressRedirectRef.current = true

    try {
      const { error } =
        mode === 'login'
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({
              email,
              password,
              // Se guardan solo los 10 dígitos (sin los espacios del
              // formato visual) — más útil después para marcar/enlazar.
              options: { data: { nombre: nombre.trim(), telefono: telefono.replace(/\D/g, '') } },
            })

      if (error) {
        setError(translateAuthError(error.message))
        return
      }

      if (mode === 'signup') {
        // signUp puede devolver una sesión activa si "Confirm email" está
        // desactivado en el proyecto; la cerramos para no loguear
        // automáticamente y mantener el flujo: crear cuenta -> volver a login.
        await supabase.auth.signOut()
        setInfo('Cuenta creada. Revisa tu correo si se pide confirmación, luego inicia sesión.')
        setMode('login')
        setNombre('')
        setTelefono('')
        setAceptaTerminos(false)
      } else {
        // No basta con esperar a que el listener de AuthContext propague la
        // sesión: si ese evento se retrasa (red lenta, pestaña en segundo
        // plano) el usuario se queda viendo el formulario de login como si
        // no hubiera pasado nada, aunque el login sí funcionó en el
        // servidor — hasta que recarga la página a mano. Navegar aquí de
        // una vez lo hace inmediato sin depender de ese evento.
        navigate('/', { replace: true })
      }
    } catch (e) {
      setError(traducirError(e))
    } finally {
      submittingRef.current = false
      setBusy(false)
      suppressRedirectRef.current = false
    }
  }

  async function handleForgotSubmit(e: FormEvent) {
    e.preventDefault()
    if (submittingRef.current) return
    submittingRef.current = true
    clearMessages()

    if (!navigator.onLine) {
      setError('No tienes conexión a internet. Conéctate e intenta de nuevo.')
      submittingRef.current = false
      return
    }
    if (!isValidEmail(forgotEmail)) {
      setError('Ingresa un correo válido.')
      setForgotEmailError(true)
      submittingRef.current = false
      return
    }

    setBusy(true)

    if (!(await domainAcceptsMail(forgotEmail))) {
      setForgotEmailError(true)
      setError('Ese dominio de correo no existe. Verifica que esté bien escrito.')
      submittingRef.current = false
      setBusy(false)
      return
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo: `${window.location.origin}/restablecer`,
      })

      if (error) {
        setError(translateAuthError(error.message))
        return
      }

      setInfo('Revisa tu correo — te enviamos un enlace para restablecer tu contraseña.')
    } catch (e) {
      setError(traducirError(e))
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

        {mode === 'forgot' ? (
          <form className="card auth-card" onSubmit={handleForgotSubmit} noValidate>
            <img src="/logo-indi.png" alt="" className="auth-card-logo" />
            <h1>Recuperar contraseña</h1>
            <p className="auth-subtitle">Ingresa tu correo y te mandamos un enlace para restablecerla.</p>

            <label>
              Correo
              <input
                type="email"
                required
                className={forgotEmailError ? 'field-error' : undefined}
                value={forgotEmail}
                onChange={(e) => {
                  setForgotEmail(e.target.value)
                  setForgotEmailError(false)
                }}
                autoComplete="email"
                autoFocus
              />
            </label>

            {(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
              <p className="hint">
                Estás en <strong>localhost</strong> — el enlace que se manda por correo solo va a abrir en{' '}
                <strong>esta misma computadora</strong>. Si vas a abrirlo en tu teléfono, primero entra a la app
                desde esta computadora usando su dirección de red (algo como{' '}
                <strong>https://TU-IP-LOCAL:5173</strong>) y pide el enlace desde ahí.
              </p>
            )}

            {error && <p className="auth-error">{error}</p>}
            {info && <p className="auth-info">{info}</p>}

            <button type="submit" disabled={busy}>
              {busy ? 'Enviando…' : 'Enviar enlace'}
            </button>
            <button type="button" className="link-btn auth-back-link" onClick={() => goToMode('login')}>
              ← Volver a iniciar sesión
            </button>
          </form>
        ) : (
          <form className="card auth-card" onSubmit={handleSubmit} noValidate>
            <img src="/logo-indi.png" alt="" className="auth-card-logo" />
            <h1>Bienvenido a INDI QR</h1>
            <p className="auth-subtitle">Escanea y registra material de construcción en segundos.</p>

            <div className="auth-tabs">
              <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => goToMode('login')}>
                Iniciar sesión
              </button>
              <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => goToMode('signup')}>
                Crear cuenta
              </button>
            </div>

            {mode === 'signup' && (
              <>
                <label>
                  Nombre
                  <input
                    type="text"
                    required
                    className={fieldErrors.nombre ? 'field-error' : undefined}
                    value={nombre}
                    onChange={(e) => {
                      setNombre(sanitizeNombre(e.target.value))
                      setFieldErrors((f) => ({ ...f, nombre: false }))
                    }}
                    autoComplete="name"
                  />
                </label>

                <label>
                  Teléfono
                  <input
                    type="tel"
                    required
                    placeholder="551 234 5678"
                    className={fieldErrors.telefono ? 'field-error' : undefined}
                    value={telefono}
                    onChange={(e) => {
                      setTelefono(formatTelefono(e.target.value))
                      setFieldErrors((f) => ({ ...f, telefono: false }))
                    }}
                    autoComplete="tel"
                    inputMode="numeric"
                    maxLength={12}
                  />
                </label>
              </>
            )}

            <label>
              Correo
              <input
                type="email"
                required
                className={fieldErrors.email ? 'field-error' : undefined}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setFieldErrors((f) => ({ ...f, email: false }))
                }}
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
                  className={fieldErrors.password ? 'field-error' : undefined}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setFieldErrors((f) => ({ ...f, password: false }))
                  }}
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
            {mode === 'signup' && <PasswordStrengthMeter password={password} />}

            {mode === 'login' && (
              <button
                type="button"
                className="link-btn auth-forgot-link"
                onClick={() => {
                  setForgotEmail(email)
                  goToMode('forgot')
                }}
              >
                ¿Olvidaste tu contraseña?
              </button>
            )}

            {mode === 'signup' && (
              <label className={`checkbox-field${fieldErrors.terminos ? ' checkbox-field-error' : ''}`}>
                <input
                  type="checkbox"
                  checked={aceptaTerminos}
                  onChange={(e) => {
                    setAceptaTerminos(e.target.checked)
                    setFieldErrors((f) => ({ ...f, terminos: false }))
                  }}
                />
                <span>
                  Acepto los <a href="/terminos" target="_blank" rel="noreferrer">Términos y Condiciones</a> y el{' '}
                  <a href="/privacidad" target="_blank" rel="noreferrer">Aviso de Privacidad</a>.
                </span>
              </label>
            )}

            {error && <p className="auth-error">{error}</p>}
            {info && <p className="auth-info">{info}</p>}

            <button type="submit" disabled={busy}>
              {busy ? 'Un momento…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
