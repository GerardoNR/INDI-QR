import { getPasswordStrength } from '../utils/validation'

const ETIQUETAS = { weak: 'Débil', medium: 'Intermedia', strong: 'Segura' } as const

export function PasswordStrengthMeter({ password }: { password: string }) {
  const strength = getPasswordStrength(password)
  return (
    <div className="password-strength">
      <p className="password-strength-hint">
        Escribe una contraseña segura combinando letras, números y símbolos.
      </p>
      <div className="password-strength-track">
        <div className={`password-strength-fill ${password ? strength : ''}`} />
      </div>
      {password && <span className={`password-strength-label ${strength}`}>{ETIQUETAS[strength]}</span>}
    </div>
  )
}
