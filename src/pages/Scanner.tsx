import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarcodeFormat, BrowserMultiFormatReader } from '@zxing/browser'
import { DecodeHintType } from '@zxing/library'

interface ScannerControls {
  stop: () => void
  switchTorch?: (on: boolean) => Promise<void>
}

// Formatos que de verdad usa la app — cualquier otro (PDF417, Aztec,
// MaxiCode, Data Matrix, Codabar, ITF…) solo hace que cada intento de
// decodificar tarde más, sin ninguna ganancia real para códigos de
// materiales/productos.
const ZXING_FORMATS = [
  BarcodeFormat.QR_CODE,
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.CODE_128,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_39,
]

// Mismos formatos, pero con los nombres que usa la Barcode Detection API
// nativa del navegador (Chrome/Android) en vez del enum de ZXing.
const NATIVE_FORMATS = ['qr_code', 'ean_13', 'ean_8', 'code_128', 'upc_a', 'upc_e', 'code_39']

// Sin TRY_HARDER: ese hint hace que ZXing pruebe rotaciones/variantes extra
// por cada frame para exprimir precisión, a costa de velocidad. En un
// stream de video no hace falta — si un frame no se lee, el siguiente
// (60ms después) es prácticamente gratis, así que conviene priorizar
// velocidad por intento sobre precisión por intento.
const hints = new Map<DecodeHintType, unknown>([[DecodeHintType.POSSIBLE_FORMATS, ZXING_FORMATS]])

// 1280x720 en vez de 1920x1080: en celulares de gama media/baja, decodificar
// cada frame a Full HD es notablemente más lento que a 720p, sin mejorar la
// lectura real — el código casi siempre ocupa solo una fracción del cuadro.
const IDEAL_WIDTH = 1280
const IDEAL_HEIGHT = 720

// focusMode no está tipado en lib.dom.d.ts, pero sí lo soportan
// Chrome/Android; sin enfoque continuo los códigos pequeños salen borrosos
// y tardan varios intentos en leerse. Algunas versiones de Safari/iOS
// rechazan toda la petición si no reconocen "advanced.focusMode" en vez de
// ignorarla como indica el estándar, así que siempre se intenta primero con
// esto y se cae a la versión sin "advanced" si falla.
const VIDEO_CONSTRAINTS_WITH_FOCUS: MediaTrackConstraints = {
  facingMode: 'environment',
  width: { ideal: IDEAL_WIDTH },
  height: { ideal: IDEAL_HEIGHT },
  advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet],
}

const VIDEO_CONSTRAINTS_PLAIN: MediaTrackConstraints = {
  facingMode: 'environment',
  width: { ideal: IDEAL_WIDTH },
  height: { ideal: IDEAL_HEIGHT },
}

// Si el mismo código se detecta más de una vez dentro de esta ventana
// (frames sucesivos del mismo cuadro, o el intervalo entre "ya se detectó"
// y que el stream/lector alcance a detenerse del todo), se ignoran los
// repetidos en vez de disparar otra navegación/vibración.
const DUPLICATE_WINDOW_MS = 1500

async function getCameraStream(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({ video: VIDEO_CONSTRAINTS_WITH_FOCUS })
  } catch {
    return navigator.mediaDevices.getUserMedia({ video: VIDEO_CONSTRAINTS_PLAIN })
  }
}

// La Barcode Detection API nativa (Chrome/Android) decodifica bitmaps con
// el propio motor del navegador — no compite por CPU con JS como ZXing, así
// que en los navegadores donde existe es la opción más rápida. Donde no
// existe (Safari/iOS, Firefox) se usa ZXing como respaldo.
async function startNativeScanner(
  video: HTMLVideoElement,
  onDetected: (codigo: string) => void,
): Promise<ScannerControls> {
  const stream = await getCameraStream()
  video.srcObject = stream
  await video.play()

  const detector = new window.BarcodeDetector!({ formats: NATIVE_FORMATS })
  const track = stream.getVideoTracks()[0]

  let stopped = false
  let rafId = 0

  async function tick() {
    if (stopped) return
    try {
      const codes = await detector.detect(video)
      if (codes.length > 0 && !stopped) {
        onDetected(codes[0].rawValue)
      }
    } catch {
      // Frame aún no listo (video sin datos, tamaño 0 en el primer
      // instante, etc.) — se ignora y se reintenta con el siguiente frame.
    }
    if (!stopped) rafId = requestAnimationFrame(tick)
  }
  rafId = requestAnimationFrame(tick)

  const capabilities = track.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined

  return {
    stop() {
      if (stopped) return
      stopped = true
      cancelAnimationFrame(rafId)
      stream.getTracks().forEach((t) => t.stop())
    },
    switchTorch: capabilities?.torch
      ? async (on) => {
          await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] })
        }
      : undefined,
  }
}

// getUserMedia rechaza con un DOMException cuyo .name (no .message, que
// suele venir vacío) indica la causa — se traduce por nombre en vez de
// mostrar el .message crudo (casi siempre en inglés o vacío).
const ERRORES_CAMARA: Record<string, string> = {
  NotAllowedError: 'Permiso de cámara denegado.',
  NotFoundError: 'No se encontró ninguna cámara en este dispositivo.',
  NotReadableError: 'La cámara está siendo usada por otra aplicación.',
  OverconstrainedError: 'Ninguna cámara cumple con lo que se le pidió.',
  SecurityError: 'El origen no es seguro (se necesita HTTPS o localhost).',
  AbortError: 'Se interrumpió el acceso a la cámara.',
}

