import { useId } from 'react'

/**
 * The ambient light behind empty states and the splash: blurred blue lights
 * drifting on black, with film grain and a vignette. Decorative only.
 */
export function Ambient({
  still = false,
  intensity = 1,
  className
}: {
  still?: boolean
  intensity?: number
  className?: string
}): React.JSX.Element {
  const id = 'g' + useId().replace(/[^a-zA-Z0-9]/g, '')
  return (
    <div
      className={`ambient${still ? ' still' : ''}${className ? ` ${className}` : ''}`}
      style={{ opacity: intensity }}
      aria-hidden
    >
      <span className="blob a" />
      <span className="blob b" />
      <span className="blob c" />
      <span className="blob d" />
      <svg className="grain">
        <filter id={id}>
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="2"
            stitchTiles="stitch"
          />
          <feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.5 0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#${id})`} />
      </svg>
      <div className="vignette" />
    </div>
  )
}
