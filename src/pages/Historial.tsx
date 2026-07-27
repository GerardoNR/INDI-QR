import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { buscarMaterialPorCodigo } from '../utils/materiales'
import { listarMovimientos, TIPO_MOVIMIENTO_LABEL } from '../utils/movimientos'
import { formatearTiempoRelativo } from '../utils/relativeTime'
import { traducirError } from '../utils/errorMessages'
import type { Material, Movimiento } from '../types'

export function Historial() {
  const { codigo = '' } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [material, setMaterial] = useState<Material | null>(null)
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    buscarMaterialPorCodigo(codigo)
      .then(async (data) => {
        if (cancelled) return
        if (!data) {
          setError('Este código no está registrado.')
          setLoading(false)
          return
        }
        setMaterial(data)
        const lista = await listarMovimientos(data.id)
        if (cancelled) return
        setMovimientos(lista)
        setLoading(false)
      })
      .catch((e) => {
        if (cancelled) return
        setError(traducirError(e))
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [codigo])

  if (loading) {
    return (
      <div className="card state-card">
        <div className="spinner" />
        <h3>Cargando historial…</h3>
      </div>
    )
  }

  if (error || !material) {
    return (
      <div className="card state-card error-card">
        <div className="state-icon error">!</div>
        <h3 style={{ color: 'var(--danger)' }}>No se pudo cargar el historial</h3>
        <p>{error}</p>
        <div className="state-actions">
          <button type="button" onClick={() => navigate('/scanner')}>
            Volver a escanear
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="form-page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <h2>Historial de {material.nombre}</h2>
        <span className="status-badge">{codigo}</span>
      </div>
      <p className="hint">
        Cantidad actual: {material.cantidad} {material.unidad ?? ''}
      </p>

      {movimientos.length === 0 ? (
        <div className="card state-card">
          <p>Todavía no hay movimientos registrados para este material.</p>
        </div>
      ) : (
        <ul className="movimientos-list">
          {movimientos.map((mov) => (
            <li key={mov.id} className="movimiento-item">
              <div className="movimiento-item-head">
                <span className={`tipo-badge tipo-${mov.tipo}`}>{TIPO_MOVIMIENTO_LABEL[mov.tipo]}</span>
                <span className="movimiento-fecha" title={new Date(mov.created_at).toLocaleString('es-MX')}>
                  {formatearTiempoRelativo(mov.created_at)}
                </span>
              </div>
              <p className="movimiento-cantidad">
                {mov.tipo === 'ajuste' ? `Nuevo valor: ${mov.cantidad}` : `${mov.cantidad} ${material.unidad ?? ''}`}
                {mov.tipo === 'transferencia' && mov.destino ? ` → ${mov.destino}` : ''}
              </p>
              <p className="hint">Responsable: {mov.responsable}</p>
              {mov.observaciones && <p className="hint">{mov.observaciones}</p>}
            </li>
          ))}
        </ul>
      )}

      <div className="form-actions">
        <button
          type="button"
          className="secondary"
          onClick={() => navigate(`/material/${encodeURIComponent(codigo)}`)}
        >
          ← Volver a la ficha
        </button>
      </div>
    </div>
  )
}
