import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import type { Material } from '../types'

const COLUMNS = [
  'Código',
  'Nombre',
  'Cantidad',
  'Unidad',
  'Ubicación',
  'Categoría',
  'Registrado por',
  'Fecha',
] as const

function toRows(materiales: Material[]) {
  return materiales.map((m) => [
    m.codigo,
    m.nombre,
    String(m.cantidad),
    m.unidad ?? '',
    m.ubicacion ?? '',
    m.categoria ?? '',
    m.registrado_por ?? '',
    new Date(m.created_at).toLocaleString(),
  ])
}

export function exportPDF(materiales: Material[]) {
  const doc = new jsPDF({ orientation: 'landscape' })
  doc.setFontSize(14)
  doc.text('INDI QR — Control de materiales', 14, 16)
  autoTable(doc, {
    head: [COLUMNS as unknown as string[]],
    body: toRows(materiales),
    startY: 22,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [31, 111, 235] },
  })
  doc.save(`materiales_${new Date().toISOString().slice(0, 10)}.pdf`)
}

export function exportExcel(materiales: Material[]) {
  const data = materiales.map((m) => ({
    Código: m.codigo,
    Nombre: m.nombre,
    Cantidad: m.cantidad,
    Unidad: m.unidad ?? '',
    Ubicación: m.ubicacion ?? '',
    Categoría: m.categoria ?? '',
    'Registrado por': m.registrado_por ?? '',
    Fecha: new Date(m.created_at).toLocaleString(),
  }))
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Materiales')
  XLSX.writeFile(wb, `materiales_${new Date().toISOString().slice(0, 10)}.xlsx`)
}
