// Edge Function: dado un código de barras (UPC/EAN), busca el nombre real del
// producto. Corre en el servidor porque ninguna de las dos fuentes permite
// llamadas directas desde el navegador (CORS solo autoriza sus propios sitios).
//
// Se intenta primero UPCitemdb (buena cobertura de mercancía general de EE.UU.)
// y, si no encuentra nada, se intenta Open Food Facts (gratis, sin API key,
// con mucha mejor cobertura de productos mexicanos/latinoamericanos — ej.
// Bimbo/Marinela — al ser una base colaborativa alimentada globalmente).

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

async function buscarEnUpcitemdb(codigo: string) {
  const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(codigo)}`)
  if (!res.ok) return null

  const data = await res.json()
  const item = data?.items?.[0]
  if (!item) return null

  return { nombre: item.title ?? null, marca: item.brand ?? null }
}

async function buscarEnOpenFoodFacts(codigo: string) {
  const res = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(codigo)}.json?fields=product_name,brands,status`,
  )
  if (!res.ok) return null

  const data = await res.json()
  if (data?.status !== 1 || !data?.product?.product_name) return null

  return { nombre: data.product.product_name, marca: data.product.brands ?? null }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  let codigo: string | undefined
  try {
    const body = await req.json()
    codigo = typeof body?.codigo === 'string' ? body.codigo.trim() : undefined
  } catch {
    return jsonResponse({ error: 'JSON inválido' }, 400)
  }

  if (!codigo) {
    return jsonResponse({ error: 'Falta el código' }, 400)
  }

  for (const buscar of [buscarEnUpcitemdb, buscarEnOpenFoodFacts]) {
    try {
      const encontrado = await buscar(codigo)
      if (encontrado) return jsonResponse({ ...encontrado, encontrado: true })
    } catch {
      // se ignora y se intenta la siguiente fuente
    }
  }

  return jsonResponse({ nombre: null, marca: null, encontrado: false })
})
