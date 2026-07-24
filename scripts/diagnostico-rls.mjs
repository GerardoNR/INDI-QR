// Uso: node --env-file=.env scripts/diagnostico-rls.mjs [--keep]
// Diagnóstico de RLS: usa la MISMA anon key que el frontend, hace login real
// con el usuario de prueba y trata de insertar una fila en "almacenes" —
// exactamente lo que hace la app desde el navegador, pero fuera de él.
// Así se aísla si el problema es la sesión o las políticas RLS en sí.
//
// Por default borra la fila de prueba al terminar. Pasa --keep para dejarla
// (útil para verla aparecer en la app, ej. en Almacenes).

import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env')
  process.exit(1)
}

const email = 'admin@indiqr.local'
const password = 'Prueba123!'

const client = createClient(url, anonKey)

console.log('1) Iniciando sesión como', email, '...')
const { data: signInData, error: signInError } = await client.auth.signInWithPassword({ email, password })

if (signInError) {
  console.error('❌ Login falló:', signInError.message)
  process.exit(1)
}

const token = signInData.session.access_token
const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
console.log('✓ Login OK. user:', signInData.user.email)
console.log('  JWT role:', payload.role, '| aud:', payload.aud, '| exp:', new Date(payload.exp * 1000).toISOString())

const keep = process.argv.includes('--keep')
const nombrePrueba = 'Prueba diagnóstico RLS ' + Date.now()

console.log('\n2) Insertando fila de prueba en "almacenes"...')
const { data: insertData, error: insertError } = await client
  .from('almacenes')
  .insert({ nombre: nombrePrueba })
  .select()

if (insertError) {
  console.error('❌ INSERT FALLÓ')
  console.error('   message:', insertError.message)
  console.error('   code:', insertError.code)
  console.error('   details:', insertError.details)
  console.error('   hint:', insertError.hint)
  process.exit(1)
}

console.log('✓ INSERT OK:', insertData)

if (keep) {
  console.log('\n(--keep: la fila queda en "almacenes" — revisa la app en el navegador)')
} else {
  await client.from('almacenes').delete().eq('nombre', nombrePrueba)
  console.log('\n(fila de prueba eliminada — vuelve a correr con --keep para dejarla)')
}

await client.auth.signOut()
