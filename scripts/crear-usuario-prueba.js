// Uso: node --env-file=.env scripts/crear-usuario-prueba.js [email] [password]
// Crea (o confirma) un usuario directo en Supabase Auth con email_confirm:
// true, sin enviar correo de confirmación — evita el límite de envíos del
// mailer gratuito mientras se prueba la app localmente.
//
// Requiere SUPABASE_SERVICE_ROLE_KEY en .env (Project Settings > API >
// service_role). Esta key nunca debe usarse en el frontend ni llevar el
// prefijo VITE_ — solo se usa aquí, en un script local.

import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
  console.error('Faltan VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env')
  process.exit(1)
}

const [, , email = 'admin@indiqr.local', password = 'Prueba123!'] = process.argv

const admin = createClient(url, serviceRoleKey)

const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
})

if (error) {
  console.error('Error creando usuario:', error.message)
  process.exit(1)
}

console.log('Usuario creado:', data.user.id, data.user.email)
