import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { lookupProducto } from '../utils/lookupProducto'

const SUGGESTED_CATEGORIAS = ['Asfalto', 'Grava', 'Cemento', 'Varilla', 'Concreto', 'Señalización', 'Mezcla asfáltica']
const UNIDADES_COMUNES = ['pza', 'kg', 'ton', 'l', 'm', 'm³', 'caja', 'rollo']

// Texto completo mostrado en cada chip — el valor guardado en la base de
// datos sigue siendo la abreviación corta (clave de este objeto).
const UNIDAD_LABELS: Record<string, string> = {
  pza: 'Piezas (pza)',
  kg: 'Kilogramos (kg)',
  ton: 'Toneladas (ton)',
  l: 'Litros (l)',
  m: 'Metros (m)',
  'm³': 'Metros³ (m³)',
  caja: 'Caja',
  rollo: 'Rollo',
}

// Sugerencia automática de unidad según la categoría elegida — el usuario
// puede cambiarla libremente después, solo evita el "pza" por defecto para
// materiales que casi nunca se miden por pieza.
const UNIDAD_SUGERIDA: Record<string, string> = {
  Asfalto: 'ton',
  Grava: 'ton',
  Cemento: 'ton',
  Varilla: 'pza',
  Concreto: 'm³',
  'Mezcla asfáltica': 'ton',
  Señalización: 'pza',
}

