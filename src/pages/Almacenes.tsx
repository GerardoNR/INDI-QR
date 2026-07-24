import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import type { Almacen } from '../types'
import { useToast } from '../context/ToastContext'

export function Almacenes() {
  const [almacenes, setAlmacenes] = useState<Almacen[]>([])
  const [conteos, setConteos] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { showToast } = useToast()

  const [nombreNuevo, setNombreNuevo] = useState('')
  const [notasNuevo, setNotasNuevo] = useState('')
  const [creando, setCreando] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [editNotas, setEditNotas] = useState('')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      // Renueva el token si venció mientras la pestaña estaba en segundo
      // plano — de lo contrario las consultas de abajo lo usan vencido,
      // RLS filtra todas las filas sin dar error, y la lista se ve vacía.
      await supabase.auth.getSession()

      const [almacenesRes, materialesRes] = await Promise.all([
        supabase.from('almacenes').select('*').order('nombre'),
        supabase.from('materiales').select('ubicacion'),
      ])

      if (almacenesRes.error) setError(almacenesRes.error.message)
      else setAlmacenes(almacenesRes.data ?? [])

      const counts: Record<string, number> = {}
      for (const { ubicacion } of materialesRes.data ?? []) {
        if (!ubicacion) continue
        counts[ubicacion] = (counts[ubicacion] ?? 0) + 1
      }
      setConteos(counts)
    } catch (e) {
      // Un fetch que falla a nivel de red dejaba loading en true para
      // siempre — sin este catch la página no se recuperaba sin recargar.
      setError(e instanceof Error ? e.message : 'No se pudo conectar. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    const nombre = nombreNuevo.trim()
    if (!nombre) return
    setCreando(true)
    // Renueva el token si venció mientras se llenaba el formulario — de lo
    // contrario el insert lo rechaza por RLS con un error crudo de Postgres.
    await supabase.auth.getSession()
    const { data, error } = await supabase.from('almacenes').insert({ nombre, notas: notasNuevo.trim() || null }).select().single()
    setCreando(false)

    if (error) {
      setError(
        error.message.includes('duplicate')
          ? `Ya existe un almacén llamado "${nombre}".`
          : error.message.toLowerCase().includes('row-level security')
            ? 'Tu sesión expiró o no es válida. Vuelve a iniciar sesión e intenta de nuevo.'
            : error.message,
      )
      return
    }

    setAlmacenes((prev) => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    setNombreNuevo('')
    setNotasNuevo('')
    setError(null)
    showToast('success', 'Almacén creado', nombre)
  }

  function startEdit(a: Almacen) {
    setEditingId(a.id)
    setEditNombre(a.nombre)
    setEditNotas(a.notas ?? '')
  }

  async function handleSaveEdit(id: string) {
    const nombre = editNombre.trim()
    if (!nombre) return
    await supabase.auth.getSession()
    const { error } = await supabase
      .from('almacenes')
      .update({ nombre, notas: editNotas.trim() || null })
      .eq('id', id)

    if (error) {
      setError(
        error.message.includes('duplicate')
          ? `Ya existe un almacén llamado "${nombre}".`
          : error.message.toLowerCase().includes('row-level security')
            ? 'Tu sesión expiró o no es válida. Vuelve a iniciar sesión e intenta de nuevo.'
            : error.message,
      )
      return
    }

    setAlmacenes((prev) =>
      prev
        .map((a) => (a.id === id ? { ...a, nombre, notas: editNotas.trim() || null } : a))
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    )
    setEditingId(null)
  }

  async function handleDelete(a: Almacen) {
    if (!confirm(`¿Eliminar el almacén "${a.nombre}"? Los materiales que ya tengan esta ubicación no se modifican.`)) return
    await supabase.auth.getSession()
    const { error } = await supabase.from('almacenes').delete().eq('id', a.id)
    if (error) {
      setError(
        error.message.toLowerCase().includes('row-level security')
          ? 'Tu sesión expiró o no es válida. Vuelve a iniciar sesión e intenta de nuevo.'
          : error.message,
      )
      return
    }
    setAlmacenes((prev) => prev.filter((x) => x.id !== a.id))
    showToast('info', 'Almacén eliminado', a.nombre)
  }

  return (
    <div className="listado-page">
      <div className="listado-header">
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <h2>Almacenes</h2>
          <span className="listado-count">{almacenes.length} registrados</span>
        </div>
      </div>

      <form className="almacen-form" onSubmit={handleAdd}>
        <label style={{ flex: 1, minWidth: 160 }}>
          Nombre del almacén
          <input
            placeholder="Ej. Almacén 1"
            value={nombreNuevo}
            onChange={(e) => setNombreNuevo(e.target.value)}
          />
        </label>
        <label style={{ flex: 1, minWidth: 160 }}>
          Notas (opcional)
          <input
            placeholder="Opcional"
            value={notasNuevo}
            onChange={(e) => setNotasNuevo(e.target.value)}
          />
        </label>
        <button type="submit" disabled={creando || !nombreNuevo.trim()}>
          {creando ? 'Agregando…' : '+ Agregar'}
        </button>
      </form>

      {error && <p className="auth-error">{error}</p>}

      {loading ? (
        <div className="almacen-list">
          <div className="skel skel-row" />
          <div className="skel skel-row" />
          <div className="skel skel-row" />
        </div>
      ) : almacenes.length === 0 ? (
        <div className="card state-card">
          <div className="state-icon">▣</div>
          <h3>Sin almacenes todavía</h3>
          <p>Agrega tu primer almacén arriba para organizar los rieles (materiales) que llegan a cada bodega.</p>
        </div>
      ) : (
        <div className="almacen-list">
          {almacenes.map((a) => (
            <div className="card almacen-card" key={a.id}>
              {editingId === a.id ? (
                <>
                  <div className="almacen-edit-form">
                    <label style={{ flex: 1, minWidth: 120 }}>
                      Nombre del almacén
                      <input value={editNombre} onChange={(e) => setEditNombre(e.target.value)} autoFocus />
                    </label>
                    <label style={{ flex: 1, minWidth: 120 }}>
                      Notas (opcional)
                      <input
                        value={editNotas}
                        onChange={(e) => setEditNotas(e.target.value)}
                        placeholder="Opcional"
                      />
                    </label>
                  </div>
                  <div className="almacen-card-actions">
                    <button className="link-btn" onClick={() => handleSaveEdit(a.id)} title="Guardar">
                      ✓
                    </button>
                    <button className="link-btn danger" onClick={() => setEditingId(null)} title="Cancelar">
                      ✕
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className="almacen-card-icon">▣</span>
                  <div className="almacen-card-body">
                    <div className="almacen-card-name">{a.nombre}</div>
                    {a.notas && <div className="almacen-card-notas">{a.notas}</div>}
                  </div>
                  <span className="almacen-card-count">{conteos[a.nombre] ?? 0} materiales</span>
                  <div className="almacen-card-actions">
                    <button className="link-btn" onClick={() => startEdit(a)} title="Editar">
                      ✎
                    </button>
                    <button className="link-btn danger" onClick={() => handleDelete(a)} title="Eliminar">
                      🗑
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
