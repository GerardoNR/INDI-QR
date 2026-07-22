import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarcodeFormat, BrowserMultiFormatReader } from '@zxing/browser'
import type { IScannerControls } from '@zxing/browser'
import { DecodeHintType } from '@zxing/library'

// Limitar los formatos a los que realmente usamos evita que el lector pierda
// tiempo por frame probando formatos raros (PDF417, Aztec, MaxiCode…),
// que es la causa principal de que el escaneo se sienta lento.
const hints = new Map<DecodeHintType, unknown>([
  [
    DecodeHintType.POSSIBLE_FORMATS,
    [
      BarcodeFormat.QR_CODE,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.CODABAR,
      BarcodeFormat.ITF,
    ],
  ],
])

export function Scanner() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [manualCode, setManualCode] = useState('')
  const [torchSupported, setTorchSupported] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [scanned, setScanned] = useState(false)

  useEffect(() => {
    const reader = new BrowserMultiFormatReader(hints, {
      delayBetweenScanAttempts: 60,
      delayBetweenScanSuccess: 500,
    })
    let cancelled = false

    reader
      .decodeFromConstraints(
        {
          video: {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            // focusMode no está tipado en lib.dom.d.ts, pero sí lo soportan
            // Chrome/Android; sin enfoque continuo los códigos de barras
            // pequeños salen borrosos y tardan varios intentos en leerse.
            advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet],
          },
        },
        videoRef.current!,
        (result, err) => {
          if (cancelled) return
          if (result) {
            const codigo = result.getText().trim()
            controlsRef.current?.stop()
            navigator.vibrate?.(60)
            setScanned(true)
            setTimeout(() => navigate(`/material/${encodeURIComponent(codigo)}`), 220)
          } else if (err && err.name !== 'NotFoundException') {
            // ruido normal de frames sin código detectado: se ignora
          }
        },
      )
      .then((controls) => {
        if (cancelled) {
          controls.stop()
          return
        }
        controlsRef.current = controls
        setTorchSupported(typeof controls.switchTorch === 'function')
      })
      .catch((e: Error) => {
        setError(
          'No se pudo acceder a la cámara: ' +
            e.message +
            '. Revisa los permisos del navegador (necesita HTTPS o localhost).',
        )
      })

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
    navigate(`/material/${encodeURIComponent(manualCode.trim())}`)
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
