const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })

const UNIDADES: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 60 * 60 * 24 * 365],
  ['month', 60 * 60 * 24 * 30],
  ['day', 60 * 60 * 24],
  ['hour', 60 * 60],
  ['minute', 60],
]

// "hace 2 minutos", "hace 3 días"… usando el Intl.RelativeTimeFormat que ya
// trae el navegador, sin sumar una librería de fechas solo para esto.
export function formatearTiempoRelativo(iso: string): string {
  const diffSegundos = (new Date(iso).getTime() - Date.now()) / 1000

  for (const [unidad, segundosPorUnidad] of UNIDADES) {
    if (Math.abs(diffSegundos) >= segundosPorUnidad) {
      return rtf.format(Math.round(diffSegundos / segundosPorUnidad), unidad)
    }
  }
  return rtf.format(Math.round(diffSegundos), 'second')
}

// "27/07/2026 a las 14:32" — para la confirmación visual justo después de
// registrar un movimiento, donde conviene la fecha/hora exacta y no una
// relativa que va a cambiar en cuanto pase un minuto.
export function formatearFechaHora(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} a las ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
