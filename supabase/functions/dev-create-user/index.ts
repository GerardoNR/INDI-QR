// Edge Function de SOLO DESARROLLO: crea un usuario ya confirmado (sin enviar
// correo de verificación) usando la Admin API de Supabase, para poder seguir
// probando la app sin depender del límite de envío de correos del proyecto.
// Requiere el secret DEV_ADMIN_SECRET además del apikey — no dejar desplegada
// en un proyecto de producción.

import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-dev-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  const devSecret = Deno.env.get('DEV_ADMIN_SECRET')
  if (!devSecret || req.headers.get('x-dev-secret') !== devSecret) {
    return jsonResponse({ error: 'No autorizado' }, 401)
  }

  let email: string | undefined
  let password: string | undefined
  try {
    const body = await req.json()
    email = typeof body?.email === 'string' ? body.email.trim() : undefined
    password = typeof body?.password === 'string' ? body.password : undefined
  } catch {
    return jsonResponse({ error: 'JSON inválido' }, 400)
  }

  if (!email || !password) {
    return jsonResponse({ error: 'Falta email o password' }, 400)
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error) {
    return jsonResponse({ error: error.message }, 400)
  }

  return jsonResponse({ id: data.user.id, email: data.user.email })
})
