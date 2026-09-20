import type { Recommendation, Candidate } from '../../../shared/recommend'
import { TIER_LABEL } from '../../../shared/recommend'
import { describePlan, type Plan } from '../../../shared/plan'
import { formatBytes } from '../../../shared/format'
import { Chip } from './ui'

function expectedText(c: Candidate, bytes: number): string {
  const [lo, hi] = c.expected
  if (hi <= 0) return `grows ${Math.round(-hi * 100)}–${Math.round(-lo * 100)}%`
  if (lo < 0) return `−${Math.round(-lo * 100)}% to +${Math.round(hi * 100)}%`
  return `saves ${Math.round(lo * 100)}–${Math.round(hi * 100)}% · ${formatBytes(bytes * lo)}–${formatBytes(bytes * hi)}`
}

export function RecommendationPanel({
  recommendation,
  bytes,
  current,
  onChoose
}: {
  recommendation: Recommendation
  bytes: number
  current: Plan
  onChoose: (plan: Plan) => void
}): React.JSX.Element {
  const r = recommendation
  const tone = r.verdict === 'convert' ? 'ok' : r.verdict === 'marginal' ? 'warn' : ''
  const currentKey = JSON.stringify(current)
  return (
    <section className="card">
      <h2>Recommendation</h2>
      <div className="row">
        <Chip tone={tone}>{r.verdict === 'convert' ? 'Worth converting' : r.verdict === 'marginal' ? 'Marginal' : 'Leave it'}</Chip>
        <strong>{r.headline}</strong>
      </div>
      {r.reasons.length > 0 && (
        <ul className="reasons">
          {r.reasons.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      )}
      <div className="candidates">
        {r.candidates.map((c) => {
          const selected = JSON.stringify(c.plan) === currentKey
          return (
            <div key={c.id} className={`candidate ${c.recommended ? 'recommended' : ''} ${selected ? 'selected' : ''}`}>
              <div className="row">
                <strong>{c.title}</strong>
                <Chip tone={c.tier === 'reversible' || c.tier === 'lossless' ? 'ok' : ''}>{TIER_LABEL[c.tier]}</Chip>
                {c.recommended && <Chip tone="ok">Recommended</Chip>}
                <span className="spacer" />
                <button className={selected ? '' : 'primary'} disabled={selected} onClick={() => onChoose(c.plan)}>
                  {selected ? 'In use' : 'Use'}
                </button>
              </div>
              <div className="muted small">
                {expectedText(c, bytes)} · {describePlan(c.plan)}
              </div>
              <p className="small">{c.why}</p>
              {c.caveats.length > 0 && (
                <ul className="caveats small">
                  {c.caveats.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>
      <p className="muted small">Expected savings come from the engine&apos;s measured reference files; the preview on the right is the truth for this one.</p>
    </section>
  )
}
