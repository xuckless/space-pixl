import { useEffect, useState } from 'react'
import type { ConversionRow, StatsSummary } from '../../../shared/ipc'
import {
  formatBytes,
  formatMs,
  formatPercent,
  savingFraction,
  savingsEquivalent
} from '../../../shared/format'
import { TARGETS } from '../../../shared/plan'
import { DailyBars } from '../components/charts'
import { Info, Pill, Tile } from '../components/ui'
import { fileName } from '../lib/labels'

/** `4.68 MB` → `['4.68', 'MB']` so the unit can sit beside the number in its own weight. */
function splitUnit(s: string): [string, string] {
  const i = s.lastIndexOf(' ')
  return i < 0 ? [s, ''] : [s.slice(0, i), s.slice(i + 1)]
}

function Rows({
  rows,
  showDate
}: {
  rows: ConversionRow[]
  showDate?: boolean
}): React.JSX.Element {
  if (rows.length === 0) return <p className="note">Nothing yet.</p>
  return (
    <table className="table">
      <thead>
        <tr>
          {showDate && <th>When</th>}
          <th>File</th>
          <th>To</th>
          <th className="num">In</th>
          <th className="num">Out</th>
          <th className="num">Saved</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const saved = r.outputBytes === null ? null : r.inputBytes - r.outputBytes
          return (
            <tr key={r.id} className={r.status === 'error' ? 'failed' : ''}>
              {showDate && (
                <td className="muted-2 tiny">{new Date(r.startedAt).toLocaleString()}</td>
              )}
              <td title={r.sourcePath}>
                <div className="cell-stack">
                  <span className="mono">{fileName(r.sourcePath)}</span>
                  {r.outputPath && (
                    <button
                      type="button"
                      className="link"
                      onClick={() => void window.spacePixl.files.reveal(r.outputPath!)}
                    >
                      Show in folder
                    </button>
                  )}
                </div>
              </td>
              <td>
                <div className="cell-stack">
                  <span>
                    {TARGETS[r.target]?.extension.toUpperCase() ?? r.target}{' '}
                    <span className="muted-2 tiny">{r.description}</span>
                  </span>
                  <span className="row" style={{ gap: 6 }}>
                    {r.reversible ? (
                      <Pill tone="ok">reversible</Pill>
                    ) : r.lossless ? (
                      <Pill tone="ok">lossless</Pill>
                    ) : null}
                    {r.engine === 'mock' && <Pill tone="warn">placeholder</Pill>}
                    {r.status === 'error' && <Pill tone="err">failed</Pill>}
                  </span>
                </div>
              </td>
              <td className="num">{formatBytes(r.inputBytes)}</td>
              <td className="num">{r.outputBytes === null ? '—' : formatBytes(r.outputBytes)}</td>
              <td className="num">
                {r.status === 'error' ? (
                  <span className="err-text">failed</span>
                ) : saved !== null ? (
                  <span className={saved >= 0 ? 'ok-text' : 'err-text'}>
                    {formatPercent(savingFraction(r.inputBytes, r.outputBytes ?? 0), 0)}
                  </span>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export function Stats({ active }: { active: boolean }): React.JSX.Element {
  const [summary, setSummary] = useState<StatsSummary | null>(null)

  useEffect(() => {
    if (!active) return
    void window.spacePixl.stats.summary().then(setSummary)
  }, [active])

  const clear = async (): Promise<void> => {
    if (!window.confirm('Clear the whole conversion history? The files themselves are untouched.'))
      return
    setSummary(await window.spacePixl.stats.clear())
  }

  if (!summary)
    return (
      <div className="page">
        <p className="note">Loading…</p>
      </div>
    )
  const life = summary.lifetime
  const month = summary.month
  const avg = life.inputBytes > 0 ? savingFraction(life.inputBytes, life.outputBytes) : 0
  const [lifeValue, lifeUnit] = splitUnit(formatBytes(life.savedBytes))

  return (
    <div className="page scroll">
      <section className="card hero rise">
        <div className="card-head" style={{ alignItems: 'flex-end' }}>
          <div className="stack" style={{ gap: 4 }}>
            <span className="label">Lifetime storage reclaimed</span>
            <div className="hero-value">
              <span className="big">{lifeValue}</span>
              {lifeUnit && <span className="unit">{lifeUnit}</span>}
            </div>
            <span className="note" style={{ fontSize: 13.5 }}>
              {savingsEquivalent(life.savedBytes)} — it adds up quickly once you batch a folder.
            </span>
          </div>
          <Info title="How these are counted" label="How these numbers are counted">
            <p>
              Only finished conversions count towards space reclaimed; analysing a file on its own
              does not. &quot;Saved without loss&quot; is the part that came from lossless targets,
              so you could get every byte back.
            </p>
            <p>
              Engine time is the time the PIXL engine spent encoding, not the time you spent waiting
              on disk.
            </p>
          </Info>
        </div>
        <div className="tiles">
          <Tile
            className="rise d1"
            label="Files converted"
            value={life.converted.toLocaleString()}
            sub={life.failed > 0 ? `${life.failed} failed` : 'lifetime'}
          />
          <Tile
            className="rise d2"
            label="Average reduction"
            value={formatPercent(avg, 1)}
            sub={`${formatBytes(life.inputBytes)} → ${formatBytes(life.outputBytes)}`}
          />
          <Tile
            className="rise d3"
            label="This month"
            value={formatBytes(month.savedBytes)}
            sub={`${month.converted} file${month.converted === 1 ? '' : 's'}`}
          />
          <Tile
            className="rise d4"
            label="Images analysed"
            value={life.analysed.toLocaleString()}
            sub={`${month.analysed} this month`}
          />
          <Tile
            className="rise d5"
            label="Saved without loss"
            tone="ok"
            value={formatBytes(summary.losslessSavedBytes)}
            sub={`${formatBytes(summary.reversibleSavedBytes)} of it fully reversible`}
          />
          <Tile
            className="rise d6"
            label="Engine time"
            value={formatMs(life.engineMs)}
            sub={
              life.converted > 0
                ? `${formatMs(Math.round(life.engineMs / life.converted))} per file`
                : 'no conversions yet'
            }
          />
        </div>
        {summary.mockRows > 0 && (
          <p className="note warn">
            {summary.mockRows} of these rows came from the placeholder engine; their sizes are
            estimates.
          </p>
        )}
      </section>

      <section className="card rise d2" style={{ gap: 16 }}>
        <div className="card-head">
          <div className="lead" style={{ alignItems: 'baseline' }}>
            <h2 className="title">Last 30 days</h2>
            <span className="spec">storage reclaimed per day</span>
          </div>
          <div className="legend">
            <span>
              <i style={{ background: 'var(--accent)' }} />
              converted
            </span>
            <span>
              <i style={{ background: 'var(--track)' }} />
              no activity
            </span>
          </div>
        </div>
        <DailyBars points={summary.daily} />
      </section>

      <div className="two-up">
        <section className="card rise d3" style={{ gap: 12 }}>
          <h2 className="title">By format</h2>
          {summary.byTarget.length === 0 ? (
            <p className="note">Nothing yet.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Target</th>
                  <th className="num">Files</th>
                  <th className="num">Saved</th>
                  <th className="num">Reduction</th>
                </tr>
              </thead>
              <tbody>
                {summary.byTarget.map((t) => {
                  const f = savingFraction(t.inputBytes, t.outputBytes)
                  return (
                    <tr key={t.target}>
                      <td>{TARGETS[t.target]?.label ?? t.target}</td>
                      <td className="num">{t.files}</td>
                      <td className="num">{formatBytes(t.savedBytes)}</td>
                      <td className={`num ${f >= 0 ? 'ok-text' : 'err-text'}`}>
                        {formatPercent(f, 0)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </section>
        <section className="card rise d4" style={{ gap: 12 }}>
          <h2 className="title">Biggest saves</h2>
          <Rows rows={summary.biggest} />
        </section>
      </div>

      <section className="card rise d5" style={{ gap: 12 }}>
        <div className="card-head">
          <h2 className="title">Recent</h2>
          <button
            type="button"
            className="btn2"
            onClick={() => void clear()}
            disabled={life.converted + life.failed === 0}
          >
            Clear history
          </button>
        </div>
        <Rows rows={summary.recent} showDate />
      </section>
    </div>
  )
}
