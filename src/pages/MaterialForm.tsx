import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { lookupProducto } from '../utils/lookupProducto'
import { buscarMaterialPorCodigo } from '../utils/materiales'
import { traducirError } from '../utils/errorMessages'
import type { EstadoMaterial } from '../types'

const SUGGESTED_CATEGORIAS = ['Asfalto', 'Grava', 'Cemento', 'Varilla', 'Concreto', 'Señalización', 'Mezcla asfáltica']
const UNIDADES_COMUNES = ['pza', 'kg', 'ton', 'l', 'm', 'm³', 'caja', 'rollo']
const ESTADOS: EstadoMaterial[] = ['Disponible', 'En uso', 'Prestado', 'Dañado', 'En reparación', 'Agotado']

// Texto completo mostrado en el select — el valor guardado en la base de
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
  const [sessionError, setSessionError] = useState(false)
  const [isExisting, setIsExisting] = useState(false)

  const [nombre, setNombre] = useState('')
  const [cantidad, setCantidad] = useState<number | ''>('')
  const [unidad, setUnidad] = useState('pza')
  const [almacenId, setAlmacenId] = useState('')
  const [nuevoAlmacenNombre, setNuevoAlmacenNombre] = useState('')
  const [categoria, setCategoria] = useState('')
  const [pasillo, setPasillo] = useState('')
  const [estante, setEstante] = useState('')
  const [nivel, setNivel] = useState('')
  const [estado, setEstado] = useState<EstadoMaterial>('Disponible')
  const [proveedor, setProveedor] = useState('')
  const [notas, setNotas] = useState('')
  const [unidadPersonalizada, setUnidadPersonalizada] = useState(false)
  const [almacenPersonalizado, setAlmacenPersonalizado] = useState(false)
  const [buscandoProducto, setBuscandoProducto] = useState(false)
  const [autocompletado, setAutocompletado] = useState(false)
  const [almacenes, setAlmacenes] = useState<Array<{ id: string; nombre: string }>>([])
  const [categoriasDb, setCategoriasDb] = useState<string[]>([])

  useEffect(() => {
    // Renueva el token si venció mientras la pestaña estuvo en segundo
    // plano antes de pedir los catálogos — de lo contrario RLS filtra
    // todas las filas sin dar error y las listas de sugerencias salen vacías.
    supabase.auth.getSession().then(() => {
      supabase
        .from('almacenes')
        .select('id, nombre')
        .order('nombre')
        .then(({ data }) => setAlmacenes(data ?? []))

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

        const data = await buscarMaterialPorCodigo(codigo)
        if (cancelled) return
        setLoading(false)

        if (data) {
          setBuscandoProducto(false)
          setIsExisting(true)
          setNombre(data.nombre)
          setCantidad(data.cantidad)
          setUnidad(data.unidad ?? 'pza')
          setAlmacenId(data.almacen_id ?? '')
          setCategoria(data.categoria ?? '')
          setPasillo(data.pasillo ?? '')
          setEstante(data.estante ?? '')
          setNivel(data.nivel ?? '')
          setEstado(data.estado ?? 'Disponible')
          setProveedor(data.proveedor ?? '')
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
        setError(traducirError(e))
        setLoading(false)
        setBuscandoProducto(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [codigo, showToast])

  async function guardar() {
    setError(null)
    setSessionError(false)

    if (cantidad === '') {
      setError('Ingresa la cantidad.')
      return
    }

    // La política RLS de "materiales" exige una sesión autenticada válida.
    // Si el token quedó vencido/roto (ej. otra pestaña abierta con la misma
    // cuenta renovó el token primero e invalidó este), mejor detectarlo aquí
    // con un mensaje claro que dejar que el insert falle con el error crudo
    // de Postgres. No se navega a /login desde aquí para no perder lo ya
    // escrito en el formulario — se ofrece reintentar en el mismo lugar,
    // porque si fue un problema pasajero (esa otra pestaña ya terminó de
    // renovar) el siguiente intento puede funcionar sin que el usuario
    // vuelva a escribir todo.
    const { data: sessionCheck } = await supabase.auth.getSession()
    if (!sessionCheck.session) {
      setError('Tu sesión expiró o no es válida.')
      setSessionError(true)
      return
    }

    setSaving(true)

    // Si el almacén es uno recién escrito (no estaba en la lista), se crea
    // en el catálogo de "almacenes" antes de guardar el material, para
    // tener su id real — es el campo que de verdad se guarda ahora
    // (almacen_id), "ubicacion" (texto) la mantiene sincronizada sola un
    // trigger en la base de datos.
    let almacenIdFinal = almacenId
    if (almacenPersonalizado && nuevoAlmacenNombre.trim()) {
      const nombreNuevo = nuevoAlmacenNombre.trim()
      const existente = almacenes.find((a) => a.nombre === nombreNuevo)
      if (existente) {
        almacenIdFinal = existente.id
      } else {
        const { data: creado, error: errorAlmacen } = await supabase
          .from('almacenes')
          .insert({ nombre: nombreNuevo })
          .select('id')
          .single()
        if (errorAlmacen) {
          setSaving(false)
          setError(traducirError(errorAlmacen))
          return
        }
        almacenIdFinal = creado.id
      }
    }

    const { error } = await supabase.from('materiales').upsert(
      {
        codigo,
        nombre,
        cantidad,
        unidad,
        almacen_id: almacenIdFinal || null,
        categoria,
        pasillo: pasillo.trim() || null,
        estante: estante.trim() || null,
        nivel: nivel.trim() || null,
        proveedor: proveedor.trim() || null,
        estado,
        notas,
        registrado_por: session?.user.email ?? null,
      },
      { onConflict: 'codigo' },
    )

    setSaving(false)

    if (error) {
      const esErrorDeSesion = error.message.toLowerCase().includes('row-level security')
      setError(esErrorDeSesion ? 'Tu sesión expiró o no es válida.' : traducirError(error))
      setSessionError(esErrorDeSesion)
      return
    }

    showToast('success', 'Guardado', `${codigo} · ${cantidad} ${unidad}`)
    navigate('/listado')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    await guardar()
  }

  if (loading) {
    return (
      <div className="card state-card">
        <div className="spinner" />
        <h3>Buscando código…</h3>
      </div>
    )
  }

  const opcionesCategoria = categoriasDb.length > 0 ? categoriasDb : SUGGESTED_CATEGORIAS
  const categoriaDatalist =
    categoria && !opcionesCategoria.includes(categoria) ? [...opcionesCategoria, categoria] : opcionesCategoria

  const mostrarUnidadPersonalizada = unidadPersonalizada || (unidad !== '' && !UNIDADES_COMUNES.includes(unidad))
  const mostrarAlmacenPersonalizado =
    almacenPersonalizado || (almacenId !== '' && !almacenes.some((a) => a.id === almacenId))

  return (
    <div className="form-page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <h2>{isExisting ? 'Actualizar material' : 'Registrar nuevo material'}</h2>
        <span className="status-badge">
          {codigo} · {isExisting ? 'existe' : 'nuevo'}
        </span>
        {isExisting && (
          <button
            type="button"
            className="link-btn"
            onClick={() => navigate(`/material/${encodeURIComponent(codigo)}/historial`)}
          >
            Ver historial
          </button>
        )}
      </div>
      <p className="hint">
        Código: <code>{codigo}</code> (leído del código escaneado)
      </p>

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
                  disabled={isExisting}
                  placeholder="0"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value === '' ? '' : Number(e.target.value))}
                />
                {isExisting && (
                  <span className="hint">
                    Ya no se edita aquí — ve a{' '}
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => navigate(`/escaneo/${encodeURIComponent(codigo)}`)}
                    >
                      la ficha del material
                    </button>{' '}
                    y usa "Registrar movimiento" para que quede en el historial.
                  </span>
                )}
              </label>

              <div className="unidad-field">
                <label>
                  Unidad
                  <select
                    value={mostrarUnidadPersonalizada ? 'otro' : unidad}
                    onChange={(e) => {
                      if (e.target.value === 'otro') {
                        setUnidadPersonalizada(true)
                        setUnidad('')
                      } else {
                        setUnidadPersonalizada(false)
                        setUnidad(e.target.value)
                      }
                    }}
                  >
                    {UNIDADES_COMUNES.map((u) => (
                      <option key={u} value={u}>
                        {UNIDAD_LABELS[u] ?? u}
                      </option>
                    ))}
                    <option value="otro">Otro…</option>
                  </select>
                </label>
                {mostrarUnidadPersonalizada && (
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
            <label>
              Categoría
              <input
                list="categorias-datalist"
                placeholder="Elige o escribe una categoría…"
                value={categoria}
                onChange={(e) => {
                  const valor = e.target.value
                  setCategoria(valor)
                  const sugerida = UNIDAD_SUGERIDA[valor]
                  if (sugerida) {
                    setUnidad(sugerida)
                    setUnidadPersonalizada(false)
                  }
                }}
              />
              <datalist id="categorias-datalist">
                {categoriaDatalist.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
          </div>

          <div className="form-section">
            <label>
              Almacén
              <select
                value={mostrarAlmacenPersonalizado ? 'otro' : almacenId}
                onChange={(e) => {
                  if (e.target.value === 'otro') {
                    setAlmacenPersonalizado(true)
                    setAlmacenId('')
                  } else {
                    setAlmacenPersonalizado(false)
                    setAlmacenId(e.target.value)
                  }
                }}
              >
                <option value="" disabled>
                  Elige un almacén…
                </option>
                {almacenes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
                <option value="otro">+ Crear almacén</option>
              </select>
            </label>
            {mostrarAlmacenPersonalizado && (
              <input
                autoFocus
                placeholder="Nombre del nuevo almacén"
                value={nuevoAlmacenNombre}
                onChange={(e) => setNuevoAlmacenNombre(e.target.value)}
              />
            )}
          </div>

          <div className="form-section">
            <span className="field-label">Ubicación exacta (opcional)</span>
            <div className="ubicacion-exacta-row">
              <label>
                Pasillo
                <input value={pasillo} onChange={(e) => setPasillo(e.target.value)} placeholder="Ej. A" />
              </label>
              <label>
                Estante
                <input value={estante} onChange={(e) => setEstante(e.target.value)} placeholder="Ej. 3" />
              </label>
              <label>
                Nivel
                <input value={nivel} onChange={(e) => setNivel(e.target.value)} placeholder="Ej. 2" />
              </label>
            </div>
          </div>

          <div className="form-section">
            <label>
              Estado
              <select value={estado} onChange={(e) => setEstado(e.target.value as EstadoMaterial)}>
                {ESTADOS.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="form-section">
            <label>
              Proveedor (opcional)
              <input
                value={proveedor}
                onChange={(e) => setProveedor(e.target.value)}
                placeholder="Ej. Cementos del Norte"
              />
            </label>
          </div>

          <div className="form-section">
            <label>
              Notas
              <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} />
            </label>
          </div>
        </div>

        {error && (
          <p className="auth-error">
            {error}
            {sessionError && (
              <>
                {' '}
                <button type="button" className="link-btn" onClick={() => guardar()} disabled={saving}>
                  Reintentar
                </button>
              </>
            )}
          </p>
        )}

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
