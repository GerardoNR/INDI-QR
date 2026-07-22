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
      const haceUnaSemana = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

      const [materialesCount, almacenesCount, semanaCount, todos, recientesData] = await Promise.all([
        supabase.from('materiales').select('*', { count: 'exact', head: true }),
        supabase.from('almacenes').select('*', { count: 'exact', head: true }),
        supabase.from('materiales').select('*', { count: 'exact', head: true }).gte('created_at', haceUnaSemana),
        supabase.from('materiales').select('*'),
        supabase.from('materiales').select('*').order('created_at', { ascending: false }).limit(5),
      ])

      if (cancelled) return

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
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const nombreUsuario = session?.user.email?.split('@')[0] ?? ''
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
        <p className="hint">Este es el estado de tu inventario hoy.</p>
      </div>

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
          <p className="hint">Aún no hay materiales — escanea el primero.</p>
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
    </div>
  )
}
