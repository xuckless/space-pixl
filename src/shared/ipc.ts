/** IPC channel names shared by main, preload and renderer. */
export const IPC = {
  updates: {
    /** main → renderer: an UpdateEvent */
    event: 'updates:event',
    /** renderer → main (invoke): trigger a check now */
    check: 'updates:check',
    /** renderer → main (invoke): quit and install a downloaded update */
    install: 'updates:install',
    /** renderer → main (invoke): current UpdateState */
    getState: 'updates:get-state',
    /** renderer → main (invoke): set the channel ('latest' | 'beta') */
    setChannel: 'updates:set-channel'
  },
  engine: {
    /** renderer → main (invoke): EngineStatus */
    status: 'engine:status',
    /** renderer → main (invoke): probe(path) → SourceInfo */
    probe: 'engine:probe',
    /** renderer → main (invoke): open a file dialog and probe the chosen file */
    pickAndProbe: 'engine:pick-and-probe'
  },
  app: {
    /** renderer → main (invoke): app version string */
    version: 'app:version'
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
  /** version of the update found, once known */
  version?: string
  releaseDate?: string
  progress?: UpdateProgress
  error?: string
  lastCheckedAt?: string
}

/** Every change of UpdateState is sent to the renderer as the whole state. */
export type UpdateEvent = UpdateState

export interface EngineStatus {
  status: 'starting' | 'ready' | 'unavailable' | 'crashed'
  /** engine version when ready */
  version?: string
  /** why the engine is unavailable or crashed */
  reason?: string
  restarts: number
}
