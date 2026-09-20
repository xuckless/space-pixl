/** IPC channel names and the app-level types both sides of the bridge share. */
import type { ConvertReport, Encode, EngineFlavour, ImageStats, SourceInfo } from './engine-types'
import type { Plan, TargetFormat } from './plan'
import type { Recommendation } from './recommend'

export const IPC = {
  updates: {
    /** main → renderer: an UpdateEvent */
    event: 'updates:event',
    check: 'updates:check',
    install: 'updates:install',
    getState: 'updates:get-state',
    setChannel: 'updates:set-channel'
  },
  engine: {
    /** renderer → main (invoke): EngineStatus */
    status: 'engine:status',
    /** renderer → main (invoke): probe + analyze + suggest + recommend one file */
    inspect: 'engine:inspect',
    /** renderer → main (invoke): encode with a plan to a temp file and render the result */
    preview: 'engine:preview',
    /** renderer → main (invoke): encode with a plan beside the source and record it */
    convert: 'engine:convert'
  },
  files: {
    /** renderer → main (invoke): open-file dialog → path or cancelled */
    pick: 'files:pick',
    /** renderer → main (invoke): reveal a path in the OS file manager */
    reveal: 'files:reveal'
  },
  stats: {
    summary: 'stats:summary',
    clear: 'stats:clear'
  },
  app: {
    version: 'app:version',
    /** renderer → main (invoke): logical CPU count, for the threads dial */
    cpus: 'app:cpus'
  }
} as const

export type UpdateChannel = 'latest' | 'beta'

export type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'
  | 'disabled'

export interface UpdateProgress {
  percent: number
  transferred: number
  total: number
  bytesPerSecond: number
}

export interface UpdateState {
  phase: UpdatePhase
  channel: UpdateChannel
  currentVersion: string
  version?: string
  releaseDate?: string
  progress?: UpdateProgress
  error?: string
  lastCheckedAt?: string
}

export type UpdateEvent = UpdateState

export interface EngineStatus {
  status: 'starting' | 'ready' | 'unavailable' | 'crashed'
  /** Which implementation answered: the native addon or the development placeholder. */
  flavour?: EngineFlavour
  version?: string
  reason?: string
  restarts: number
}

export interface AppError {
  message: string
  code: string
  detail?: unknown
}

export type Failure = { ok: false; error: AppError; cancelled?: boolean }

/** A rendered image for the preview pane: PNG bytes plus what they show. */
export interface RenderedImage {
  bytes: Uint8Array
  mime: string
  width: number
  height: number
  /** True when the placeholder engine could not decode and substituted something. */
  substitute: boolean
}

/** Everything the app learns about one file in one call. */
export interface Inspection {
  path: string
  fileName: string
  info: SourceInfo
  stats: ImageStats | null
  statsError: AppError | null
  /** How the file was encoded, when the engine can say. */
  suggested: Encode | null
  suggestError: AppError | null
  recommendation: Recommendation
  /** The source rendered for the "before" pane. */
  before: RenderedImage | null
  beforeError: AppError | null
  engine: EngineFlavour
  ms: number
}

export type InspectResult = ({ ok: true } & Inspection) | Failure

export interface Preview {
  plan: Plan
  report: ConvertReport
  inputBytes: number
  outputBytes: number
  after: RenderedImage | null
  afterError: AppError | null
  engine: EngineFlavour
  ms: number
}

export type PreviewResult = ({ ok: true } & Preview) | Failure

export interface Conversion {
  id: number
  outputPath: string
  report: ConvertReport
  inputBytes: number
  outputBytes: number
  savedBytes: number
  ms: number
  engine: EngineFlavour
}

export type ConvertResult = ({ ok: true } & Conversion) | Failure

export type PickResult = { ok: true; path: string } | Failure

// ── Stats ────────────────────────────────────────────────────────────────────

export interface ConversionRow {
  id: number
  startedAt: string
  sourcePath: string
  outputPath: string | null
  inputFormat: string
  target: TargetFormat
  description: string
  inputBytes: number
  outputBytes: number | null
  durationMs: number | null
  lossless: boolean
  reversible: boolean
  status: 'ok' | 'error'
  error: string | null
  engine: EngineFlavour
}

export interface StatsWindow {
  converted: number
  failed: number
  inputBytes: number
  outputBytes: number
  savedBytes: number
  engineMs: number
  analysed: number
}

export interface DailyPoint {
  /** YYYY-MM-DD, local time */
  day: string
  savedBytes: number
  files: number
}

export interface TargetBreakdown {
  target: TargetFormat
  files: number
  inputBytes: number
  outputBytes: number
  savedBytes: number
}

export interface StatsSummary {
  lifetime: StatsWindow
  month: StatsWindow
  reversibleSavedBytes: number
  losslessSavedBytes: number
  daily: DailyPoint[]
  byTarget: TargetBreakdown[]
  biggest: ConversionRow[]
  recent: ConversionRow[]
  /** Only rows from the real engine count toward the headline numbers; mock rows are listed but flagged. */
  mockRows: number
}
