import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Material } from '../types'
import { exportExcel, exportPDF } from '../utils/export'
import { categoryColor } from '../utils/categoryColors'
import { useToast } from '../context/ToastContext'
import { traducirError } from '../utils/errorMessages'

export function Listado() {
  const [materiales, setMateriales] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const { showToast } = useToast()

  async function load() {
    setLoading(true)
    setError(null)
    try {
      // Renueva el token si venció mientras la pestaña estaba en segundo
      // plano — de lo contrario la consulta de abajo lo usa vencido, RLS
      // filtra todas las filas sin dar error, y la lista se ve vacía.
      await supabase.auth.getSession()

      const { data, error } = await supabase
        .from('materiales')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) setError(traducirError(error))
      else setMateriales(data ?? [])
    } catch (e) {
      // Un fetch que falla a nivel de red dejaba loading en true para
      // siempre — sin este catch la página no se recuperaba sin recargar.
      setError(traducirError(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return materiales
    return materiales.filter((m) =>
      [m.codigo, m.nombre, m.categoria, m.ubicacion, m.registrado_por]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    )
  }, [materiales, query])

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este registro?')) return
    const material = materiales.find((m) => m.id === id)
    await supabase.auth.getSession()
    const { error } = await supabase.from('materiales').delete().eq('id', id)
    if (error) {
      setError(
        error.message.toLowerCase().includes('row-level security')
          ? 'Tu sesión expiró o no es válida. Vuelve a iniciar sesión e intenta de nuevo.'
          : traducirError(error),
      )
      return
    }
    setMateriales((prev) => prev.filter((m) => m.id !== id))
    showToast('info', 'Eliminado', material?.codigo)
  }

  return (
    <div className="listado-page">
      <div className="listado-header">
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <h2>Materiales</h2>
          <span className="listado-count">{filtered.length} registros</span>
        </div>
      </div>

      <div className="listado-toolbar">
        <input
          placeholder="Buscar por código, nombre, ubicación…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button onClick={() => exportPDF(filtered)} disabled={filtered.length === 0}>
          PDF
        </button>
        <button onClick={() => exportExcel(filtered)} disabled={filtered.length === 0}>
          Excel
        </button>
        <Link to="/scanner" className="btn-primary-link">
          ⊹ Escanear
        </Link>
      </div>

      {error && <p className="auth-error">{error}</p>}

      {loading ? (
        <div className="almacen-list">
          <div className="skel skel-row" />
          <div className="skel skel-row" />
          <div className="skel skel-row" />
          <div className="skel skel-row" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card state-card">
          <div className="state-icon">
            <div
              style={{
                width: 30,
                height: 30,
                border: '2.5px dashed var(--border-input)',
                borderRadius: 9,
              }}
            />
          </div>
          <h3>Sin registros todavía</h3>
          <p>Escanea un código para empezar a registrar tus materiales.</p>
          <Link to="/scanner" className="btn-primary-link">
            ⊹ Escanear el primero
          </Link>
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <div className="mat-row mat-head">
              <span>Código</span>
              <span>Nombre</span>
              <span>Cantidad</span>
              <span>Ubicación</span>
              <span>Categoría</span>
              <span>Registró</span>
              <span></span>
            </div>
            {filtered.map((m) => {
              const { bg, fg } = categoryColor(m.categoria)
              return (
                <div className="mat-row" key={m.id}>
                  <span className="mat-code">{m.codigo}</span>
                  <span className="mat-name">{m.nombre}</span>
                  <span>
                    <b>{m.cantidad}</b> <span style={{ color: 'var(--text-soft)' }}>{m.unidad}</span>
                  </span>
                  <span style={{ color: 'var(--text)' }}>{m.ubicacion}</span>
                  <span>
                    {m.categoria && (
                      <span className="cat-badge" style={{ background: bg, color: fg }}>
                        {m.categoria}
                      </span>
                    )}
                  </span>
                  <span style={{ color: 'var(--text)', fontSize: 13 }}>{m.registrado_por}</span>
                  <span className="mat-actions">
                    <Link to={`/material/${encodeURIComponent(m.codigo)}`} title="Editar">
                      ✎
                    </Link>
                    <button className="link-btn danger" onClick={() => handleDelete(m.id)} title="Eliminar">
                      🗑
                    </button>
                  </span>
                </div>
              )
            })}
          </div>

          <div className="material-cards">
            {filtered.map((m) => {
              const { bg, fg } = categoryColor(m.categoria)
              return (
                <div className="material-card" key={m.id}>
                  <div className="material-card-top">
                    <div>
                      <div className="mono" style={{ fontSize: 11, color: 'var(--text-soft)' }}>
                        {m.codigo}
                      </div>
                      <div className="mat-name" style={{ fontSize: 15, marginTop: 2 }}>
                        {m.nombre}
                      </div>
                    </div>
                    {m.categoria && (
                      <span className="cat-badge" style={{ background: bg, color: fg }}>
                        {m.categoria}
                      </span>
                    )}
                  </div>
                  <div className="material-card-meta">
                    <span>
                      <b style={{ color: 'var(--ink)' }}>{m.cantidad}</b> {m.unidad}
                    </span>
                    {m.ubicacion && <span>📍 {m.ubicacion}</span>}
                  </div>
                  <div className="material-card-actions">
                    <Link to={`/material/${encodeURIComponent(m.codigo)}`}>Editar</Link>
                    <button className="link-btn danger" onClick={() => handleDelete(m.id)}>
                      Eliminar
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
