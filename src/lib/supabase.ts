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
})