export function MaterialForm() {
  const { codigo = '' } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const { showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isExisting, setIsExisting] = useState(false)

  const [nombre, setNombre] = useState('')
  const [cantidad, setCantidad] = useState<number | ''>('')
  const [unidad, setUnidad] = useState('pza')
  const [ubicacion, setUbicacion] = useState('')
  const [categoria, setCategoria] = useState('')
  const [notas, setNotas] = useState('')
  const [addingCustomCat, setAddingCustomCat] = useState(false)
  const [addingCustomUnidad, setAddingCustomUnidad] = useState(false)
  const [buscandoProducto, setBuscandoProducto] = useState(false)
  const [autocompletado, setAutocompletado] = useState(false)
  const [almacenes, setAlmacenes] = useState<string[]>([])
  const [categoriasDb, setCategoriasDb] = useState<string[]>([])

  useEffect(() => {
    // Renueva el token si venció mientras la pestaña estaba en segundo
    // plano antes de pedir los catálogos — de lo contrario RLS filtra
    // todas las filas sin dar error y las listas de sugerencias salen vacías.
    supabase.auth.getSession().then(() => {
      supabase
        .from('almacenes')
        .select('nombre')
        .order('nombre')
        .then(({ data }) => setAlmacenes((data ?? []).map((a) => a.nombre)))

      supabase
        .from('categorias')
        .select('nombre')
        .order('nombre')
        .then(({ data }) => setCategoriasDb((data ?? []).map((c) => c.nombre)))
    })
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      setAutocompletado(false)

      try {
        // Se dispara ya mismo, en paralelo con la consulta a "materiales" de
        // abajo, en vez de esperar a que esa termine para empezar — así el
        // nombre autocompletado llega tan rápido como lo permita Open Food
        // Facts, sin sumarle la latencia de la consulta a Supabase encima.
        // Si el código ya existe en "materiales" no se usa (se descarta solo).
        setBuscandoProducto(true)
        const productoPromise = lookupProducto(codigo)

        // Si el token de acceso quedó vencido (p. ej. la pestaña estuvo en
        // segundo plano y el refresco automático no alcanzó a correr),
        // esto lo renueva antes de seguir. Sin esto, la consulta de abajo
        // usa un token vencido, RLS filtra todas las filas sin dar error,
        // y un material que sí existe se muestra como "nuevo".
        await supabase.auth.getSession()

        const { data, error } = await supabase.from('materiales').select('*').eq('codigo', codigo).maybeSingle()
        if (cancelled) return
        setLoading(false)

        if (error) {
          setBuscandoProducto(false)
          setError(error.message)
          return
        }

        if (data) {
          setBuscandoProducto(false)
          setIsExisting(true)
          setNombre(data.nombre)
          setCantidad(data.cantidad)
          setUnidad(data.unidad ?? 'pza')
          setUbicacion(data.ubicacion ?? '')
          setCategoria(data.categoria ?? '')
          setNotas(data.notas ?? '')
          showToast('info', 'Ya existe', 'Cargando datos para actualizar…')
          return
        }

        const producto = await productoPromise
        if (cancelled) return
        setBuscandoProducto(false)
        if (producto.nombre) {
          setNombre(producto.nombre)
          setAutocompletado(true)
        }
      } catch (e) {
        // Un fetch que falla a nivel de red dejaba loading en true para
        // siempre — sin este catch la página se quedaba en "Buscando
        // código…" y no se recuperaba sin recargar.
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'No se pudo conectar. Revisa tu conexión e intenta de nuevo.')
        setLoading(false)
        setBuscandoProducto(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [codigo, showToast])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (cantidad === '') {
      setError('Ingresa la cantidad.')
      return
    }

    // La política RLS de "materiales" exige una sesión autenticada válida.
    // Si el token quedó vencido/roto (ej. por un reloj de sistema
    // desincronizado), mejor detectarlo aquí con un mensaje claro que dejar
    // que el insert falle con el error crudo de Postgres.
    const { data: sessionCheck } = await supabase.auth.getSession()
    if (!sessionCheck.session) {
      setError('Tu sesión expiró o no es válida. Vuelve a iniciar sesión e intenta de nuevo.')
      return
    }

    setSaving(true)

    const { error } = await supabase.from('materiales').upsert(
      {
        codigo,
        nombre,
        cantidad,
        unidad,
        ubicacion,
        categoria,
        notas,
        registrado_por: session?.user.email ?? null,
      },
      { onConflict: 'codigo' },
    )

    setSaving(false)

    if (error) {
      setError(
        error.message.toLowerCase().includes('row-level security')
          ? 'Tu sesión expiró o no es válida. Vuelve a iniciar sesión e intenta de nuevo.'
          : error.message,
      )
      return
    }

    showToast('success', 'Guardado', `${codigo} · ${cantidad} ${unidad}`)
    navigate('/listado')
  }

  if (loading) {
    return (
      <div className="card state-card">
        <div className="spinner" />
        <h3>Buscando código…</h3>
      </div>
    )
  }

  const baseCategorias = categoriasDb.length > 0 ? categoriasDb : SUGGESTED_CATEGORIAS
  const catChips = categoria && !baseCategorias.includes(categoria)
    ? [...baseCategorias, categoria]
    : baseCategorias

  const unidadChips = unidad && !UNIDADES_COMUNES.includes(unidad)
    ? [...UNIDADES_COMUNES, unidad]
    : UNIDADES_COMUNES

  return (
    <div className="form-page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <h2>{isExisting ? 'Actualizar material' : 'Registrar nuevo material'}</h2>
        <span className="status-badge">
          {codigo} · {isExisting ? 'existe' : 'nuevo'}
        </span>
      </div>
      <p className="hint">Código escaneado: <code>{codigo}</code></p>

      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-section">
            <label>
              Nombre del material
              <input
                required
                placeholder='Ej. Varilla corrugada 3/8"'
                value={nombre}
                onChange={(e) => {
                  setNombre(e.target.value)
                  setAutocompletado(false)
                }}
                autoFocus
              />
            </label>
            {(buscandoProducto || autocompletado) && (
              <p className="hint">
                {buscandoProducto
                  ? 'Buscando el producto por su código de barras…'
                  : '✓ Nombre autocompletado desde el código de barras — puedes editarlo si hace falta.'}
              </p>
            )}
          </div>

          <div className="form-section">
            <span className="field-label">Cantidad y unidad</span>
            <div className="cantidad-unidad-row">
              <label className="cantidad-field">
                Cantidad
                <input
                  type="number"
                  className="cantidad-input"
                  min={0}
                  step="any"
                  required
                  placeholder="0"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </label>

              <div className="unidad-field">
                <span className="field-label">Unidad</span>
                <div className="cat-picker">
                  {unidadChips.map((u) => (
                    <button
                      key={u}
                      type="button"
                      className={`cat-chip${unidad === u ? ' selected' : ''}`}
                      onClick={() => {
                        setUnidad(u)
                        setAddingCustomUnidad(false)
                      }}
                    >
                      {UNIDAD_LABELS[u] ?? u}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="cat-chip"
                    onClick={() => {
                      if (addingCustomUnidad) {
                        setAddingCustomUnidad(false)
                        if (!UNIDADES_COMUNES.includes(unidad)) setUnidad('')
                      } else {
                        setAddingCustomUnidad(true)
                      }
                    }}
                  >
                    {addingCustomUnidad ? 'Cancelar' : '+ otra'}
                  </button>
                </div>
                {addingCustomUnidad && (
                  <input
                    autoFocus
                    placeholder="Unidad personalizada"
                    value={unidad}
                    onChange={(e) => setUnidad(e.target.value)}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="form-section">
            <span className="field-label">Categoría</span>
            <div className="cat-picker">
              {catChips.map((c) => {
                const selected = categoria === c
                return (
                  <button
                    key={c}
                    type="button"
                    className={`cat-chip${selected ? ' selected' : ''}`}
                    onClick={() => {
                      setCategoria(c)
                      setAddingCustomCat(false)
                      const sugerida = UNIDAD_SUGERIDA[c]
                      if (sugerida) setUnidad(sugerida)
                    }}
                  >
                    {c}
                  </button>
                )
              })}
              <button
                type="button"
                className="cat-chip"
                onClick={() => {
                  if (addingCustomCat) {
                    setAddingCustomCat(false)
                    if (!baseCategorias.includes(categoria)) setCategoria('')
                  } else {
                    setAddingCustomCat(true)
                  }
                }}
              >
                {addingCustomCat ? 'Cancelar' : '+ nueva'}
              </button>
            </div>
            {addingCustomCat && (
              <input
                autoFocus
                placeholder="Nombre de la categoría"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
              />
            )}
          </div>

          <div className="form-section">
            <label>
              Ubicación
              <input
                list="almacenes-datalist"
                value={ubicacion}
                onChange={(e) => setUbicacion(e.target.value)}
                placeholder="Elige o escribe un almacén…"
              />
              <datalist id="almacenes-datalist">
                {almacenes.map((nombre) => (
                  <option key={nombre} value={nombre} />
                ))}
              </datalist>
            </label>
            {almacenes.length === 0 && (
              <span className="hint hint-notice">
                <span className="hint-notice-icon">!</span>
                Aún no tienes almacenes registrados — agrégalos en la sección Almacenes.
              </span>
            )}
          </div>

          <div className="form-section">
            <label>
              Notas
              <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} />
            </label>
          </div>
        </div>

        {error && <p className="auth-error">{error}</p>}

        <div className="form-actions">
          <button type="button" className="secondary" onClick={() => navigate('/scanner')}>
            Cancelar / seguir escaneando
          </button>
          <button type="submit" disabled={saving}>
            {saving ? 'Guardando…' : isExisting ? 'Actualizar' : 'Registrar'}
          </button>
        </div>
      </form>
    </div>
  )
}
