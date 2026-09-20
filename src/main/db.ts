/**
 * The app's store: one SQLite file in userData, through Node's built-in
 * `node:sqlite`. No native module to rebuild, nothing for the packaging
 * pipeline to learn. A server-side store may come later; this is the
 * simplest thing that keeps a history and answers the stats page.
 *
 * Takes a path, not the Electron app, so it can be tested under plain Node.
 */
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'fs'
import { dirname } from 'path'
import type { EngineFlavour } from '../shared/engine-types'
import type {
  ConversionRow,
  DailyPoint,
  StatsSummary,
  StatsWindow,
  TargetBreakdown
} from '../shared/ipc'
import type { TargetFormat } from '../shared/plan'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS conversions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at   TEXT    NOT NULL,
  source_path  TEXT    NOT NULL,
  output_path  TEXT,
  input_format TEXT    NOT NULL,
  target       TEXT    NOT NULL,
  description  TEXT    NOT NULL,
  input_bytes  INTEGER NOT NULL,
  output_bytes INTEGER,
  duration_ms  INTEGER,
  lossless     INTEGER NOT NULL DEFAULT 0,
  reversible   INTEGER NOT NULL DEFAULT 0,
  status       TEXT    NOT NULL,
  error        TEXT,
  engine       TEXT    NOT NULL DEFAULT 'native'
);
CREATE INDEX IF NOT EXISTS conversions_started_at ON conversions (started_at);

