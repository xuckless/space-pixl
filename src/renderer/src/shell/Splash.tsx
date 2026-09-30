import { useEffect, useState } from 'react'
import type { EngineStatus } from '../../../shared/ipc'
import { Ambient } from '../components/brand/Ambient'
import { Mark } from '../components/brand/Mark'
import { Wordmark } from '../components/brand/Wordmark'

/** However quick the launch, the splash stays this long, so it never just flickers. */
const MIN_SHOWN_MS = 1500
/** The fade out, matching `.splash.out` in splash.css. */
const FADE_MS = 500
/** While the engine starts, the line creeps towards this share, then fills on ready. */
const CREEP_TO = 0.8
const CREEP_MS = 2400

/**
 * The launch splash, from the PIXL Family Kit: the mark in slow orbit over the
 * ambient light, the wordmark settling in, and a lit hairline filling while
 * the engine comes up. It leaves once the engine has answered, whether ready
 * or not (the app's banner then says what went wrong).
 */
export function Splash({ engine }: { engine: EngineStatus | undefined }): React.JSX.Element | null {
  const settled = engine !== undefined && engine.status !== 'starting'
  const [phase, setPhase] = useState<'in' | 'out' | 'gone'>('in')
  const [shownAt] = useState(() => performance.now())
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (settled) return
    const t = setInterval(() => setElapsed(performance.now() - shownAt), 100)
    return () => clearInterval(t)
  }, [settled, shownAt])

  useEffect(() => {
    if (!settled) return
    const wait = Math.max(0, MIN_SHOWN_MS - (performance.now() - shownAt))
    const out = setTimeout(() => setPhase('out'), wait)
    const gone = setTimeout(() => setPhase('gone'), wait + FADE_MS)
    return () => {
      clearTimeout(out)
      clearTimeout(gone)
    }
  }, [settled, shownAt])

  if (phase === 'gone') return null
  const share = settled ? 1 : CREEP_TO * (1 - Math.exp(-elapsed / CREEP_MS))
  const status = !engine
    ? 'Starting PIXL Engine'
    : engine.status === 'starting'
      ? 'Warming up the encoders'
      : engine.status === 'ready'
        ? 'Ready'
        : 'Engine unavailable'

  return (
    <div className={`splash${phase === 'out' ? ' out' : ''}`} role="status" aria-live="polite">
      <Ambient intensity={0.85} />
      <div className="splash-center">
        <div className="splash-mark">
          <Mark size={220} motion={settled ? 'busy' : 'idle'} glow label="Space Pixl" />
        </div>
        <Wordmark className="splash-word" />
      </div>
      <div className="splash-foot">
        <div className="splash-track">
          <div className="splash-fill" style={{ width: `${share * 100}%` }} />
        </div>
        <div className="splash-row">
          <span className="micro splash-status">
            <i className={`dot sm${engine?.status === 'ready' || !settled ? '' : ' warn'}`} />
            <span>{status}</span>
          </span>
          <span className="splash-version">
            PIXL Engine{engine?.version ? ` ${engine.version}` : ''}
          </span>
        </div>
      </div>
    </div>
  )
}
