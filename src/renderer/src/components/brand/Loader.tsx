import { Mark } from './Mark'

/**
 * The engine at work: the mark whirling, with what it's doing beside it.
 * `inline` (16 px) sits in a line of text or a button, `card` (48 px) and
 * `overlay` (120 px) stack the label under the mark.
 */
export function Loader({
  label,
  scale = 'inline',
  className
}: {
  label?: string
  scale?: 'inline' | 'card' | 'overlay'
  className?: string
}): React.JSX.Element {
  const size = scale === 'inline' ? 16 : scale === 'card' ? 48 : 120
  return (
    <span
      className={`loader${scale === 'inline' ? '' : ' col'}${className ? ` ${className}` : ''}`}
      role="status"
      aria-live="polite"
    >
      <Mark
        size={size}
        detail={size <= 48 ? 'small' : 'full'}
        motion="busy"
        glow={scale === 'overlay'}
        label=""
      />
      {label && <span className="loader-label">{label}</span>}
    </span>
  )
}
