import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { categoryColor } from '../utils/categoryColors'
import type { Material } from '../types'

function ultimosNDias(n: number) {
  const dias: string[] = []
  const hoy = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(hoy)
    d.setDate(d.getDate() - i)
    dias.push(d.toISOString().slice(0, 10))
  }
  return dias
}

interface Conteo {
  nombre: string
  cantidad: number
}

export function Estadisticas() {
  const [loading, setLoading] = useState(true)
  const [porAlmacen, setPorAlmacen] = useState<Conteo[]>([])
  const [porCategoria, setPorCategoria] = useState<Conteo[]>([])
  const [timeline, setTimeline] = useState<{ dia: string; cantidad: number }[]>([])

  useEffect(() => {
    let cancelled = false

    supabase
      .from('materiales')
      .select('*')
      .then(({ data }) => {
        if (cancelled) return
        const materiales = (data ?? []) as Material[]

        const almacenMap = new Map<string, number>()
        const categoriaMap = new Map<string, number>()
        for (const m of materiales) {
          const alm = m.ubicacion?.trim() || 'Sin ubicación'
          almacenMap.set(alm, (almacenMap.get(alm) ?? 0) + 1)
          const cat = m.categoria?.trim() || 'Sin categoría'
          categoriaMap.set(cat, (categoriaMap.get(cat) ?? 0) + 1)
        }

        const dias = ultimosNDias(14)
        const porDia = new Map(dias.map((d) => [d, 0]))
        for (const m of materiales) {
          const dia = m.created_at.slice(0, 10)
          if (porDia.has(dia)) porDia.set(dia, (porDia.get(dia) ?? 0) + 1)
        }

        setPorAlmacen(
          [...almacenMap.entries()]
            .map(([nombre, cantidad]) => ({ nombre, cantidad }))
            .sort((a, b) => b.cantidad - a.cantidad),
        )
        setPorCategoria(
          [...categoriaMap.entries()]
            .map(([nombre, cantidad]) => ({ nombre, cantidad }))
            .sort((a, b) => b.cantidad - a.cantidad),
        )
        setTimeline(dias.map((dia) => ({ dia, cantidad: porDia.get(dia) ?? 0 })))
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const maxAlmacen = Math.max(1, ...porAlmacen.map((a) => a.cantidad))
  const maxCategoria = Math.max(1, ...porCategoria.map((c) => c.cantidad))
  const maxDia = Math.max(1, ...timeline.map((d) => d.cantidad))

  return (
    <div className="listado-page">
      <div className="listado-header">
        <h2>Estadísticas</h2>
      </div>

      {loading ? (
        <>
          <div className="dashboard-panel" style={{ marginBottom: 16 }}>
            <h3>Registros por día (últimos 14 días)</h3>
            <div className="skel" style={{ height: 140, borderRadius: 12 }} />
          </div>
          <div className="dashboard-split">
            <div className="dashboard-panel">
              <h3>Materiales por almacén</h3>
              <div className="skel skel-text" style={{ width: '70%', height: 30, marginBottom: 8 }} />
              <div className="skel skel-text" style={{ width: '45%', height: 30 }} />
            </div>
            <div className="dashboard-panel">
              <h3>Materiales por categoría</h3>
              <div className="skel skel-text" style={{ width: '60%', height: 30, marginBottom: 8 }} />
              <div className="skel skel-text" style={{ width: '35%', height: 30 }} />
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="dashboard-panel" style={{ marginBottom: 16 }}>
            <h3>Registros por día (últimos 14 días)</h3>
            <div className="timeline-chart">
              {timeline.map((d) => (
                <div className="timeline-bar-wrap" key={d.dia} title={`${d.dia} · ${d.cantidad} registro(s)`}>
                  <div
                    className="timeline-bar"
                    style={{ height: `${Math.max(6, Math.round((d.cantidad / maxDia) * 100))}%` }}
                  />
                  <span className="timeline-label">{d.dia.slice(8, 10)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="dashboard-split">
            <div className="dashboard-panel">
              <h3>Materiales por almacén</h3>
              {porAlmacen.length === 0 ? (
                <p className="hint">Aún no hay materiales registrados.</p>
              ) : (
                <div className="bar-list">
                  {porAlmacen.map((a) => (
                    <div className="bar-row" key={a.nombre}>
                      <div className="bar-row-label">
                        <span className="bar-row-name">{a.nombre}</span>
                        <span className="bar-row-count">{a.cantidad}</span>
                      </div>
                      <div className="bar-track">
                        <div
                          className="bar-fill"
                          style={{ width: `${Math.max(6, Math.round((a.cantidad / maxAlmacen) * 100))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="dashboard-panel">
              <h3>Materiales por categoría</h3>
              {porCategoria.length === 0 ? (
                <p className="hint">Aún no hay materiales registrados.</p>
              ) : (
                <div className="bar-list">
                  {porCategoria.map((c) => {
                    const { fg } = categoryColor(c.nombre === 'Sin categoría' ? '' : c.nombre)
                    return (
                      <div className="bar-row" key={c.nombre}>
                        <div className="bar-row-label">
                          <span className="bar-dot" style={{ background: fg }} />
                          <span className="bar-row-name">{c.nombre}</span>
                          <span className="bar-row-count">{c.cantidad}</span>
                        </div>
                        <div className="bar-track">
                          <div
                            className="bar-fill"
                            style={{ width: `${Math.max(6, Math.round((c.cantidad / maxCategoria) * 100))}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
