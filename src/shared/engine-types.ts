/**
 * Loose types for the PIXL engine's serde-shaped values.
 *
 * TODO: replace with the real declarations exported by `@xuckless/pixl-engine`
 * once the binding package publishes them. Until then these are intentionally
 * permissive so the app compiles against the JSON the engine produces.
 */

/** `probe()` result. */
export type SourceInfo = Record<string, unknown>

/** `convert()` request and report. */
export type ConvertRequest = Record<string, unknown>
export type ConvertReport = Record<string, unknown>

/** `analyze()` request and result. */
export type AnalyzeRequest = Record<string, unknown>
export type ImageStats = Record<string, unknown>

/** An `Encode` variant, as returned by `suggestEncode()`. */
export type Encode = Record<string, unknown>

/** The serialised `PixlError` enum: `{ <Variant>: { ...fields } }`. */
export type PixlErrorDetail = Record<string, Record<string, unknown>>

/** What an engine error looks like once it crosses into JS. */
export interface EngineErrorShape {
  message: string
  /** PixlError variant name, e.g. "InvalidRequest", "Unsupported". */
  code: string
  detail?: PixlErrorDetail
}

/** The contract the Node binding fulfils. Everything async except the version. */
export interface PixlEngineModule {
  engineVersion(): string
  probe(path: string): Promise<SourceInfo>
  convert(request: ConvertRequest): Promise<ConvertReport>
  analyze(request: AnalyzeRequest): Promise<ImageStats>
  suggestEncode(info: SourceInfo, threads: number): Promise<Encode>
}

/** Messages between the main process and the engine utility process. */
export type EngineMethod = keyof PixlEngineModule

export interface EngineRequestMessage {
  kind: 'request'
  id: number
  method: EngineMethod
  args: unknown[]
}

export interface EngineHelloMessage {
  kind: 'hello'
  status: 'ready' | 'unavailable'
  version?: string
  reason?: string
}

export interface EngineResponseMessage {
  kind: 'response'
  id: number
  ok: boolean
  result?: unknown
  error?: EngineErrorShape
}

export type HostToMain = EngineHelloMessage | EngineResponseMessage
export type MainToHost = EngineRequestMessage
