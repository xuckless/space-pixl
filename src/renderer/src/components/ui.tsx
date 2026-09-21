import { useEffect, useRef, useState, type ReactNode } from 'react'

export type Tone = 'ok' | 'ac' | 'warn' | 'err' | ''

/* ── Icons ──────────────────────────────────────────────────────────────── */

export function Logo(): React.JSX.Element {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="4" stroke="#e8ebf2" strokeWidth="1.6" />
      <rect x="7" y="7" width="4" height="4" rx="1" fill="var(--accent)" />
      <rect x="13" y="7" width="4" height="4" rx="1" fill="#3a4152" />
      <rect x="7" y="13" width="4" height="4" rx="1" fill="#3a4152" />
      <rect x="13" y="13" width="4" height="4" rx="1" fill="var(--accent)" />
    </svg>
  )
}

export function IconInfo({ size = 13 }: { size?: number }): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 11v6M12 7.5v.5" />
    </svg>
  )
}

export function IconImage(): React.JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#8a93a6"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="M21 16l-5-5-8 8" />
    </svg>
  )
}

export function IconWave(): React.JSX.Element {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M3 12h4l3-8 4 16 3-8h4" />
    </svg>
  )
}

export function IconSliders(): React.JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#9aa3b5"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  )
}

export function IconChevron(): React.JSX.Element {
  return (
    <svg
      className="chev"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#9aa3b5"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

export function IconArrow(): React.JSX.Element {
  return (
    <svg
      className="arrow"
      width="18"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#8a93a6"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M4 12h16M14 6l6 6-6 6" />
    </svg>
  )
}

export function IconDownload(): React.JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      aria-hidden="true"
    >
      <path d="M12 4v12M6 10l6 6 6-6M4 20h16" />
    </svg>
  )
}

export function IconCheck(): React.JSX.Element {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      aria-hidden="true"
    >
      <path d="M5 12l5 5L20 7" />
    </svg>
  )
}

/* ── Status ─────────────────────────────────────────────────────────────── */

export function Dot({
  tone = 'ok',
  sm
}: {
  tone?: Tone | 'idle'
  sm?: boolean
}): React.JSX.Element {
  return <span className={`dot ${tone === 'ok' ? '' : tone} ${sm ? 'sm' : ''}`} />
}

export function Pill({
  tone = '',
  children,
  lg,
  className = ''
}: {
  tone?: Tone
  children: ReactNode
  lg?: boolean
  className?: string
}): React.JSX.Element {
  return <span className={`pill ${tone} ${lg ? 'lg' : ''} ${className}`}>{children}</span>
}

export function Chip({
  children,
  tone = '',
  off
}: {
  children: ReactNode
  tone?: Tone
  off?: boolean
}): React.JSX.Element {
  return <span className={`chip ${tone} ${off ? 'off' : ''}`}>{children}</span>
}

/* ── Info popover ───────────────────────────────────────────────────────── */

/**
 * A round "i" button that opens an explanation beside it. Closes on an
 * outside click or Escape. Explanatory prose lives here so the panels stay
 * quiet until asked.
 */
export function Info({
  title,
  label,
  children,
  align = 'right',
  sm,
  wide
}: {
  title?: string
  label?: string
  children: ReactNode
  align?: 'left' | 'right'
  sm?: boolean
  wide?: boolean
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    <span className={`info ${sm ? 'sm' : ''}`} ref={ref}>
      <button
        type="button"
        className={`ibtn ${sm ? 'sm' : ''} ${open ? 'on' : ''}`}
        aria-label={label ?? title ?? 'More information'}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <IconInfo size={sm ? 11 : 13} />
      </button>
      {open && (
        <div className={`pop ${align === 'right' ? 'r' : ''} ${wide ? 'wide' : ''}`} role="dialog">
          {title && <span className="t">{title}</span>}
          {children}
        </div>
      )}
    </span>
  )
}

/* ── Groups and sections ────────────────────────────────────────────────── */

export function GroupHead({
  children,
  info
}: {
  children: ReactNode
  info?: ReactNode
}): React.JSX.Element {
  return (
    <div className="group-head">
      <span className="label">{children}</span>
      {info}
    </div>
  )
}

export function Collapsible({
  icon,
  title,
  summary,
  open,
  onToggle,
  children,
  className = ''
}: {
  icon?: ReactNode
  title: string
  summary?: ReactNode
  open: boolean
  onToggle: () => void
  children: ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <section className={`card flush ${open ? 'open' : ''} ${className}`}>
      <button type="button" className="sec" onClick={onToggle} aria-expanded={open}>
        <span className="lead">
          {icon}
          <span className="title sm">{title}</span>
          {summary && <span className="summary">{summary}</span>}
        </span>
        <IconChevron />
      </button>
      {open && <div className="sec-body">{children}</div>}
    </section>
  )
}

/* ── Form controls ──────────────────────────────────────────────────────── */

/** One row of a `.form` grid: a label cell (with an optional hint popover) and a control cell. */
export function Field({
  label,
  hint,
  children
}: {
  label: string
  hint?: ReactNode
  children: ReactNode
}): React.JSX.Element {
  return (
    <>
      <div className="field-label">
        <span>{label}</span>
        {hint && (
          <Info sm align="left" title={label}>
            <p>{hint}</p>
          </Info>
        )}
      </div>
      <div className="field-control">{children}</div>
    </>
  )
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  disabled
}: {
  value: T
  options: { value: T; label: string; disabled?: boolean }[]
  onChange: (v: T) => void
  disabled?: boolean
}): React.JSX.Element {
  return (
    <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  disabled,
  format,
  label
}: {
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  disabled?: boolean
  format?: (v: number) => string
  label?: string
}): React.JSX.Element {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0
  return (
    <span className={`slider ${format ? 'with-format' : ''}`}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={label}
        style={{ '--p': `${Math.max(0, Math.min(100, pct))}%` } as React.CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={label ? `${label} value` : undefined}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)))
        }}
      />
      {format && <span className="slider-format">{format(value)}</span>}
    </span>
  )
}

export function Toggle({
  label,
  checked,
  onChange,
  disabled
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}): React.JSX.Element {
  return (
    <label className={`check ${disabled ? 'disabled' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  )
}

/* ── Numbers ────────────────────────────────────────────────────────────── */

export function Tile({
  label,
  value,
  sub,
  tone = '',
  className = ''
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  tone?: Tone
  className?: string
}): React.JSX.Element {
  return (
    <div className={`tile ${className}`}>
      <span className="tile-label">{label}</span>
      <span
        className={`tile-value ${tone === 'ok' ? 'ok-text' : tone === 'warn' ? 'warn-text' : ''}`}
      >
        {value}
      </span>
      {sub && <span className="tile-sub">{sub}</span>}
    </div>
  )
}

export function Fact({ label, value }: { label: string; value: ReactNode }): React.JSX.Element {
  return (
    <div className="fact">
      <span className="fact-label">{label}</span>
      <span className="fact-value">{value}</span>
    </div>
  )
}
