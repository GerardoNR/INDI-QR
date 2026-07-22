import { supabase } from '../lib/supabase'

export interface ProductoEncontrado {
  nombre: string | null
  marca: string | null
  encontrado: boolean
}

export async function lookupProducto(codigo: string): Promise<ProductoEncontrado> {
  const { data, error } = await supabase.functions.invoke<ProductoEncontrado>('lookup-producto', {
    body: { codigo },
  })

  if (error || !data) {
    return { nombre: null, marca: null, encontrado: false }
  }

  return data
}
