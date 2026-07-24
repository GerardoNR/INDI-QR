export interface ProductoEncontrado {
  nombre: string | null
  marca: string | null
  encontrado: boolean
}

// Tope duro de espera — sin esto, un Open Food Facts lento (o una red
// inestable) puede dejar "Buscando el producto…" pegado por mucho más de lo
// que tarda cualquier fetch normal, ya que fetch() no tiene timeout propio.
const TIMEOUT_MS = 8000

// Consulta Open Food Facts directo desde el navegador (su CORS permite
// cualquier origen, a diferencia de UPCitemdb — ver supabase/functions/
// lookup-producto, que sí necesita servidor y cubre además mercancía
// general de EE.UU., pero requiere desplegarse). Mientras no se despliegue
// esa función, esta es la vía que funciona en local sin configuración extra.
export async function lookupProducto(codigo: string): Promise<ProductoEncontrado> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(codigo)}.json?fields=product_name,brands,status`,
      { signal: controller.signal },
    )

    if (!res.ok) return { nombre: null, marca: null, encontrado: false }

    const data = await res.json()

    if (data?.status !== 1 || !data?.product?.product_name) {
      return { nombre: null, marca: null, encontrado: false }
    }

    return { nombre: data.product.product_name, marca: data.product.brands ?? null, encontrado: true }
  } catch {
    return { nombre: null, marca: null, encontrado: false }
  } finally {
    clearTimeout(timeout)
  }
}
