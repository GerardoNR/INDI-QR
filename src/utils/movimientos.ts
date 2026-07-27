import { supabase } from '../lib/supabase'
import type { Movimiento, MovimientoInput, TipoMovimiento } from '../types'

export const TIPO_MOVIMIENTO_LABEL: Record<TipoMovimiento, string> = {
  entrada: 'Entrada',
  salida: 'Salida',
  transferencia: 'Transferencia',
  ajuste: 'Ajuste',
}

// Inserta el movimiento — el trigger "movimientos_aplicar" (ver
// supabase/schema.sql) es quien de verdad actualiza materiales.cantidad;
// aquí solo se registra el renglón y se deja que la base de datos aplique
// el efecto (y rechace, p. ej., una salida sin suficiente cantidad).
export async function registrarMovimiento(input: MovimientoInput): Promise<Movimiento> {
  await supabase.auth.getSession()

  const { data, error } = await supabase.from('movimientos').insert(input).select().single()
  // El error de supabase-js no es un Error de verdad (es un objeto plano
  // con .message), así que un "e instanceof Error ? e.message : …" en
  // quien llame esto nunca lo detecta y siempre cae al mensaje genérico —
  // se envuelve aquí para que el mensaje real (p. ej. el que lanza el
  // trigger si no hay suficiente cantidad) llegue hasta la UI.
  if (error) throw new Error(error.message)
  return data
}

export async function listarMovimientos(materialId: string): Promise<Movimiento[]> {
  await supabase.auth.getSession()

  const { data, error } = await supabase
    .from('movimientos')
    .select('*')
    .eq('material_id', materialId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}