function describirErrorCamara(e: unknown): string {
  const nombre = e instanceof DOMException ? e.name : ''
  return ERRORES_CAMARA[nombre] ?? 'No se pudo acceder a la cámara.'
}

async function startZxingScanner(
  video: HTMLVideoElement,
  onDetected: (codigo: string) => void,
): Promise<ScannerControls> {
  const reader = new BrowserMultiFormatReader(hints, {
    delayBetweenScanAttempts: 60,
    delayBetweenScanSuccess: 500,
  })

  const onDecode: Parameters<typeof reader.decodeFromConstraints>[2] = (result) => {
    if (result) onDetected(result.getText())
  }

  return reader
    .decodeFromConstraints({ video: VIDEO_CONSTRAINTS_WITH_FOCUS }, video, onDecode)
    .catch(() => reader.decodeFromConstraints({ video: VIDEO_CONSTRAINTS_PLAIN }, video, onDecode))
}

export function Scanner() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<ScannerControls | null>(null)
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [manualCode, setManualCode] = useState('')
  const [torchSupported, setTorchSupported] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [scanned, setScanned] = useState(false)

  useEffect(() => {
    let cancelled = false
    // Se activa apenas se procesa la primera detección válida — sin esto,
    // el bucle de escaneo podía seguir disparando el mismo código (o
    // frames que ya estaban en vuelo) mientras el stop() del stream/lector
    // termina de surtir efecto de verdad.
    let locked = false
    let lastCodigo = ''
    let lastTime = 0

    function handleDetected(rawCodigo: string) {
      if (cancelled || locked) return
      const codigo = rawCodigo.trim()
      if (!codigo) return

      const now = Date.now()
      if (codigo === lastCodigo && now - lastTime < DUPLICATE_WINDOW_MS) return
      lastCodigo = codigo
      lastTime = now

      locked = true
      controlsRef.current?.stop()
      navigator.vibrate?.(60)
      setScanned(true)
      // Va a la pantalla de resultado (busca si ya existe) en vez de abrir
      // directo el formulario — ese solo debe abrirse si el usuario elige
      // "Ver detalles" o "Registrar" ahí.
      setTimeout(() => navigate(`/escaneo/${encodeURIComponent(codigo)}`), 220)
    }

    async function start() {
      const video = videoRef.current!
      const hasNativeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window

      if (hasNativeDetector) {
        try {
          const controls = await startNativeScanner(video, handleDetected)
          if (cancelled) {
            controls.stop()
            return
          }
          controlsRef.current = controls
          setTorchSupported(typeof controls.switchTorch === 'function')
          return
        } catch {
          // Cámara no disponible por esta vía, o el navegador anuncia
          // BarcodeDetector pero no lo implementa bien (pasa en algunos
          // Android viejos) — se sigue con ZXing abajo en vez de rendirse.
        }
      }

      try {
        const controls = await startZxingScanner(video, handleDetected)
        if (cancelled) {
          controls.stop()
          return
        }
        controlsRef.current = controls
        setTorchSupported(typeof controls.switchTorch === 'function')
      } catch (e) {
        if (!cancelled) {
          setError(
            describirErrorCamara(e) + ' Revisa los permisos del navegador (necesita HTTPS o localhost).',
          )
        }
      }
    }

    start()

    return () => {
      cancelled = true
      controlsRef.current?.stop()
    }
  }, [navigate])

  function toggleTorch() {
    const next = !torchOn
    controlsRef.current?.switchTorch?.(next).then(() => setTorchOn(next))
  }

  function goManual(e: React.FormEvent) {
    e.preventDefault()
    if (!manualCode.trim()) return
    controlsRef.current?.stop()
    navigate(`/escaneo/${encodeURIComponent(manualCode.trim())}`)
  }

  return (
    <div className="scanner-page">
      {error ? (
        <div className="card state-card error-card">
          <div className="state-icon error">!</div>
          <h3 style={{ color: 'var(--danger)' }}>Cámara bloqueada</h3>
          <p>{error}</p>
        </div>
      ) : (
        <>
          <h2>Escaneando…</h2>
          <p className="hint">Apunta la cámara al QR o código de barras</p>

          <div className="video-frame">
            <video ref={videoRef} muted playsInline autoPlay />
            <div className="scan-mask" />
            <div className="scan-frame">
              <span />
              <div className="scan-line" />
            </div>
            {scanned && (
              <div className="scan-success">
                <span className="scan-success-check">✓</span>
              </div>
            )}
            {torchSupported && (
              <button
                type="button"
                className={`torch-toggle${torchOn ? ' active' : ''}`}
                onClick={toggleTorch}
                aria-label="Linterna"
              >
                💡
              </button>
            )}
          </div>
        </>
      )}

      <div className="manual-label">¿NO LEE? ESCRÍBELO</div>
      <form className="manual-entry" onSubmit={goManual}>
        <input
          placeholder="Escribe el código a mano…"
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
        />
        <button type="submit">→</button>
      </form>
    </div>
  )
}
