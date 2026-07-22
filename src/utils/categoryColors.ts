const PALETTE = [
  { bg: '#fde9c8', fg: '#92400e' },
  { bg: '#d6e4ff', fg: '#1e40af' },
  { bg: '#ece3ff', fg: '#6d28d9' },
  { bg: '#cdeff2', fg: '#0e7490' },
  { bg: '#d5f2e0', fg: '#15803d' },
  { bg: '#ffe0dd', fg: '#b91c1c' },
]

const NEUTRAL = { bg: '#eef0f1', fg: '#5c6566' }

export function categoryColor(categoria: string | null | undefined): { bg: string; fg: string } {
  const key = categoria?.trim().toLowerCase()
  if (!key) return NEUTRAL

  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0
  }
  return PALETTE[Math.abs(hash) % PALETTE.length]
}
