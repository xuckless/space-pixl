/**
 * The Space Pixl mark: the engine's core in orbit. A lit sphere sits inside a
 * ring tilted −20°, like Saturn's; pixels travel the ring, passing behind the
 * sphere and back over it.
 *
 * Geometry and colours are the PIXL Family Kit's `Mark` component (kind
 * "space"), number for number, as pixl-web's `src/lib/marks.ts` also ports
 * them. The mark comes apart into its z-order layers so the animated mark in
 * the renderer can slot moving pixels between them:
 *
 *   back ring  →  (back pixels)  →  sphere  →  front ring  →  (front pixels)
 *
 * Pure and dependency-free: the renderer (components/brand) and the asset
 * scripts (scripts/brand-art.mts) share it.
 */

export type MarkTone = 'glass' | 'flat' | 'mono'
export type MarkDetail = 'full' | 'small'

export interface MarkOptions {
  tone?: MarkTone
  /** `small` is the heavy mark for 48 px and under: thick ring, one pixel. */
  detail?: MarkDetail
  /** The colour of a mono mark. */
  ink?: string
  /** The trailing pixels (full detail only). */
  pixels?: boolean
  /** Prefix for the SVG ids, unique per instance on a page. */
  id?: string
}

export interface OrbitPixel {
  /** Angle on the orbit's ellipse, in degrees. Front half: 0 < angle < 180. */
  deg: number
  size: number
  fill: string
  opacity: number
}

export interface Orbit {
  rx: number
  ry: number
  /** The ring's tilt, degrees. */
  tilt: number
  /** The ring's stroke width. */
  width: number
}

export interface MarkParts {
  orbit: Orbit
  defs: string
  backRing: string
  sphere: string
  frontRing: string
  /** The pixels in their resting places. */
  pixels: OrbitPixel[]
  /** The mask id that hides the back ring (and anything on it) around the sphere. */
  backMaskId: string
  /** Clip ids for the near and far halves of the ring's plane. */
  frontClipId: string
  backClipId: string
  /** The sphere's radial gradient id (the renderer drifts its highlight). */
  sphereGradientId: string
}

export const TILT = -20
export const VIEWBOX = 240
const C = 120

/* core r, orbit radii, stroke, front pixels (ellipse angle, size, opacity), back pixel */
const SP = {
  full: {
    r: 66,
    rx: 112,
    ry: 30,
    w: 3.2,
    front: [
      [24, 16, 1],
      [40, 10, 0.6],
      [53, 6, 0.3]
    ],
    back: [[200, 10, 0.7]]
  },
  small: { r: 64, rx: 114, ry: 36, w: 12, front: [[30, 28, 1]], back: [] as number[][] }
}

export const SPACE_BLUE = '#93a4ff'
const LEAD_GLASS = '#c4cdff'

/** A point on the tilted orbit, in viewBox units. */
export function onOrbit(o: Orbit, deg: number): [number, number] {
  const t = (deg * Math.PI) / 180
  const a = (o.tilt * Math.PI) / 180
  const xp = o.rx * Math.cos(t)
  const yp = o.ry * Math.sin(t)
  return [C + xp * Math.cos(a) - yp * Math.sin(a), C + xp * Math.sin(a) + yp * Math.cos(a)]
}

/** True when the angle is on the near half of the ring, in front of the sphere. */
export function inFront(deg: number): boolean {
  return Math.sin((deg * Math.PI) / 180) > 0
}

let counter = 0
function nextId(): string {
  counter += 1
  return `spm${counter}`
}

