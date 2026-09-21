import { useId } from 'react'
import type { HueBin } from '../../../shared/engine-types'
import { formatBytes } from '../../../shared/format'

/** A luma or channel histogram as a filled area, log-scaled so shadows and highlights both read. */
export function Histogram({
  counts,
  color = 'var(--accent)',
  height = 90,
  label = 'histogram'
}: {
  counts: number[]
  color?: string
  height?: number
  label?: string
}): React.JSX.Element {
  const id = useId()
  const n = counts.length
  const w = 520
  if (n === 0) return <svg className="histogram" viewBox={`0 0 ${w} ${height}`} />
  const max = Math.max(1, ...counts)
  const points = counts.map((c, i) => {
    const x = (i / (n - 1 || 1)) * w
    const y = height - (Math.log1p(c) / Math.log1p(max)) * (height - 6) - 1
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const d = `M0,${height} L${points.join(' L')} L${w},${height} Z`
  const line = `M${points.join(' L')}`
  return (
    <svg
      className="histogram"
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
      style={{ height }}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity={0.75} />
          <stop offset="1" stopColor={color} stopOpacity={0.15} />
        </linearGradient>
      </defs>
      <path d={d} fill={`url(#${id})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeOpacity={0.9}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

/** Twelve hue bins around the wheel, each bar coloured by its hue and sized by its share of pixels. */
export function HueBars({
  bins,
  neutral,
  measured
}: {
  bins: HueBin[]
  neutral: number
  measured: number
}): React.JSX.Element {
  const total = Math.max(1, bins.reduce((a, b) => a + b.count, 0) + neutral)
  const max = Math.max(1, ...bins.map((b) => b.count), neutral)
  return (
    <div className="hue-bars" role="img" aria-label="hue distribution">
      {bins.map((b) => {
        const mid = (b.hue_start + b.hue_end) / 2
        const h = (b.count / max) * 100
        return (
          <div
            key={b.hue_start}
            className="hue-bar"
            title={`${b.hue_start.toFixed(0)}–${b.hue_end.toFixed(0)}°: ${((b.count / total) * 100).toFixed(1)}%, saturation ${(b.mean_saturation * 100).toFixed(0)}%`}
          >
            <div
              className="hue-fill"
              style={{
                height: `${h}%`,
                background: `hsl(${mid} ${Math.round(40 + b.mean_saturation * 60)}% 55%)`
              }}
            />
          </div>
        )
      })}
      <div
        className="hue-bar"
        title={`neutral: ${((neutral / Math.max(1, measured)) * 100).toFixed(1)}%`}
      >
        <div
          className="hue-fill"
          style={{ height: `${(neutral / max) * 100}%`, background: 'var(--muted)' }}
        />
      </div>
    </div>
  )
}

function dayLabel(day: string): string {
  const d = new Date(`${day}T00:00:00`)
  if (Number.isNaN(d.getTime())) return day.slice(5)
  return d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' })
}

/** Daily savings, one bar per day, hover for the number. */
export function DailyBars({
  points
}: {
  points: { day: string; savedBytes: number; files: number }[]
}): React.JSX.Element {
  const max = Math.max(1, ...points.map((p) => Math.max(0, p.savedBytes)))
  const empty = points.every((p) => p.savedBytes === 0)
  const labelled = points.filter((_, i) => i % 7 === 0)
  return (
    <>
      <div className="bars" role="img" aria-label="savings per day, last 30 days">
        {points.map((p, i) => {
          const on = p.savedBytes > 0
          const pct = on ? Math.max(4, (Math.max(0, p.savedBytes) / max) * 100) : 0
          return (
            <div
              key={p.day}
              className={`bar ${on ? 'on' : ''}`}
              style={{
                height: on ? `${pct}%` : `${3 + ((i * 7) % 4)}px`,
                animationDelay: `${i * 18}ms`
              }}
              title={
                on
                  ? `${dayLabel(p.day)} · ${formatBytes(p.savedBytes)} across ${p.files} file${p.files === 1 ? '' : 's'}`
                  : `${dayLabel(p.day)} · no activity`
              }
            />
          )
        })}
      </div>
      <div className="axis">
        {labelled.map((p) => (
          <span key={p.day}>{dayLabel(p.day)}</span>
        ))}
      </div>
      {empty && <p className="note">No conversions in the last 30 days.</p>}
    </>
  )
}
