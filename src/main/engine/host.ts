/**
 * The engine host. Runs inside an Electron utilityProcess so that a panic in
 * the native addon (rawler is known to panic on odd sensor layouts) kills this
 * process, not the app. The main-process side is `client.ts`.
 *
 * The addon is loaded lazily and by name. When the package is not installed —
 * which is the case until `@xuckless/pixl-engine` is published — the host
 * still answers, reporting itself unavailable, so the app runs without it.
 */
import { createRequire } from 'module'
import type {
  EngineErrorShape,
  EngineMethod,
  HostToMain,
  MainToHost,
  PixlEngineModule
} from '../../shared/engine-types'

const ENGINE_PACKAGE = '@xuckless/pixl-engine'

function send(msg: HostToMain): void {
  process.parentPort.postMessage(msg)
}

function loadEngine(): { engine: PixlEngineModule } | { reason: string } {
  try {
    const require = createRequire(__filename)
    const mod = require(ENGINE_PACKAGE) as Partial<PixlEngineModule>
    const missing = (
      ['engineVersion', 'probe', 'convert', 'analyze', 'suggestEncode'] as EngineMethod[]
    ).filter((m) => typeof mod[m] !== 'function')
    if (missing.length > 0) {
      return { reason: `${ENGINE_PACKAGE} loaded but lacks: ${missing.join(', ')}` }
    }
    return { engine: mod as PixlEngineModule }
  } catch (err) {
    const e = err as NodeJS.ErrnoException
    if (e.code === 'MODULE_NOT_FOUND') {
      return { reason: `${ENGINE_PACKAGE} is not installed` }
    }
    return { reason: `${ENGINE_PACKAGE} failed to load: ${e.message}` }
  }
}

function toErrorShape(err: unknown): EngineErrorShape {
  if (err && typeof err === 'object') {
    const e = err as { message?: unknown; code?: unknown; detail?: unknown }
    return {
      message: typeof e.message === 'string' ? e.message : String(err),
      code: typeof e.code === 'string' ? e.code : 'Unknown',
      detail:
        e.detail && typeof e.detail === 'object'
          ? (e.detail as EngineErrorShape['detail'])
          : undefined
    }
  }
  return { message: String(err), code: 'Unknown' }
}

const loaded = loadEngine()
const engine: PixlEngineModule | undefined = 'engine' in loaded ? loaded.engine : undefined
const unavailableReason = 'reason' in loaded ? loaded.reason : undefined

if (engine) {
  send({ kind: 'hello', status: 'ready', version: engine.engineVersion() })
} else {
  send({ kind: 'hello', status: 'unavailable', reason: unavailableReason })
}

process.parentPort.on('message', (e) => {
  const msg = e.data as MainToHost
  if (!msg || msg.kind !== 'request') return
  const { id, method, args } = msg
  if (!engine) {
    send({
      kind: 'response',
      id,
      ok: false,
      error: { message: unavailableReason ?? 'engine unavailable', code: 'EngineUnavailable' }
    })
    return
  }
  const fn = engine[method] as ((...a: unknown[]) => unknown) | undefined
  if (typeof fn !== 'function') {
    send({
      kind: 'response',
      id,
      ok: false,
      error: { message: `unknown engine method ${String(method)}`, code: 'BadRequest' }
    })
    return
  }
  Promise.resolve()
    .then(() => fn(...args))
    .then(
      (result) => send({ kind: 'response', id, ok: true, result }),
      (err) => send({ kind: 'response', id, ok: false, error: toErrorShape(err) })
    )
})