/** The mark, taken apart into its layers (viewBox 0 0 240 240). */
export function markParts(opts: MarkOptions = {}): MarkParts {
  const tone = opts.tone ?? 'glass'
  const ink = opts.ink ?? '#ebe9f3'
  const glass = tone === 'glass'
  const flat = tone === 'flat'
  const mono = tone === 'mono'
  const small = (opts.detail ?? 'full') === 'small'
  const o = small ? SP.small : SP.full
  const u = opts.id ?? nextId()
  const id = (k: string): string => `${u}${k}`
  const url = (k: string): string => `url(#${u}${k})`
  const orbit: Orbit = { rx: o.rx, ry: o.ry, tilt: TILT, width: mono ? o.w + 3 : o.w }

  const r = o.r
  const s = r * 0.24
  const hi = {
    s: s.toFixed(2),
    x: (C - r * 0.42 - s / 2).toFixed(2),
    y: (C - r * 0.44 - s / 2).toFixed(2)
  }
  const pixFill = mono ? ink : SPACE_BLUE
  const showTrail = opts.pixels !== false && !small
  const w = mono ? o.w + 3 : o.w
  const cut = w + (small ? 12 : 10)
  const hole = r + (small ? 10 : 5)
  const ringStroke = glass ? url('or') : mono ? ink : SPACE_BLUE
  const ellipse = (stroke: string, width: number, extra = ''): string =>
    `<ellipse cx="${C}" cy="${C}" rx="${o.rx}" ry="${o.ry}" transform="rotate(${TILT} ${C} ${C})" fill="none" stroke="${stroke}" stroke-width="${width}"${extra}/>`

  const defs = [
    `<radialGradient id="${id('sp')}" cx="36%" cy="30%" r="75%"><stop offset="0" stop-color="#f1ecff"/><stop offset="0.22" stop-color="#bba9ff"/><stop offset="0.55" stop-color="#7b68d8"/><stop offset="0.85" stop-color="#2b1f66"/><stop offset="1" stop-color="#0d0a1f"/></radialGradient>`,
    `<radialGradient id="${id('rim')}" cx="50%" cy="50%" r="50%"><stop offset="0.8" stop-color="#c8b9ff" stop-opacity="0"/><stop offset="0.97" stop-color="#c8b9ff" stop-opacity="0.5"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>`,
    `<linearGradient id="${id('or')}" gradientUnits="userSpaceOnUse" x1="14" y1="160" x2="226" y2="82"><stop offset="0" stop-color="${SPACE_BLUE}" stop-opacity="0.12"/><stop offset="0.55" stop-color="${SPACE_BLUE}" stop-opacity="0.6"/><stop offset="1" stop-color="#e3e8ff"/></linearGradient>`,
    // the front half of the ring's plane
    `<clipPath id="${id('fc')}"><rect x="-200" y="0" width="400" height="200" transform="translate(${C} ${C}) rotate(${TILT})"/></clipPath>`,
    `<clipPath id="${id('bc')}"><rect x="-200" y="-200" width="400" height="200" transform="translate(${C} ${C}) rotate(${TILT})"/></clipPath>`,
    // the back ring (and whatever rides it) stops short of the sphere
    `<mask id="${id('ob')}" maskUnits="userSpaceOnUse" x="-20" y="-20" width="280" height="280"><rect x="-20" y="-20" width="280" height="280" fill="#ffffff"/><circle cx="${C}" cy="${C}" r="${hole}" fill="#000000"/></mask>`,
    // the front ring cuts a channel through the sphere; a mono mark cuts out its highlight
    `<mask id="${id('sm')}" maskUnits="userSpaceOnUse" x="0" y="0" width="240" height="240"><rect x="0" y="0" width="240" height="240" fill="#ffffff"/><g clip-path="${url('fc')}">${ellipse('#000000', cut)}</g>${
      mono ? `<rect x="${hi.x}" y="${hi.y}" width="${hi.s}" height="${hi.s}" fill="#000000"/>` : ''
    }</mask>`
  ].join('')

  const sphereFill = glass ? url('sp') : flat ? '#9d8bea' : ink
  const sphere =
    `<g mask="${url('sm')}"><circle cx="${C}" cy="${C}" r="${r}" fill="${sphereFill}"/>${
      glass ? `<circle cx="${C}" cy="${C}" r="${r}" fill="${url('rim')}"/>` : ''
    }</g>` +
    (mono
      ? ''
      : `<rect x="${hi.x}" y="${hi.y}" width="${hi.s}" height="${hi.s}" fill="${glass ? '#ffffff' : '#f1ecff'}" opacity="0.94"/>`)

  const pixels: OrbitPixel[] = []
  o.front.forEach((q, i) => {
    if (i === 0 || showTrail)
      pixels.push({
        deg: q[0],
        size: q[1],
        fill: i === 0 && glass ? LEAD_GLASS : pixFill,
        opacity: q[2]
      })
  })
  if (showTrail)
    for (const q of o.back) pixels.push({ deg: q[0], size: q[1], fill: pixFill, opacity: q[2] })

  return {
    orbit,
    defs,
    backRing: ellipse(ringStroke, w, ` mask="${url('ob')}" class="orbit-ring"`),
    sphere,
    frontRing: `<g clip-path="${url('fc')}">${ellipse(ringStroke, w, ' class="orbit-ring"')}</g>`,
    pixels,
    backMaskId: id('ob'),
    frontClipId: id('fc'),
    backClipId: id('bc'),
    sphereGradientId: id('sp')
  }
}

/** One pixel as an SVG rect at an angle on the orbit. */
export function pixelRect(o: Orbit, p: OrbitPixel): string {
  const [x, y] = onOrbit(o, p.deg)
  return `<rect x="${(x - p.size / 2).toFixed(2)}" y="${(y - p.size / 2).toFixed(2)}" width="${p.size}" height="${p.size}" fill="${p.fill}" opacity="${p.opacity}"/>`
}

export interface MarkSvgOptions extends MarkOptions {
  /** Rendered width and height in px; omit for a fluid SVG. */
  size?: number
  /** A soft blue glow around the mark. */
  glow?: boolean
  /** Accessible name; pass '' for a decorative mark. */
  label?: string
}

/** The whole mark, at rest, as a standalone SVG string. */
export function markSvg(opts: MarkSvgOptions = {}): string {
  const p = markParts(opts)
  const back = p.pixels.filter((q) => !inFront(q.deg))
  const front = p.pixels.filter((q) => inFront(q.deg))
  const size = opts.size
  const glowPx = Math.max(2, Math.round((size ?? 240) * 0.05))
  const style =
    'display:block;overflow:visible;' +
    (opts.glow && opts.tone !== 'mono'
      ? `filter:drop-shadow(0 0 ${glowPx}px rgba(147,164,255,.45));`
      : '')
  const label = opts.label ?? 'Space Pixl'
  const a11y = label
    ? ` role="img" aria-label="${label.replace(/"/g, '&quot;')}"`
    : ' aria-hidden="true"'
  const dims = size ? ` width="${size}" height="${size}"` : ''
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}"${dims}${a11y} style="${style}">` +
    `<defs>${p.defs}</defs>${p.backRing}` +
    `<g mask="url(#${p.backMaskId})">${back.map((q) => pixelRect(p.orbit, q)).join('')}</g>` +
    `${p.sphere}${p.frontRing}${front.map((q) => pixelRect(p.orbit, q)).join('')}</svg>`
  )
}
