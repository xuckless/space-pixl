import type { AppError, EngineStatus } from '../../../shared/ipc'
import type { Encode } from '../../../shared/engine-types'
import { encodeVariant } from '../../../shared/engine-types'

export type Tone = 'ok' | 'warn' | 'err' | ''

export function engineLabel(e: EngineStatus | undefined): { text: string; tone: Tone } {
  if (!e) return { text: '…', tone: '' }
  switch (e.status) {
    case 'starting':
      return { text: 'Starting', tone: '' }
    case 'ready':
      return e.flavour === 'mock'
        ? { text: 'Placeholder engine', tone: 'warn' }
        : { text: `Ready · v${e.version}`, tone: 'ok' }
    case 'unavailable':
      return { text: 'Unavailable', tone: 'warn' }
    case 'crashed':
      return { text: `Crashed (${e.restarts} restarts)`, tone: 'err' }
  }
}

export function errorText(e: AppError): string {
  return `${e.code}: ${e.message}`
}

/** `{ Jpeg: { quality: 85, ... } }` → `Jpeg · quality 85 · subsampling Quarter · optimize true`. */
export function describeEncode(e: Encode): string {
  const v = encodeVariant(e)
  if (typeof e === 'string') return v
  const fields = (e as Record<string, Record<string, unknown>>)[v]
  return [v, ...Object.entries(fields).map(([k, val]) => `${k.replace(/_/g, ' ')} ${String(val)}`)].join(' · ')
}
