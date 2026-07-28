import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { supabase } from '../lib/supabase'
import { buscarMaterialPorCodigo } from '../utils/materiales'
import { registrarMovimiento, listarMovimientos, TIPO_MOVIMIENTO_LABEL } from '../utils/movimientos'
import { formatearTiempoRelativo, formatearFechaHora } from '../utils/relativeTime'
import { traducirError } from '../utils/errorMessages'
import type { Material, Movimiento, TipoMovimiento } from '../types'

type Estado = 'buscando' | 'encontrado' | 'no-encontrado' | 'error'
type Vista = 'ficha' | 'movimiento'

function fechaLocalParaInput(fecha: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}T${pad(fecha.getHours())}:${pad(fecha.getMinutes())}`
}

export function ScanResult() {
  const { codigo = '' } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const { showToast } = useToast()

  const [estado, setEstado] = useState<Estado>('buscando')
  const [vista, setVista] = useState<Vista>('ficha')
  const [material, setMaterial] = useState<Material | null>(null)
  const [ultimoMovimiento, setUltimoMovimiento] = useState<Movimiento | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [almacenes, setAlmacenes] = useState<Array<{ id: string; nombre: string }>>([])
  const [tipo, setTipo] = useState<TipoMovimiento>('entrada')
  const [cantidadMov, setCantidadMov] = useState<number | ''>('')
  const [almacenOrigenId, setAlmacenOrigenId] = useState('')
  const [almacenDestinoId, setAlmacenDestinoId] = useState('')
  const [responsable, setResponsable] = useState('')
  const [fecha, setFecha] = useState(() => fechaLocalParaInput(new Date()))
  const [observaciones, setObservaciones] = useState('')
  const [guardandoMov, setGuardandoMov] = useState(false)
  const [errorMov, setErrorMov] = useState<string | null>(null)
  const [confirmacion, setConfirmacion] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('almacenes')
      .select('id, nombre')
      .order('nombre')
      .then(({ data }) => setAlmacenes(data ?? []))
  }, [])

  // Reutilizada tanto al montar como después de guardar un movimiento —
  // así la ficha siempre refleja la cantidad y el "último movimiento" de
  // verdad, sin duplicar la consulta en dos lugares.
  const cargarFicha = useCallback(async (): Promise<boolean> => {
    const data = await buscarMaterialPorCodigo(codigo)
    if (!data) return false
    setMaterial(data)
    const movimientos = await listarMovimientos(data.id)
    setUltimoMovimiento(movimientos[0] ?? null)
    return true
  }, [codigo])

  useEffect(() => {
    let cancelled = false
    setEstado('buscando')
    setVista('ficha')
    setError(null)

    cargarFicha()
      .then((encontrado) => {
        if (cancelled) return
        setEstado(encontrado ? 'encontrado' : 'no-encontrado')
      })
      .catch((e) => {
        if (cancelled) return
        setError(traducirError(e))
        setEstado('error')
      })

    return () => {
      cancelled = true
    }
  }, [codigo, cargarFicha])

  function abrirFormularioMovimiento() {
    setTipo('entrada')
    setCantidadMov('')
    // El almacén de origen casi siempre es donde el material ya está — se
    // precarga para no hacer que el usuario elija algo que de todos modos
    // tiene que coincidir con esto (el trigger lo exige para salida y
    // transferencia).
    setAlmacenOrigenId(material?.almacen_id ?? '')
    setAlmacenDestinoId('')
    setResponsable(session?.user.email ?? '')
    setFecha(fechaLocalParaInput(new Date()))
    setObservaciones('')
    setErrorMov(null)
    setConfirmacion(null)
    setVista('movimiento')
  }

  function cambiarTipo(nuevoTipo: TipoMovimiento) {
    setTipo(nuevoTipo)
    // Hoy un material vive entero en un solo almacén (no existe una tabla
    // de existencias por almacén) — una transferencia siempre mueve TODO
    // lo que hay, así que no tiene sentido pedir una cantidad editable.
    setCantidadMov(nuevoTipo === 'transferencia' ? material?.cantidad ?? '' : '')
  }

  async function handleGuardarMovimiento(e: FormEvent) {
    e.preventDefault()
    setErrorMov(null)

    if (cantidadMov === '' || cantidadMov < 0) {
      setErrorMov('Ingresa una cantidad válida.')
      return
    }
    if (tipo !== 'ajuste' && cantidadMov <= 0) {
      setErrorMov('La cantidad debe ser mayor a 0.')
      return
    }
    if ((tipo === 'salida' || tipo === 'transferencia') && !almacenOrigenId) {
      setErrorMov('Elige el almacén de origen.')
      return
    }
    if ((tipo === 'entrada' || tipo === 'transferencia') && !almacenDestinoId) {
      setErrorMov('Elige el almacén de destino.')
      return
    }
    if (tipo === 'transferencia' && almacenOrigenId === almacenDestinoId) {
      setErrorMov('El almacén de origen y de destino no pueden ser el mismo.')
      return
    }
    if (!responsable.trim()) {
      setErrorMov('Ingresa quién es el responsable.')
      return
    }
    // Chequeos rápidos en el cliente para dar el error al instante — el
    // trigger en la base de datos (aplicar_movimiento) es quien de verdad
    // lo garantiza, por si algo cambió entre que se cargó la ficha y que
    // se guarda el movimiento.
    if (tipo === 'salida' && material && cantidadMov > material.cantidad) {
      setErrorMov(`No hay suficiente cantidad disponible (actual: ${material.cantidad} ${material.unidad ?? ''}).`)
      return
    }
    if (tipo === 'transferencia' && material && cantidadMov !== material.cantidad) {
      setErrorMov(`Una transferencia debe ser por toda la cantidad actual (${material.cantidad} ${material.unidad ?? ''}).`)
      return
    }

    setGuardandoMov(true)
    try {
      await registrarMovimiento({
        material_id: material!.id,
        tipo,
        cantidad: cantidadMov,
        destino: null,
        almacen_origen_id: tipo === 'salida' || tipo === 'transferencia' ? almacenOrigenId : null,
        almacen_destino_id: tipo === 'entrada' || tipo === 'transferencia' ? almacenDestinoId : null,
        responsable: responsable.trim(),
        observaciones: observaciones.trim() || null,
        created_at: new Date(fecha).toISOString(),
      })
      const fechaGuardado = new Date(fecha).toISOString()
      await cargarFicha()
      setVista('ficha')
      setConfirmacion(`Registrado el ${formatearFechaHora(fechaGuardado)}`)
      showToast('success', 'Movimiento registrado', `${TIPO_MOVIMIENTO_LABEL[tipo]} · ${formatearFechaHora(fechaGuardado)}`)
    } catch (e) {
      setErrorMov(traducirError(e, 'No se pudo registrar el movimiento.'))
    } finally {
      setGuardandoMov(false)
    }
  }

  if (estado === 'buscando') {
    return (
      <div className="card state-card">
        <div className="spinner" />
        <h3>QR leído correctamente</h3>
        <p>
          Buscando información de <code>{codigo}</code>…
        </p>
      </div>
    )
  }

  if (estado === 'error') {
    return (
      <div className="card state-card error-card">
        <div className="state-icon error">!</div>
        <h3 style={{ color: 'var(--danger)' }}>No se pudo buscar el código</h3>
        <p>{error}</p>
        <div className="state-actions">
          <button type="button" onClick={() => navigate('/scanner')}>
            Volver a escanear
          </button>
        </div>
      </div>
    )
  }

  if (estado === 'no-encontrado') {
    return (
      <div className="card state-card">
        <div className="state-icon">⚠</div>
        <h3>Este código aún no está registrado</h3>
        <p>
          <code>{codigo}</code> no existe todavía en el inventario. ¿Deseas registrarlo como un nuevo material?
        </p>
        <div className="state-actions">
          <button type="button" onClick={() => navigate(`/material/${encodeURIComponent(codigo)}`)}>
            Registrar
          </button>
          <button type="button" className="secondary" onClick={() => navigate('/scanner')}>
            Seguir escaneando
          </button>
        </div>
      </div>
    )
  }

  const m = material as Material

  if (vista === 'movimiento') {
    return (
      <div className="card state-card scan-result-card">
        <h3>Registrar movimiento</h3>
        <p className="hint">
          {m.nombre} · <code>{codigo}</code>
        </p>

        <form onSubmit={handleGuardarMovimiento} noValidate>
          <label>
            Tipo de movimiento
            <select value={tipo} onChange={(e) => cambiarTipo(e.target.value as TipoMovimiento)}>
              <option value="entrada">Entrada</option>
              <option value="salida">Salida</option>
              <option value="transferencia">Transferencia</option>
              <option value="ajuste">Ajuste</option>
            </select>
          </label>

          {tipo === 'transferencia' ? (
            <label>
              Cantidad a transferir
              <input type="number" value={cantidadMov} disabled />
            </label>
          ) : (
            <label>
              {tipo === 'ajuste' ? 'Nueva cantidad' : 'Cantidad'}
              <input
                type="number"
                min={0}
                step="any"
                required
                autoFocus
                value={cantidadMov}
                onChange={(e) => setCantidadMov(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </label>
          )}
          {tipo === 'transferencia' && (
            <p className="hint">Se transfiere todo lo disponible — todavía no se puede mover solo una parte.</p>
          )}

          {(tipo === 'salida' || tipo === 'transferencia') && (
            <label>
              Almacén de origen
              <select required value={almacenOrigenId} onChange={(e) => setAlmacenOrigenId(e.target.value)}>
                <option value="" disabled>
                  Elige un almacén…
                </option>
                {almacenes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
              </select>
            </label>
          )}

          {(tipo === 'entrada' || tipo === 'transferencia') && (
            <label>
              Almacén de destino
              <select required value={almacenDestinoId} onChange={(e) => setAlmacenDestinoId(e.target.value)}>
                <option value="" disabled>
                  Elige un almacén…
                </option>
                {almacenes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label>
            Responsable
            <input required value={responsable} onChange={(e) => setResponsable(e.target.value)} />
          </label>

          <label>
            Fecha
            <input type="datetime-local" required value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </label>

          <label>
            Observaciones (opcional)
            <textarea rows={3} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
          </label>

          {errorMov && <p className="auth-error">{errorMov}</p>}

          <div className="form-actions">
            <button type="button" className="secondary" onClick={() => setVista('ficha')} disabled={guardandoMov}>
              Cancelar
            </button>
            <button type="submit" disabled={guardandoMov}>
              {guardandoMov ? 'Guardando…' : 'Guardar movimiento'}
            </button>
          </div>
        </form>
      </div>
    )
  }

  const fechaUltimoMovimiento = ultimoMovimiento?.created_at ?? m.created_at

  return (
    <div className="card state-card scan-result-card">
      <div className="state-icon">✓</div>
      <h3>{m.nombre}</h3>
      <p className="hint">
        Código escaneado: <code>{codigo}</code>
      </p>
      {confirmacion && <p className="auth-info">{confirmacion}</p>}

      <dl className="material-summary">
        <div>
          <dt>Categoría</dt>
          <dd>{m.categoria || '—'}</dd>
        </div>
        <div>
          <dt>Ubicación</dt>
          <dd>{m.ubicacion || '—'}</dd>
        </div>
        <div>
          <dt>Cantidad actual</dt>
          <dd>
            {m.cantidad} {m.unidad ?? ''}
          </dd>
        </div>
        <div>
          <dt>Último movimiento</dt>
          <dd>{formatearTiempoRelativo(fechaUltimoMovimiento)}</dd>
        </div>
      </dl>

      <div className="state-actions">
        <button type="button" onClick={() => navigate(`/material/${encodeURIComponent(codigo)}`)}>
          Ver detalles
        </button>
        <button type="button" className="secondary" onClick={abrirFormularioMovimiento}>
          Registrar movimiento
        </button>
        <button
          type="button"
          className="link-btn"
          onClick={() => navigate(`/material/${encodeURIComponent(codigo)}/historial`)}
        >
          Ver historial
        </button>
      </div>
    </div>
  )
}
