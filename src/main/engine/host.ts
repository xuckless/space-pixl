/**
 * The engine host. Runs inside an Electron utilityProcess so that a panic in
 * the native addon (rawler is known to panic on odd sensor layouts) kills this
 * process, not the app. The main-process side is `client.ts`.
 *
 * The addon is loaded lazily and by name. `SPACE_PIXL_ENGINE` decides what
 * happens when it cannot be: `native` (the default, and the only mode a
 * packaged app uses) reports unavailable; `auto` falls back to the
 * development placeholder in `mock.ts`; `mock` uses the placeholder outright.
 */
import { createRequire } from 'module'
import type {
  EngineErrorShape,
  EngineFlavour,
  EngineMethod,
  EngineMode,
  HostToMain,
  MainToHost,
  PixlEngineModule
} from '../../shared/engine-types'
import { createMockEngine } from './mock'

const ENGINE_PACKAGE = '@xuckless/pixl-engine'
const METHODS: EngineMethod[] = ['engineVersion', 'probe', 'convert', 'analyze', 'suggestEncode']

function send(msg: HostToMain): void {
  process.parentPort.postMessage(msg)
}

/**
 * Every message in an error's `cause` chain, outermost first.
 *
 * napi's generated loader tries each candidate binding in turn, collects what
 * each attempt threw and reports only `Cannot find native binding. npm has a
 * bug related to optional dependencies...` — advice about `npm i` that says
 * nothing about a packaged app. The real reason (a missing platform package,
 * an addon built for the other architecture, a dylib that would not load) is
 * in the chain underneath, so keep it.
 */
function causeChain(err: unknown, depth = 0): string[] {
  if (!(err instanceof Error) || depth > 6) return []
  const { cause } = err as Error & { cause?: unknown }
  const causes = Array.isArray(cause) ? cause : cause === undefined ? [] : [cause]
  return causes.flatMap((c) => {
    const message = c instanceof Error ? c.message : String(c)
    return [message, ...causeChain(c, depth + 1)]
  })
}

function loadNative(): { engine: PixlEngineModule } | { reason: string } {
  try {
    const require = createRequire(__filename)
    const mod = require(ENGINE_PACKAGE) as Partial<PixlEngineModule>
    const missing = METHODS.filter((m) => typeof mod[m] !== 'function')
    if (missing.length > 0) {
      return { reason: `${ENGINE_PACKAGE} loaded but lacks: ${missing.join(', ')}` }
    }
    return { engine: mod as PixlEngineModule }
  } catch (err) {
    const e = err as NodeJS.ErrnoException
    const where = `${process.platform}-${process.arch}`
    if (e.code === 'MODULE_NOT_FOUND') {
      return { reason: `${ENGINE_PACKAGE} is not installed for ${where}` }
    }
    const detail = causeChain(e)
    return {
      reason:
        `${ENGINE_PACKAGE} failed to load on ${where}: ${e.message}` +
        (detail.length > 0 ? ` (${detail.join('; ')})` : '')
    }
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

const mode = (process.env['SPACE_PIXL_ENGINE'] as EngineMode | undefined) ?? 'native'

let engine: PixlEngineModule | undefined
let flavour: EngineFlavour = 'native'
let unavailableReason: string | undefined

if (mode === 'mock') {
  engine = createMockEngine()
  flavour = 'mock'
  unavailableReason = 'placeholder engine requested'
} else {
  const loaded = loadNative()
  if ('engine' in loaded) {
    engine = loaded.engine
  } else if (mode === 'auto') {
    engine = createMockEngine()
    flavour = 'mock'
    unavailableReason = loaded.reason
  } else {
    unavailableReason = loaded.reason
  }
}

if (engine) {
  send({
    kind: 'hello',
    status: 'ready',
    flavour,
    version: engine.engineVersion(),
    reason: flavour === 'mock' ? unavailableReason : undefined
  })
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
    .then(() => fn.apply(engine, args))
    .then(
      (result) => send({ kind: 'response', id, ok: true, result }),
      (err) => send({ kind: 'response', id, ok: false, error: toErrorShape(err) })
    )
})
