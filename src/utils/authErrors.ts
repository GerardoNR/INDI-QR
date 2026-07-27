// Supabase/GoTrue devuelve estos mensajes en inglés y a veces poco claros
// para alguien que no conoce la API — se traducen los más comunes.
export function translateAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.'
  if (m.includes('email not confirmed')) return 'Debes confirmar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.'
  if (m.includes('already registered') || m.includes('already exists')) return 'Ya existe una cuenta con ese correo. Intenta iniciar sesión.'
  if (m.includes('new password should be different')) return 'La nueva contraseña debe ser diferente a la anterior.'
  if (m.includes('password should be at least')) return 'La contraseña debe tener al menos 6 caracteres.'
  if (m.includes('security purposes') || m.includes('rate limit exceeded')) return 'Espera unos segundos antes de volver a intentarlo.'
  if (m.includes('auth session missing') || m.includes('session') || m.includes('invalid or has expired')) {
    return 'Tu enlace no es válido o ya expiró. Pide uno nuevo.'
  }
  if (m.includes('is invalid')) return 'Ese correo no es válido. Revisa que esté bien escrito.'
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) return 'La creación de cuentas está deshabilitada en este proyecto.'
  // Si Supabase agrega o redacta distinto un mensaje que no está mapeado
  // arriba, mejor un genérico en español que dejar pasar el original en
  // inglés a la pantalla.
  return 'Ocurrió un error. Intenta de nuevo.'
}
