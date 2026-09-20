/** Number formatting shared by the renderer and the main process. */

export function formatBytes(n: number): string {
  if (!Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  if (abs < 1024) return `${n} B`
  if (abs < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  if (abs < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

/** `0.19` → `19%`; negative values mean the file grew. */
export function formatPercent(fraction: number, digits = 0): string {
  if (!Number.isFinite(fraction)) return '—'
  return `${(fraction * 100).toFixed(digits)}%`
}

export function formatMs(ms: number): string {
  if (ms < 1000) return `${ms} ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`
  const m = Math.floor(ms / 60_000)
  const s = Math.round((ms % 60_000) / 1000)
  if (m < 60) return `${m} min ${s} s`
  const h = Math.floor(m / 60)
  return `${h} h ${m % 60} min`
}

/** Fraction of the input that was saved: `1 - out/in`. */
export function savingFraction(inputBytes: number, outputBytes: number): number {
  if (inputBytes <= 0) return 0
  return 1 - outputBytes / inputBytes
}

/** A plain-language equivalent for a number of bytes saved. */
export function savingsEquivalent(bytes: number): string {
  const MB = 1024 * 1024
  const GB = 1024 * MB
  if (bytes < 3 * MB) return 'less than one phone photo'
  if (bytes < GB) return `about ${Math.round(bytes / (3 * MB)).toLocaleString()} phone photos at 3 MB each`
  if (bytes < 64 * GB)
    return `about ${Math.round(bytes / (3 * MB)).toLocaleString()} phone photos, or ${(bytes / (256 * GB) * 100).toFixed(1)}% of a 256 GB phone`
  return `${(bytes / (256 * GB)).toFixed(2)} × a 256 GB phone`
}

export function formatDimensions(w: number, h: number): string {
  if (!w || !h) return '—'
  return `${w} × ${h} (${((w * h) / 1e6).toFixed(1)} MP)`
}
