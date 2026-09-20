import type { ReactNode } from 'react'

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }): React.JSX.Element {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {hint && <span className="field-hint">{hint}</span>}
      </span>
      {children}
    </label>
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
  format
}: {
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  disabled?: boolean
  format?: (v: number) => string
}): React.JSX.Element {
  return (
    <span className="slider">
      <input type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} />
      <input
        type="number"
        className="slider-number"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)))
        }}
      />
      {format && <span className="muted slider-format">{format(value)}</span>}
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
    <label className={`toggle ${disabled ? 'disabled' : ''}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

export function Chip({ children, tone = '' }: { children: ReactNode; tone?: 'ok' | 'warn' | 'err' | '' }): React.JSX.Element {
  return <span className={`badge ${tone}`}>{children}</span>
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }): React.JSX.Element {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}
