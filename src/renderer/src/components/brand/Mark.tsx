import { useEffect, useId, useMemo, useRef } from 'react'
import {
  inFront,
  markParts,
  onOrbit,
  type MarkDetail,
  type MarkTone,
  type Orbit
} from '../../../../shared/mark'
import { useReducedMotion } from '../../lib/useReducedMotion'

/**
 * How the mark moves. `still` rests in the logo's pose (easing back to it if
 * it was moving); `idle` is a slow orbit for heroes and dialogs; `busy` whirls
 * while the engine works, with the ring lit brighter and a comet on it.
 */
export type MarkMotion = 'still' | 'idle' | 'busy'

/** Degrees per second for each motion. One turn: idle 9 s, busy 1.6 s. */
const SPEED: Record<MarkMotion, number> = { still: 0, idle: 40, busy: 225 }
/** Speed changes settle with this time constant, in seconds. */
const EASE_S = 0.45
/** Coming to rest, the pixels keep at least this speed until they're home. */
const SETTLE_SPEED = 90

/* The comet: dashes on the ring behind the lead pixel, longest faintest. */
const COMET_FULL = [
  { len: 22, opacity: 0.9 },
  { len: 52, opacity: 0.42 },
  { len: 96, opacity: 0.16 }
]
const COMET_SMALL = [
  { len: 40, opacity: 0.85 },
  { len: 110, opacity: 0.3 }
]

/** Arc length along the ellipse at each whole degree, and the perimeter. */
function arcTable(o: Orbit): { at: Float64Array; perimeter: number } {
  const at = new Float64Array(361)
  let prev = onOrbit({ ...o, tilt: 0 }, 0)
  for (let d = 1; d <= 360; d++) {
    const p = onOrbit({ ...o, tilt: 0 }, d)
    at[d] = at[d - 1] + Math.hypot(p[0] - prev[0], p[1] - prev[1])
    prev = p
  }
  return { at, perimeter: at[360] }
}

function arcAt(table: Float64Array, deg: number): number {
  const d = ((deg % 360) + 360) % 360
  const i = Math.floor(d)
  return table[i] + (table[Math.min(360, i + 1)] - table[i]) * (d - i)
}