CREATE TABLE IF NOT EXISTS inspections (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  at         TEXT    NOT NULL,
  path       TEXT    NOT NULL,
  format     TEXT    NOT NULL,
  bytes      INTEGER NOT NULL,
  engine     TEXT    NOT NULL DEFAULT 'native'
);
CREATE INDEX IF NOT EXISTS inspections_at ON inspections (at);
`

export interface StartConversion {
  sourcePath: string
  inputFormat: string
  target: TargetFormat
  description: string
  inputBytes: number
  lossless: boolean
  reversible: boolean
  engine: EngineFlavour
}

export interface FinishConversion {
  outputPath: string | null
  outputBytes: number | null
  durationMs: number
  status: 'ok' | 'error'
  error: string | null
}

interface RawRow {
  id: number
  started_at: string
  source_path: string
  output_path: string | null
  input_format: string
  target: string
  description: string
  input_bytes: number
  output_bytes: number | null
  duration_ms: number | null
  lossless: number
  reversible: number
  status: string
  error: string | null
  engine: string
}

function toRow(r: RawRow): ConversionRow {
  return {
    id: r.id,
    startedAt: r.started_at,
    sourcePath: r.source_path,
    outputPath: r.output_path,
    inputFormat: r.input_format,
    target: r.target as TargetFormat,
    description: r.description,
    inputBytes: r.input_bytes,
    outputBytes: r.output_bytes,
    durationMs: r.duration_ms,
    lossless: r.lossless === 1,
    reversible: r.reversible === 1,
    status: r.status === 'ok' ? 'ok' : 'error',
    error: r.error,
    engine: r.engine === 'mock' ? 'mock' : 'native'
  }
}

/** Local-time YYYY-MM-DD. */
export function localDay(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function emptyWindow(): StatsWindow {
  return {
    converted: 0,
    failed: 0,
    inputBytes: 0,
    outputBytes: 0,
    savedBytes: 0,
    engineMs: 0,
    analysed: 0
  }
}

function accumulate(w: StatsWindow, r: ConversionRow): void {
  if (r.status === 'ok' && r.outputBytes !== null) {
    w.converted++
    w.inputBytes += r.inputBytes
    w.outputBytes += r.outputBytes
    w.savedBytes += r.inputBytes - r.outputBytes
    w.engineMs += r.durationMs ?? 0
  } else {
    w.failed++
  }
}

export class Store {
  private readonly db: DatabaseSync

  private constructor(db: DatabaseSync) {
    this.db = db
  }

  static open(path: string): Store {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
    const db = new DatabaseSync(path)
    db.exec('PRAGMA journal_mode = WAL')
    db.exec(SCHEMA)
    return new Store(db)
  }

  close(): void {
    this.db.close()
  }

  recordInspection(
    path: string,
    format: string,
    bytes: number,
    engine: EngineFlavour,
    at = new Date()
  ): void {
    this.db
      .prepare('INSERT INTO inspections (at, path, format, bytes, engine) VALUES (?, ?, ?, ?, ?)')
      .run(at.toISOString(), path, format, bytes, engine)
  }

  startConversion(c: StartConversion, at = new Date()): number {
    const result = this.db
      .prepare(
        `INSERT INTO conversions (started_at, source_path, input_format, target, description, input_bytes, lossless, reversible, status, engine)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'running', ?)`
      )
      .run(
        at.toISOString(),
        c.sourcePath,
        c.inputFormat,
        c.target,
        c.description,
        c.inputBytes,
        c.lossless ? 1 : 0,
        c.reversible ? 1 : 0,
        c.engine
      )
    return Number(result.lastInsertRowid)
  }

  finishConversion(id: number, f: FinishConversion): void {
    this.db
      .prepare(
        'UPDATE conversions SET output_path = ?, output_bytes = ?, duration_ms = ?, status = ?, error = ? WHERE id = ?'
      )
      .run(f.outputPath, f.outputBytes, f.durationMs, f.status, f.error, id)
  }

  /** Anything left 'running' by a crash is an error, not a pending job. */
  reconcile(): void {
    this.db
      .prepare(
        "UPDATE conversions SET status = 'error', error = 'interrupted' WHERE status = 'running'"
      )
      .run()
  }

  get(id: number): ConversionRow | null {
    const r = this.db.prepare('SELECT * FROM conversions WHERE id = ?').get(id) as
      RawRow | undefined
    return r ? toRow(r) : null
  }

  recent(limit = 20): ConversionRow[] {
    return (
      this.db
        .prepare(
          "SELECT * FROM conversions WHERE status != 'running' ORDER BY started_at DESC, id DESC LIMIT ?"
        )
        .all(limit) as unknown as RawRow[]
    ).map(toRow)
  }

  summary(now = new Date(), days = 30): StatsSummary {
    const all = (
      this.db
        .prepare("SELECT * FROM conversions WHERE status != 'running' ORDER BY started_at ASC")
        .all() as unknown as RawRow[]
    ).map(toRow)
    const lifetime = emptyWindow()
    const month = emptyWindow()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1))
    const daily = new Map<string, DailyPoint>()
    for (let i = 0; i < days; i++) {
      const d = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate() + i)
      const key = localDay(d)
      daily.set(key, { day: key, savedBytes: 0, files: 0 })
    }
    const byTarget = new Map<TargetFormat, TargetBreakdown>()
    let reversibleSavedBytes = 0
    let losslessSavedBytes = 0
    let mockRows = 0

    for (const r of all) {
      accumulate(lifetime, r)
      const at = new Date(r.startedAt)
      if (at >= monthStart) accumulate(month, r)
      if (r.engine === 'mock') mockRows++
      if (r.status !== 'ok' || r.outputBytes === null) continue
      const saved = r.inputBytes - r.outputBytes
      if (r.reversible) reversibleSavedBytes += saved
      if (r.lossless) losslessSavedBytes += saved
      const key = localDay(at)
      const point = daily.get(key)
      if (point) {
        point.savedBytes += saved
        point.files++
      }
      const t = byTarget.get(r.target) ?? {
        target: r.target,
        files: 0,
        inputBytes: 0,
        outputBytes: 0,
        savedBytes: 0
      }
      t.files++
      t.inputBytes += r.inputBytes
      t.outputBytes += r.outputBytes
      t.savedBytes += saved
      byTarget.set(r.target, t)
    }

    const inspections = this.db.prepare('SELECT COUNT(*) AS n FROM inspections').get() as {
      n: number
    }
    const monthInspections = this.db
      .prepare('SELECT COUNT(*) AS n FROM inspections WHERE at >= ?')
      .get(monthStart.toISOString()) as { n: number }
    lifetime.analysed = Number(inspections.n)
    month.analysed = Number(monthInspections.n)

    const ok = all.filter((r) => r.status === 'ok' && r.outputBytes !== null)
    const biggest = [...ok]
      .sort((a, b) => b.inputBytes - (b.outputBytes ?? 0) - (a.inputBytes - (a.outputBytes ?? 0)))
      .slice(0, 5)

    return {
      lifetime,
      month,
      reversibleSavedBytes,
      losslessSavedBytes,
      daily: [...daily.values()],
      byTarget: [...byTarget.values()].sort((a, b) => b.savedBytes - a.savedBytes),
      biggest,
      recent: [...all].reverse().slice(0, 20),
      mockRows
    }
  }

  clear(): void {
    this.db.exec('DELETE FROM conversions; DELETE FROM inspections;')
  }
}
