import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder-anon-key', {
  global: {
    // Sin esto, Safari/iOS (y a veces Chrome) puede servir una respuesta
    // cacheada para el mismo GET en vez de ir a red — así un usuario ve
    // datos desactualizados (p. ej. materiales agregados por otra cuenta)
    // hasta recargar la página a la fuerza.
    fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
  },
  auth: {
    // Esto ya es el default de supabase-js (guarda la sesión en
    // localStorage y la renueva sola en segundo plano) — se deja explícito
    // para que quede claro que la sesión sobrevive a cerrar la app/pestaña,
    // sin depender de que nadie cambie esto sin darse cuenta más adelante.
    persistSession: true,
    autoRefreshToken: true,
    // El default de supabase-js (PKCE) guarda una "llave" en el localStorage
    // del dispositivo que PIDE el enlace de recuperación, y la exige de
    // vuelta al abrirlo — si el correo se pide desde la compu y se abre en
    // el teléfono, ese segundo dispositivo no tiene esa llave y el enlace no
    // sirve de nada. Con "implicit", el enlace trae todo lo necesario y
    // funciona en cualquier dispositivo/navegador que lo abra.
    flowType: 'implicit',
  },
})