export function Mark({
  size,
  detail = 'full',
  tone = 'glass',
  motion = 'still',
  glow = false,
  label = 'Space Pixl',
  className
}: {
  size: number
  detail?: MarkDetail
  tone?: MarkTone
  motion?: MarkMotion
  glow?: boolean
  /** Accessible name; pass '' for a decorative mark. */
  label?: string
  className?: string
}): React.JSX.Element {
  const uid = 'm' + useId().replace(/[^a-zA-Z0-9]/g, '')
  const parts = useMemo(() => markParts({ detail, tone, id: uid }), [detail, tone, uid])
  const table = useMemo(() => arcTable(parts.orbit), [parts.orbit])
  const comet = detail === 'small' ? COMET_SMALL : COMET_FULL
  const reduced = useReducedMotion()

  const svg = useRef<SVGSVGElement>(null)
  const back = useRef<(SVGRectElement | null)[]>([])
  const front = useRef<(SVGRectElement | null)[]>([])
  const dashes = useRef<(SVGEllipseElement | null)[]>([])
  const target = useRef(SPEED[motion])
  const kick = useRef<(() => void) | null>(null)

  // The pixels' resting pose, relative to the lead pixel.
  const lead = parts.pixels[0]?.deg ?? 0
  const offsets = useMemo(() => parts.pixels.map((p) => p.deg - lead), [parts, lead])

  // Places every pixel for a lead angle: on the ring, a touch larger in front,
  // drawn in the back layer (under the sphere) or the front one.
  const place = useMemo(
    () =>
      (angle: number, energy: number): void => {
        parts.pixels.forEach((p, i) => {
          const deg = angle + offsets[i]
          const [x, y] = onOrbit(parts.orbit, deg)
          const s = p.size * (1 + 0.14 * Math.sin((deg * Math.PI) / 180))
          const near = inFront(deg)
          for (const [el, show] of [
            [back.current[i], !near],
            [front.current[i], near]
          ] as const) {
            if (!el) continue
            el.setAttribute('x', (x - s / 2).toFixed(2))
            el.setAttribute('y', (y - s / 2).toFixed(2))
            el.setAttribute('width', s.toFixed(2))
            el.setAttribute('height', s.toFixed(2))
            el.setAttribute('visibility', show ? 'visible' : 'hidden')
          }
        })
        const start = arcAt(table.at, angle)
        dashes.current.forEach((el, i) => {
          if (!el) return
          // two ellipses per comet dash: [i * 2] far half, [i * 2 + 1] near half
          const c = comet[Math.floor(i / 2)]
          el.setAttribute('stroke-dasharray', `${c.len} ${table.perimeter - c.len}`)
          el.setAttribute('stroke-dashoffset', (-start).toFixed(2))
          el.setAttribute('stroke-opacity', (c.opacity * energy).toFixed(3))
        })
        svg.current?.style.setProperty('--ring', (0.85 + 0.15 * energy).toFixed(3))
        // The light on the core drifts as it turns.
        const g = svg.current?.querySelector(`#${parts.sphereGradientId}`)
        if (g) {
          const k = ((angle - lead) * Math.PI) / 180
          g.setAttribute('cx', `${(36 + 5 * Math.sin(k * 0.5)).toFixed(2)}%`)
          g.setAttribute('cy', `${(30 + 2.5 * Math.cos(k * 0.5) - 2.5).toFixed(2)}%`)
        }
      },
    [parts, table, comet, offsets, lead]
  )

  useEffect(() => {
    target.current = reduced ? 0 : SPEED[motion]
    kick.current?.()
  }, [motion, reduced])

  // One rAF loop per mark, writing attributes straight to the SVG so React
  // never re-renders per frame. It sleeps whenever the mark is at rest.
  useEffect(() => {
    let raf = 0
    let last = 0
    let phase = 0 // degrees travelled from the resting pose
    let speed = 0
    let running = false
    place(lead, 0)

    const frame = (now: number): void => {
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60
      last = now
      const want = target.current
      speed += (want - speed) * (1 - Math.exp(-dt / EASE_S))
      if (want === 0) {
        // Coming home: keep moving until the pixels are back in the logo's pose.
        speed = Math.max(speed, SETTLE_SPEED)
        const before = phase % 360
        phase += speed * dt
        if (phase % 360 < before || speed * dt >= 360) {
          phase = 0
          speed = 0
          place(lead, 0)
          running = false
          last = 0
          return
        }
      } else {
        phase += speed * dt
      }
      const energy = Math.min(1, speed / SPEED.busy) * 0.75 + (speed > 1 ? 0.25 : 0)
      // The lead pixel moves to lower angles; its trail follows behind.
      place(lead - phase, energy)
      raf = requestAnimationFrame(frame)
    }
    kick.current = (): void => {
      if (running || target.current === 0) return
      running = true
      last = 0
      raf = requestAnimationFrame(frame)
    }
    kick.current()
    return () => {
      cancelAnimationFrame(raf)
      kick.current = null
    }
  }, [place, lead])

  const glowPx = Math.max(2, Math.round(size * 0.05))
  const ringW = parts.orbit.width + (detail === 'small' ? 0 : 0.6)
  const ellipse = (clip: string, i: number): React.JSX.Element => (
    <ellipse
      key={`${clip}${i}`}
      ref={(el) => {
        dashes.current[i * 2 + (clip === parts.frontClipId ? 1 : 0)] = el
      }}
      cx={120}
      cy={120}
      rx={parts.orbit.rx}
      ry={parts.orbit.ry}
      transform={`rotate(${parts.orbit.tilt} 120 120)`}
      fill="none"
      stroke="#e3e8ff"
      strokeWidth={ringW}
      strokeOpacity={0}
    />
  )
  const cometLayer = (clip: string): React.JSX.Element => (
    <g clipPath={`url(#${clip})`}>{comet.map((_, i) => ellipse(clip, i))}</g>
  )

  return (
    <svg
      ref={svg}
      className={`mark${className ? ` ${className}` : ''}`}
      viewBox="0 0 240 240"
      width={size}
      height={size}
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      style={
        glow && tone !== 'mono'
          ? { filter: `drop-shadow(0 0 ${glowPx}px rgba(147,164,255,.45))` }
          : undefined
      }
    >
      <defs dangerouslySetInnerHTML={{ __html: parts.defs }} />
      <g dangerouslySetInnerHTML={{ __html: parts.backRing }} />
      <g mask={`url(#${parts.backMaskId})`}>
        {cometLayer(parts.backClipId)}
        {parts.pixels.map((p, i) => (
          <rect
            key={i}
            ref={(el) => {
              back.current[i] = el
            }}
            fill={p.fill}
            opacity={p.opacity}
          />
        ))}
      </g>
      <g dangerouslySetInnerHTML={{ __html: parts.sphere }} />
      <g dangerouslySetInnerHTML={{ __html: parts.frontRing }} />
      {cometLayer(parts.frontClipId)}
      <g>
        {parts.pixels.map((p, i) => (
          <rect
            key={i}
            ref={(el) => {
              front.current[i] = el
            }}
            fill={p.fill}
            opacity={p.opacity}
          />
        ))}
      </g>
    </svg>
  )
}
