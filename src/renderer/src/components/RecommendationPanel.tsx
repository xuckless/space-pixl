import type { Recommendation, Candidate } from '../../../shared/recommend'
import { TIER_LABEL } from '../../../shared/recommend'
import { describePlan, type Plan } from '../../../shared/plan'
import { formatBytes } from '../../../shared/format'
import { Info, Pill } from './ui'

function expectedText(c: Candidate): string {
  const [lo, hi] = c.expected
  if (hi <= 0) return `grows ${Math.round(-hi * 100)}–${Math.round(-lo * 100)}%`
  if (lo < 0) return `−${Math.round(-lo * 100)}% to +${Math.round(hi * 100)}%`
  return `saves ${Math.round(lo * 100)}–${Math.round(hi * 100)}%`
}

function outputRange(c: Candidate, bytes: number): string {
  const [lo, hi] = c.expected
  const small = bytes * (1 - hi)
  const large = bytes * (1 - lo)
  return `${formatBytes(Math.max(0, small))}–${formatBytes(Math.max(0, large))}`
}

const RISE = ['d2', 'd3', 'd4', 'd5', 'd6', 'd6', 'd6', 'd6']

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
    <>
      <section className="card rise d1">
        <div className="card-head">
          <div className="lead">
            <h2 className="title">Recommendation</h2>
            <Pill tone={tone}>
              {r.verdict === 'convert'
                ? 'Worth converting'
                : r.verdict === 'marginal'
                  ? 'Marginal'
                  : 'Leave it'}
            </Pill>
          </div>
          <Info title="How this was decided" label="How this recommendation was decided">
            <p>
              Expected savings come from the engine&apos;s measured reference files; the preview on
              the right is the truth for this one.
            </p>
          </Info>
        </div>
        <p className="lede">{r.headline}</p>
        {r.reasons.length > 0 && (
          <ul className="note" style={{ margin: 0, paddingLeft: 18 }}>
            {r.reasons.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        )}
      </section>

      {r.candidates.map((c, i) => {
        const selected = JSON.stringify(c.plan) === currentKey
        const [lo, hi] = c.expected
        const losslessTier = c.tier === 'reversible' || c.tier === 'lossless'
        const grows = hi <= 0
        const width = grows
          ? Math.min(100, Math.round(-lo * 100))
          : Math.min(100, Math.max(0, Math.round(hi * 100)))
        return (
          <section
            key={c.id}
            className={`card option rise ${RISE[i] ?? 'd6'} ${selected ? 'on' : ''}`}
            aria-current={selected ? 'true' : undefined}
          >
            <div className="card-head">
              <div className="lead" style={{ gap: 10 }}>
                <span className="disp" style={{ fontSize: 16, fontWeight: 700 }}>
                  {c.title}
                </span>
                <Pill tone={losslessTier ? 'ok' : ''}>{TIER_LABEL[c.tier]}</Pill>
                {c.recommended && <Pill tone="ac">Recommended</Pill>}
              </div>
              <div className="tools">
                <Info title={c.title} label={`More about ${c.title}`}>
                  <p>{c.why}</p>
                  {c.caveats.length > 0 && (
                    <ul>
                      {c.caveats.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  )}
                </Info>
                <button
                  type="button"
                  className="use"
                  disabled={selected}
                  onClick={() => onChoose(c.plan)}
                >
                  {selected ? 'In use' : 'Use'}
                </button>
              </div>
            </div>
            <div className="meter-row">
              <div className="meter-track">
                <div
                  className={`meter ${grows ? 'err' : losslessTier ? 'ok' : ''}`}
                  style={{ width: `${width}%` }}
                />
              </div>
              <span className="meter-text">{expectedText(c)}</span>
            </div>
            <div className="spec">
              {outputRange(c, bytes)} · {describePlan(c.plan)}
            </div>
            {c.caveats.length > 0 && (
              <ul className="note" style={{ margin: 0, paddingLeft: 18 }}>
                {c.caveats.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </>
  )
}
