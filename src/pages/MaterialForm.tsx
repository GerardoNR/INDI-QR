import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { categoryColor } from '../utils/categoryColors'
import { lookupProducto } from '../utils/lookupProducto'

const SUGGESTED_CATEGORIAS = ['Tornillería', 'Eléctrico', 'Pintura', 'Plomería', 'Herramienta', 'Seguridad']

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
  const [cantidad, setCantidad] = useState(1)
  const [unidad, setUnidad] = useState('pza')
  const [ubicacion, setUbicacion] = useState('')
  const [categoria, setCategoria] = useState('')
  const [notas, setNotas] = useState('')
  const [addingCustomCat, setAddingCustomCat] = useState(false)
  const [buscandoProducto, setBuscandoProducto] = useState(false)
  const [autocompletado, setAutocompletado] = useState(false)
  const [almacenes, setAlmacenes] = useState<string[]>([])
  const [categoriasDb, setCategoriasDb] = useState<string[]>([])

  useEffect(() => {
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
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setAutocompletado(false)

    supabase
      .from('materiales')
      .select('*')
      .eq('codigo', codigo)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        setLoading(false)

        if (error) {
          setError(error.message)
          return
        }

        if (data) {
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

        setBuscandoProducto(true)
        lookupProducto(codigo).then((producto) => {
          if (cancelled) return
          setBuscandoProducto(false)
          if (producto.nombre) {
            setNombre(producto.nombre)
            setAutocompletado(true)
          }
        })
      })

    return () => {
      cancelled = true
    }
  }, [codigo])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

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
      setError(error.message)
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
          <label className="full">
            Nombre del material
            <input
              required
              value={nombre}
              onChange={(e) => {
                setNombre(e.target.value)
                setAutocompletado(false)
              }}
              autoFocus
            />
          </label>
          {(buscandoProducto || autocompletado) && (
            <p className="full hint" style={{ marginTop: -8 }}>
              {buscandoProducto
                ? 'Buscando el producto por su código de barras…'
                : '✓ Nombre autocompletado desde el código de barras — puedes editarlo si hace falta.'}
            </p>
          )}

          <label>
            Cantidad
            <input
              type="number"
              min={0}
              step="any"
              required
              value={cantidad}
              onChange={(e) => setCantidad(Number(e.target.value))}
            />
          </label>

          <label>
            Unidad
            <input value={unidad} onChange={(e) => setUnidad(e.target.value)} placeholder="pza, kg, caja…" />
          </label>

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

          <div className="full">
            <label style={{ marginBottom: 8 }}>Categoría</label>
            <div className="cat-picker">
              {catChips.map((c) => {
                const selected = categoria === c
                const { bg, fg } = categoryColor(c)
                return (
                  <button
                    key={c}
                    type="button"
                    className={`cat-chip${selected ? ' selected' : ''}`}
                    style={selected ? { background: bg, color: fg, borderColor: fg } : undefined}
                    onClick={() => {
                      setCategoria(c)
                      setAddingCustomCat(false)
                    }}
                  >
                    {c}
                  </button>
                )
              })}
              <button type="button" className="cat-chip" onClick={() => setAddingCustomCat(true)}>
                + nueva
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

          <label className="full">
            Notas
            <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} />
          </label>
        </div>

        {error && <p className="auth-error">{error}</p>}

        <div className="form-actions">
          <button type="button" className="secondary" onClick={() => navigate('/scanner')}>
            Cancelar / seguir escaneando
          </button>
          <button type="submit" disabled={saving}>
            {saving ? 'Guardando…' : isExisting ? 'Guardar cambios' : 'Registrar'}
          </button>
        </div>
      </form>
    </div>
  )
}
