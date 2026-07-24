import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { categoryColor } from '../utils/categoryColors'
import { useCountUp } from '../utils/useCountUp'
import { STOCK_BAJO_MAX } from '../lib/constants'
import type { Material } from '../types'

function saludo() {
  const hora = new Date().getHours()
  if (hora < 12) return 'Buenos días'
  if (hora < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

interface CategoriaConteo {
  nombre: string
  cantidad: number
}

export function Dashboard() {
  const { session } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [totalMateriales, setTotalMateriales] = useState(0)
  const [totalAlmacenes, setTotalAlmacenes] = useState(0)
  const [categorias, setCategorias] = useState(0)
  const [nuevosSemana, setNuevosSemana] = useState(0)
  const [recientes, setRecientes] = useState<Material[]>([])
  const [topCategorias, setTopCategorias] = useState<CategoriaConteo[]>([])
  const [stockBajo, setStockBajo] = useState<Material[]>([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        // Si el token quedó vencido (p. ej. la pestaña estuvo en segundo
        // plano y el refresco automático de supabase-js no alcanzó a
        // correr), esto lo renueva antes de seguir — de lo contrario las
        // consultas de abajo lo usan vencido, RLS filtra todas las filas
        // sin dar error, y el dashboard se ve vacío como si la bodega no
        // tuviera nada.
        await supabase.auth.getSession()

        const haceUnaSemana = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

        const [materialesCount, almacenesCount, semanaCount, todos, recientesData] = await Promise.all([
          supabase.from('materiales').select('*', { count: 'exact', head: true }),
          supabase.from('almacenes').select('*', { count: 'exact', head: true }),
          supabase.from('materiales').select('*', { count: 'exact', head: true }).gte('created_at', haceUnaSemana),
          supabase.from('materiales').select('*'),
          supabase.from('materiales').select('*').order('created_at', { ascending: false }).limit(5),
        ])

        if (cancelled) return

        // Si cualquiera de las consultas falla (proyecto de Supabase en pausa,
        // límite de peticiones, red caída) no se debe mostrar "0 materiales"
        // como si la bodega estuviera vacía — eso engaña al usuario y a
        // cualquier otro que use la app después.
        const primerError =
          materialesCount.error ?? almacenesCount.error ?? semanaCount.error ?? todos.error ?? recientesData.error
        if (primerError) {
          setError(primerError.message)
          setLoading(false)
          return
        }

        const materiales = todos.data ?? []

        const conteoPorCategoria = new Map<string, number>()
        for (const m of materiales) {
          if (!m.categoria) continue
          conteoPorCategoria.set(m.categoria, (conteoPorCategoria.get(m.categoria) ?? 0) + 1)
        }
        const ranking = [...conteoPorCategoria.entries()]
          .map(([nombre, cantidad]) => ({ nombre, cantidad }))
          .sort((a, b) => b.cantidad - a.cantidad)
          .slice(0, 5)

        const bajoStock = materiales
          .filter((m) => m.cantidad <= STOCK_BAJO_MAX)
          .sort((a, b) => a.cantidad - b.cantidad)
          .slice(0, 5)

        setTotalMateriales(materialesCount.count ?? 0)
        setTotalAlmacenes(almacenesCount.count ?? 0)
        setNuevosSemana(semanaCount.count ?? 0)
        setCategorias(conteoPorCategoria.size)
        setTopCategorias(ranking)
        setStockBajo(bajoStock)
        setRecientes(recientesData.data ?? [])
        setLoading(false)
      } catch (e) {
        // Un fetch que falla a nivel de red (sin wifi, se perdió la señal
        // al volver de segundo plano, etc.) rechaza la promesa en vez de
        // resolver con un objeto `error` — sin este catch, loading se
        // quedaba en true para siempre y la página no se recuperaba sin
        // recargar manualmente.
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'No se pudo conectar. Revisa tu conexión e intenta de nuevo.')
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const nombreUsuario = session?.user.user_metadata?.nombre || session?.user.email?.split('@')[0] || ''
  const maxCategoria = topCategorias[0]?.cantidad ?? 1

  const cMateriales = useCountUp(totalMateriales, !loading)
  const cAlmacenes = useCountUp(totalAlmacenes, !loading)
  const cCategorias = useCountUp(categorias, !loading)
  const cNuevos = useCountUp(nuevosSemana, !loading)

  return (
    <div className="dashboard-page">
      <div className="dashboard-hero">
        <p className="dashboard-eyebrow">{saludo()}</p>
        <h1>Hola, {nombreUsuario}</h1>
        <p className="hint">Este es el estado de tus materiales hoy.</p>
      </div>

      {error ? (
        <div className="card state-card error-card">
          <div className="state-icon error">!</div>
          <h3 style={{ color: 'var(--danger)' }}>No se pudo cargar el estado</h3>
          <p>{error}</p>
          <div className="state-actions">
            <button type="button" onClick={() => setReloadKey((k) => k + 1)}>
              Reintentar
            </button>
          </div>
        </div>
      ) : (
        <>
        <div className="stat-grid">
          <div className="card stat-card">
            {loading ? <div className="skel skel-text" style={{ width: 40, height: 28 }} /> : <span className="stat-value">{cMateriales}</span>}
            <span className="stat-label">Materiales</span>
          </div>
          <div className="card stat-card">
            {loading ? <div className="skel skel-text" style={{ width: 40, height: 28 }} /> : <span className="stat-value">{cAlmacenes}</span>}
            <span className="stat-label">Almacenes</span>
          </div>
          <div className="card stat-card">
            {loading ? <div className="skel skel-text" style={{ width: 40, height: 28 }} /> : <span className="stat-value">{cCategorias}</span>}
            <span className="stat-label">Categorías</span>
          </div>
          <div className="card stat-card">
            {loading ? <div className="skel skel-text" style={{ width: 40, height: 28 }} /> : <span className="stat-value">{cNuevos}</span>}
            <span className="stat-label">Nuevos (7 días)</span>
          </div>
        </div>

        <div className="quick-actions">
          <Link to="/scanner" className="quick-action quick-action-primary">
            <span className="quick-action-icon">⊹</span>
            <span>
              <b>Escanear</b>
              <small>Registra un material nuevo</small>
            </span>
          </Link>
          <Link to="/listado" className="quick-action">
            <span className="quick-action-icon">☰</span>
            <span>
              <b>Listado</b>
              <small>Ver y exportar inventario</small>
            </span>
          </Link>
          <Link to="/almacenes" className="quick-action">
            <span className="quick-action-icon">▣</span>
            <span>
              <b>Almacenes</b>
              <small>Gestionar ubicaciones</small>
            </span>
          </Link>
          <Link to="/categorias" className="quick-action">
            <span className="quick-action-icon">◆</span>
            <span>
              <b>Categorías</b>
              <small>Organizar tipos de material</small>
            </span>
          </Link>
          <Link to="/estadisticas" className="quick-action">
            <span className="quick-action-icon">▲</span>
            <span>
              <b>Estadísticas</b>
              <small>Tendencias y distribución</small>
            </span>
          </Link>
        </div>

        <div className="dashboard-split">
          <div className="dashboard-panel">
            <h3>Materiales por categoría</h3>
            {loading ? (
              <div className="bar-list">
                {[70, 45, 30].map((w, i) => (
                  <div className="skel skel-text" key={i} style={{ width: `${w}%`, height: 30, marginBottom: 8 }} />
                ))}
              </div>
            ) : topCategorias.length === 0 ? (
              <p className="hint">Asigna categorías a tus materiales para ver la distribución aquí.</p>
            ) : (
              <div className="bar-list">
                {topCategorias.map((c) => {
                  const { fg } = categoryColor(c.nombre)
                  const pct = Math.max(6, Math.round((c.cantidad / maxCategoria) * 100))
                  return (
                    <div className="bar-row" key={c.nombre}>
                      <div className="bar-row-label">
                        <span className="bar-dot" style={{ background: fg }} />
                        <span className="bar-row-name">{c.nombre}</span>
                        <span className="bar-row-count">{c.cantidad}</span>
                      </div>
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="dashboard-panel">
            <h3>Pocas existencias</h3>
            {loading ? (
              <div className="skel skel-row" />
            ) : stockBajo.length === 0 ? (
              <p className="hint">Todo tu inventario tiene existencias saludables.</p>
            ) : (
              <div className="recent-list">
                {stockBajo.map((m) => (
                  <Link to={`/material/${encodeURIComponent(m.codigo)}`} className="recent-item low-stock-item" key={m.id}>
                    <span className="low-stock-dot" />
                    <span className="recent-item-name">{m.nombre}</span>
                    <span className="recent-item-meta">
                      {m.cantidad} {m.unidad}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="dashboard-recent">
          <h3>Últimos registrados</h3>
          {loading ? (
            <div className="recent-list">
              <div className="skel skel-row" />
              <div className="skel skel-row" />
              <div className="skel skel-row" />
            </div>
          ) : recientes.length === 0 ? (
            <p className="hint">Aún no hay material registrado — escanea el primero.</p>
          ) : (
            <div className="recent-list">
              {recientes.map((m) => (
                <Link to={`/material/${encodeURIComponent(m.codigo)}`} className="recent-item" key={m.id}>
                  <span className="mono recent-item-code">{m.codigo}</span>
                  <span className="recent-item-name">{m.nombre}</span>
                  <span className="recent-item-meta">
                    {m.cantidad} {m.unidad}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
        </>
      )}
    </div>
  )
}
