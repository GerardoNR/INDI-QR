// Edge Function: dado un código de barras (UPC/EAN), busca el nombre real del
// producto en UPCitemdb (base de datos pública de mercancía general, no solo
// alimentos). Corre en el servidor porque UPCitemdb no permite llamadas
// directas desde el navegador (su CORS solo autoriza su propio sitio).

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

  try {
    const upstream = await fetch(
      `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(codigo)}`,
    )

    if (!upstream.ok) {
      return jsonResponse({ nombre: null, marca: null, encontrado: false })
    }

    const data = await upstream.json()
    const item = data?.items?.[0]

    if (!item) {
      return jsonResponse({ nombre: null, marca: null, encontrado: false })
    }

    return jsonResponse({
      nombre: item.title ?? null,
      marca: item.brand ?? null,
      encontrado: true,
    })
  } catch {
    return jsonResponse({ nombre: null, marca: null, encontrado: false })
  }
})
