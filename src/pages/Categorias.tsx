import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import type { Categoria } from '../types'
import { categoryColor } from '../utils/categoryColors'
import { useToast } from '../context/ToastContext'

export function Categorias() {
  const [categorias, setCategorias] = useState<Categoria[]>([])
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
    const [categoriasRes, materialesRes] = await Promise.all([
      supabase.from('categorias').select('*').order('nombre'),
      supabase.from('materiales').select('categoria'),
    ])

    if (categoriasRes.error) setError(categoriasRes.error.message)
    else setCategorias(categoriasRes.data ?? [])

    const counts: Record<string, number> = {}
    for (const { categoria } of materialesRes.data ?? []) {
      if (!categoria) continue
      counts[categoria] = (counts[categoria] ?? 0) + 1
    }
    setConteos(counts)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    const nombre = nombreNuevo.trim()
    if (!nombre) return
    setCreando(true)
    const { data, error } = await supabase
      .from('categorias')
      .insert({ nombre, notas: notasNuevo.trim() || null })
      .select()
      .single()
    setCreando(false)

    if (error) {
      setError(error.message.includes('duplicate') ? `Ya existe una categoría llamada "${nombre}".` : error.message)
      return
    }

    setCategorias((prev) => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    setNombreNuevo('')
    setNotasNuevo('')
    setError(null)
    showToast('success', 'Categoría creada', nombre)
  }

  function startEdit(c: Categoria) {
    setEditingId(c.id)
    setEditNombre(c.nombre)
    setEditNotas(c.notas ?? '')
  }

  async function handleSaveEdit(id: string) {
    const nombre = editNombre.trim()
    if (!nombre) return
    const { error } = await supabase
      .from('categorias')
      .update({ nombre, notas: editNotas.trim() || null })
      .eq('id', id)

    if (error) {
      setError(error.message.includes('duplicate') ? `Ya existe una categoría llamada "${nombre}".` : error.message)
      return
    }

    setCategorias((prev) =>
      prev
        .map((c) => (c.id === id ? { ...c, nombre, notas: editNotas.trim() || null } : c))
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    )
    setEditingId(null)
  }

  async function handleDelete(c: Categoria) {
    if (!confirm(`¿Eliminar la categoría "${c.nombre}"? Los materiales que ya la tengan no se modifican.`)) return
    const { error } = await supabase.from('categorias').delete().eq('id', c.id)
    if (error) {
      setError(error.message)
      return
    }
    setCategorias((prev) => prev.filter((x) => x.id !== c.id))
    showToast('info', 'Categoría eliminada', c.nombre)
  }

  return (
    <div className="listado-page">
      <div className="listado-header">
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <h2>Categorías</h2>
          <span className="listado-count">{categorias.length} registradas</span>
        </div>
      </div>

      <form className="almacen-form" onSubmit={handleAdd}>
        <input
          placeholder="Nombre de la categoría (ej. Neumática)"
          value={nombreNuevo}
          onChange={(e) => setNombreNuevo(e.target.value)}
        />
        <input
          placeholder="Notas (opcional)"
          value={notasNuevo}
          onChange={(e) => setNotasNuevo(e.target.value)}
        />
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
      ) : categorias.length === 0 ? (
        <div className="card state-card">
          <div className="state-icon">◆</div>
          <h3>Sin categorías todavía</h3>
          <p>Agrega tu primera categoría arriba para clasificar tus materiales.</p>
        </div>
      ) : (
        <div className="almacen-list">
          {categorias.map((c) => {
            const { bg, fg } = categoryColor(c.nombre)
            return (
              <div className="card almacen-card" key={c.id}>
                {editingId === c.id ? (
                  <>
                    <div className="almacen-edit-form">
                      <input value={editNombre} onChange={(e) => setEditNombre(e.target.value)} autoFocus />
                      <input
                        value={editNotas}
                        onChange={(e) => setEditNotas(e.target.value)}
                        placeholder="Notas (opcional)"
                      />
                    </div>
                    <div className="almacen-card-actions">
                      <button className="link-btn" onClick={() => handleSaveEdit(c.id)} title="Guardar">
                        ✓
                      </button>
                      <button className="link-btn danger" onClick={() => setEditingId(null)} title="Cancelar">
                        ✕
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="almacen-card-icon" style={{ background: bg, color: fg }}>
                      ◆
                    </span>
                    <div className="almacen-card-body">
                      <div className="almacen-card-name">{c.nombre}</div>
                      {c.notas && <div className="almacen-card-notas">{c.notas}</div>}
                    </div>
                    <span className="almacen-card-count">{conteos[c.nombre] ?? 0} materiales</span>
                    <div className="almacen-card-actions">
                      <button className="link-btn" onClick={() => startEdit(c)} title="Editar">
                        ✎
                      </button>
                      <button className="link-btn danger" onClick={() => handleDelete(c)} title="Eliminar">
                        🗑
                      </button>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
