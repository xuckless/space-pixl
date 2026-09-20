import { useEffect, useState } from 'react'
import type { ConversionRow, StatsSummary } from '../../../shared/ipc'
import { formatBytes, formatMs, formatPercent, savingFraction, savingsEquivalent } from '../../../shared/format'
import { TARGETS } from '../../../shared/plan'
import { DailyBars } from '../components/charts'
import { Chip, Stat } from '../components/ui'

function fileName(p: string): string {
  return p.split(/[\\/]/).pop() ?? p
}

function Rows({ rows, showDate }: { rows: ConversionRow[]; showDate?: boolean }): React.JSX.Element {
  if (rows.length === 0) return <p className="muted small">Nothing yet.</p>
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
          <th></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const saved = r.outputBytes === null ? null : r.inputBytes - r.outputBytes
          return (
            <tr key={r.id} className={r.status === 'error' ? 'failed' : ''}>
              {showDate && <td className="muted">{new Date(r.startedAt).toLocaleString()}</td>}
              <td title={r.sourcePath}>
                <span className="mono">{fileName(r.sourcePath)}</span>
                {r.outputPath && (
                  <button className="link" onClick={() => void window.spacePixl.files.reveal(r.outputPath!)}>
                    reveal
                  </button>
                )}
              </td>
              <td>
                {TARGETS[r.target]?.extension.toUpperCase() ?? r.target} <span className="muted small">{r.description}</span>
              </td>
              <td className="num">{formatBytes(r.inputBytes)}</td>
              <td className="num">{r.outputBytes === null ? '—' : formatBytes(r.outputBytes)}</td>
              <td className="num">
                {r.status === 'error' ? (
                  <Chip tone="err" >failed</Chip>
                ) : saved !== null ? (
                  <span className={saved >= 0 ? 'ok-text' : 'err-text'}>
                    {formatPercent(savingFraction(r.inputBytes, r.outputBytes ?? 0), 0)}
                  </span>
                ) : (
                  '—'
                )}
              </td>
              <td className="row">
                {r.reversible ? <Chip tone="ok">reversible</Chip> : r.lossless ? <Chip tone="ok">lossless</Chip> : null}
                {r.engine === 'mock' && <Chip tone="warn">placeholder</Chip>}
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
    if (!window.confirm('Clear the whole conversion history? The files themselves are untouched.')) return
    setSummary(await window.spacePixl.stats.clear())
  }

  if (!summary) return <div className="muted">Loading…</div>
  const life = summary.lifetime
  const month = summary.month
  const avg = life.inputBytes > 0 ? savingFraction(life.inputBytes, life.outputBytes) : 0

  return (
    <div className="stats">
      <section className="card hero">
        <div className="hero-main">
          <div className="hero-label">Lifetime storage reclaimed</div>
          <div className="hero-value">{formatBytes(life.savedBytes)}</div>
          <div className="muted">{savingsEquivalent(life.savedBytes)}</div>
        </div>
        <div className="tiles">
          <Stat label="Files converted" value={life.converted.toLocaleString()} sub={life.failed > 0 ? `${life.failed} failed` : undefined} />
          <Stat label="Average reduction" value={formatPercent(avg, 1)} sub={`${formatBytes(life.inputBytes)} → ${formatBytes(life.outputBytes)}`} />
          <Stat label="This month" value={formatBytes(month.savedBytes)} sub={`${month.converted} file${month.converted === 1 ? '' : 's'}`} />
          <Stat label="Images analysed" value={life.analysed.toLocaleString()} sub={`${month.analysed} this month`} />
          <Stat label="Saved without loss" value={formatBytes(summary.losslessSavedBytes)} sub={`${formatBytes(summary.reversibleSavedBytes)} of it fully reversible`} />
          <Stat label="Engine time" value={formatMs(life.engineMs)} sub={life.converted > 0 ? `${formatMs(Math.round(life.engineMs / life.converted))} per file` : undefined} />
        </div>
        {summary.mockRows > 0 && (
          <p className="warn small">
            {summary.mockRows} of these rows came from the placeholder engine; their sizes are estimates.
          </p>
        )}
      </section>

      <section className="card">
        <h2>Last 30 days</h2>
        <DailyBars points={summary.daily} />
      </section>

      <div className="columns">
        <section className="card column">
          <h2>By format</h2>
          {summary.byTarget.length === 0 ? (
            <p className="muted small">Nothing yet.</p>
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
                {summary.byTarget.map((t) => (
                  <tr key={t.target}>
                    <td>{TARGETS[t.target]?.label ?? t.target}</td>
                    <td className="num">{t.files}</td>
                    <td className="num">{formatBytes(t.savedBytes)}</td>
                    <td className="num">{formatPercent(savingFraction(t.inputBytes, t.outputBytes), 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="card column">
          <h2>Biggest saves</h2>
          <Rows rows={summary.biggest} />
        </section>
      </div>

      <section className="card">
        <div className="row">
          <h2>Recent</h2>
          <span className="spacer" />
          <button onClick={() => void clear()} disabled={life.converted + life.failed === 0}>
            Clear history
          </button>
        </div>
        <Rows rows={summary.recent} showDate />
      </section>
    </div>
  )
}
