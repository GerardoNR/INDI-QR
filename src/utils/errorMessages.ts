// Traduce errores de Postgrest/Supabase y de red (que llegan en inglés) a
// mensajes en español. Se usa tanto para errores de consultas (objetos
// planos de Postgrest, con .message pero que NO son instancia de Error)
// como para excepciones atrapadas en un catch (fetch fallido, etc.).
const TRADUCCIONES: Array<[RegExp, string]> = [
  [/jwt expired|invalid jwt|jwt malformed|refresh_token/i, 'Tu sesión expiró o no es válida.'],
  [/permission denied|row-level security/i, 'No tienes permiso para hacer esto — verifica tu sesión.'],
  [/duplicate key|already exists/i, 'Ya existe un registro con ese valor.'],
  [/violates check constraint|violates foreign key constraint|violates not-null constraint/i, 'Uno de los valores no cumple una regla de la base de datos.'],
  [/invalid input syntax/i, 'Uno de los valores no tiene el formato correcto.'],
  [/too many requests|rate limit/i, 'Demasiadas solicitudes. Espera un momento e intenta de nuevo.'],
  [/failed to fetch|networkerror|load failed|network request failed/i, 'No se pudo conectar. Revisa tu conexión e intenta de nuevo.'],
]

// Mensajes que ya generamos nosotros mismos en español (los "raise
// exception" de los triggers en supabase/schema.sql) — se dejan pasar tal
// cual en vez de traducirlos o tapiarlos con el genérico. A diferencia de
// TRADUCCIONES, aquí NO se busca coincidencia parcial en cualquier parte
// del mensaje: tienen que empezar así, para no confundirlos por accidente
// con un mensaje de Postgrest que use palabras parecidas.
const YA_EN_ESPANOL: RegExp[] = [/^no hay suficiente cantidad disponible/i, /^el material de este movimiento no existe/i]

export function traducirError(e: unknown, fallback = 'Ocurrió un error inesperado. Intenta de nuevo.'): string {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'No tienes conexión a internet. Conéctate e intenta de nuevo.'
  }

  const mensaje =
    e instanceof Error
      ? e.message
      : typeof e === 'object' && e !== null && 'message' in e
        ? String((e as { message: unknown }).message)
        : String(e)

  if (YA_EN_ESPANOL.some((patron) => patron.test(mensaje))) return mensaje

  for (const [patron, traduccion] of TRADUCCIONES) {
    if (patron.test(mensaje)) return traduccion
  }

  // Sin coincidencia conocida: mejor un genérico en español que arriesgarse
  // a mostrar un mensaje crudo de Postgrest/JS sin traducir.
  return fallback
}
