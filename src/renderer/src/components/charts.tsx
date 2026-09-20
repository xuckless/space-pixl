import type { HueBin } from '../../../shared/engine-types'
import { formatBytes } from '../../../shared/format'

/** A luma or channel histogram as a filled area, log-scaled so shadows and highlights both read. */
export function Histogram({ counts, color = 'var(--accent)', height = 72 }: { counts: number[]; color?: string; height?: number }): React.JSX.Element {
  const n = counts.length
  if (n === 0) return <svg className="histogram" viewBox="0 0 256 72" />
  const max = Math.max(1, ...counts)
  const w = 256
  const points = counts.map((c, i) => {
    const x = (i / (n - 1 || 1)) * w
    const y = height - (Math.log1p(c) / Math.log1p(max)) * (height - 4) - 1
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const d = `M0,${height} L${points.join(' L')} L${w},${height} Z`
  return (
    <svg className="histogram" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" role="img" aria-label="histogram">
      <path d={d} fill={color} fillOpacity={0.35} stroke={color} strokeWidth={1} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/** Twelve hue bins around the wheel, each bar coloured by its hue and sized by its share of pixels. */
export function HueBars({ bins, neutral, measured }: { bins: HueBin[]; neutral: number; measured: number }): React.JSX.Element {
  const total = Math.max(1, bins.reduce((a, b) => a + b.count, 0) + neutral)
  const max = Math.max(1, ...bins.map((b) => b.count), neutral)
  return (
    <div className="hue-bars" role="img" aria-label="hue distribution">
      {bins.map((b) => {
        const mid = (b.hue_start + b.hue_end) / 2
        const h = (b.count / max) * 100
        return (
          <div key={b.hue_start} className="hue-bar" title={`${b.hue_start.toFixed(0)}–${b.hue_end.toFixed(0)}°: ${((b.count / total) * 100).toFixed(1)}%, saturation ${(b.mean_saturation * 100).toFixed(0)}%`}>
            <div className="hue-fill" style={{ height: `${h}%`, background: `hsl(${mid} ${Math.round(40 + b.mean_saturation * 60)}% 55%)` }} />
          </div>
        )
      })}
      <div className="hue-bar" title={`neutral: ${((neutral / Math.max(1, measured)) * 100).toFixed(1)}%`}>
        <div className="hue-fill" style={{ height: `${(neutral / max) * 100}%`, background: 'var(--muted)' }} />
      </div>
    </div>
  )
}

/** Daily savings, one bar per day, hover for the number. */
export function DailyBars({ points }: { points: { day: string; savedBytes: number; files: number }[] }): React.JSX.Element {
  const max = Math.max(1, ...points.map((p) => Math.max(0, p.savedBytes)))
  const w = 600
  const h = 140
  const gap = 2
  const bw = (w - gap * (points.length - 1)) / Math.max(1, points.length)
  const empty = points.every((p) => p.savedBytes === 0)
  return (
    <div className="daily">
      <svg viewBox={`0 0 ${w} ${h + 18}`} role="img" aria-label="savings per day, last 30 days">
        {points.map((p, i) => {
          const bh = Math.max(p.savedBytes > 0 ? 2 : 0, (Math.max(0, p.savedBytes) / max) * h)
          const x = i * (bw + gap)
          return (
            <g key={p.day}>
              <rect x={x} y={h - bh} width={bw} height={bh} rx={2} fill="var(--accent)" fillOpacity={p.savedBytes > 0 ? 0.85 : 0.15}>
                <title>{`${p.day}: ${formatBytes(p.savedBytes)} across ${p.files} file${p.files === 1 ? '' : 's'}`}</title>
              </rect>
              {(i === 0 || i === points.length - 1 || i % 7 === 0) && (
                <text x={x + bw / 2} y={h + 14} textAnchor="middle" className="axis">
                  {p.day.slice(5)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      {empty && <div className="muted daily-empty">No conversions in the last 30 days.</div>}
    </div>
  )
}
