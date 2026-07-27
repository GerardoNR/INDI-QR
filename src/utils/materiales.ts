import { supabase } from '../lib/supabase'
import type { Material } from '../types'

// Único lugar que consulta "materiales" por código — antes esta misma
// consulta vivía duplicada en MaterialForm y en la pantalla de resultado de
// escaneo, cada una con su propia copia del fix de sesión de abajo.
export async function buscarMaterialPorCodigo(codigo: string): Promise<Material | null> {
  // Renueva el token si venció mientras la pestaña estaba en segundo plano
  // antes de consultar — de lo contrario RLS filtra todas las filas sin dar
  // error, y un material que sí existe se muestra como si no existiera.
  await supabase.auth.getSession()

  const { data, error } = await supabase.from('materiales').select('*').eq('codigo', codigo).maybeSingle()
  // El error de supabase-js no es un Error de verdad (es un objeto plano
  // con .message), así que un "e instanceof Error ? e.message : …" en
  // quien llame esto nunca lo detecta y siempre cae al mensaje genérico —
  // se envuelve aquí para que el mensaje real llegue hasta la UI.
  if (error) throw new Error(error.message)
  return data
}
