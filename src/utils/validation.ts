const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(value: string) {
  return EMAIL_RE.test(value.trim())
}

const DNS_TIMEOUT_MS = 6000

function getEmailDomain(value: string) {
  const at = value.lastIndexOf('@')
  return at === -1 ? '' : value.slice(at + 1).trim().toLowerCase()
}

async function resolveDns(domain: string, type: 'MX' | 'A', signal: AbortSignal) {
  const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${type}`, { signal })
  if (!res.ok) return false
  const data = await res.json()
  return Array.isArray(data?.Answer) && data.Answer.length > 0
}

// Confirma que el dominio del correo pueda recibir correos de verdad (no
// solo que el texto tenga forma de email) consultando el DNS-over-HTTPS
// público de Google — su CORS permite llamarlo directo desde el navegador,
// sin necesitar un backend propio. Revisa primero MX (lo normal) y, si no
// hay, cae a A (algunos dominios reciben correo así, según RFC 5321).
export async function domainAcceptsMail(email: string): Promise<boolean> {
  const domain = getEmailDomain(email)
  if (!domain) return false

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DNS_TIMEOUT_MS)

  try {
    if (await resolveDns(domain, 'MX', controller.signal)) return true
    return await resolveDns(domain, 'A', controller.signal)
  } catch {
    // Si el DNS no responde (sin internet, servicio caído), no se bloquea
    // el registro por un problema ajeno a si el dominio existe.
    return true
  } finally {
    clearTimeout(timeout)
  }
}

// Letras (con acentos/ñ) y espacios — nada de números ni símbolos. Se usa
// tanto para filtrar mientras se escribe como para validar al enviar.
const NOMBRE_DISALLOWED_RE = /[^a-zA-ZÁÉÍÓÚáéíóúÑñÜü\s]/g

export function sanitizeNombre(value: string) {
  return value.replace(NOMBRE_DISALLOWED_RE, '')
}

// Formatea a "551 234 5678" (3-3-4) según se escribe, recortando a 10
// dígitos — pegar un número con espacios/guiones/paréntesis también
// funciona porque primero se descarta todo lo que no sea dígito.
export function formatTelefono(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  const partes = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 10)]
  return partes.filter(Boolean).join(' ')
}

export function isValidPhone(value: string) {
  return value.replace(/\D/g, '').length === 10
}

// El correo y la contraseña aceptan cualquier carácter (mayúsculas,
// minúsculas, números, símbolos) — a diferencia del nombre y el teléfono,
// aquí no se filtra nada mientras se escribe.
interface PasswordChecks {
  length: boolean
  upper: boolean
  lower: boolean
  number: boolean
  symbol: boolean
}

function getPasswordChecks(value: string): PasswordChecks {
  return {
    length: value.length >= 6,
    upper: /[A-Z]/.test(value),
    lower: /[a-z]/.test(value),
    number: /[0-9]/.test(value),
    symbol: /[^A-Za-z0-9]/.test(value),
  }
}

export type PasswordStrength = 'weak' | 'medium' | 'strong'

// Puntaje simple: un punto por cada tipo de carácter presente (mayúscula,
// minúscula, número, símbolo) más uno extra si ya es larga (10+). No exige
// los 4 tipos a la vez — con 3 ya se considera "intermedia".
export function getPasswordStrength(value: string): PasswordStrength {
  const checks = getPasswordChecks(value)
  if (!checks.length) return 'weak'

  const variedad = [checks.upper, checks.lower, checks.number, checks.symbol].filter(Boolean).length
  const puntaje = variedad + (value.length >= 10 ? 1 : 0)

  if (puntaje <= 2) return 'weak'
  if (puntaje === 3) return 'medium'
  return 'strong'
}

// Se acepta desde "intermedia" en adelante — pedir siempre el máximo (los
// 4 tipos de carácter) frustraba a quien solo quería una contraseña
// razonable, no perfecta.
export function isPasswordAcceptable(value: string) {
  return getPasswordStrength(value) !== 'weak'
}
