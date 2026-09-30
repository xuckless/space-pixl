import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
/** Matches `.modal.out` in dialogs.css. */
const EXIT_MS = 220

/**
 * A glass dialog over a dimmed, blurred app. Focus moves in on open, Tab stays
 * inside, Escape or a click on the scrim closes it, and focus goes back to
 * whatever opened it.
 */
export function Modal({
  open,
  onClose,
  labelledBy,
  className,
  children
}: {
  open: boolean
  onClose: () => void
  /** The id of the element that names the dialog. */
  labelledBy: string
  className?: string
  children: ReactNode
}): React.JSX.Element | null {
  const [shown, setShown] = useState(open)
  const [leaving, setLeaving] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const opener = useRef<Element | null>(null)
  const close = useEffectEvent(() => onClose())

  if (open && !shown) {
    setShown(true)
    setLeaving(false)
  }
  if (!open && shown && !leaving) setLeaving(true)

  useEffect(() => {
    if (!leaving) return
    const t = setTimeout(() => {
      setShown(false)
      setLeaving(false)
    }, EXIT_MS)
    return () => clearTimeout(t)
  }, [leaving])

  useEffect(() => {
    if (!shown) return
    opener.current = document.activeElement
    const first =
      box.current?.querySelector<HTMLElement>('[data-autofocus]') ??
      box.current?.querySelector<HTMLElement>(FOCUSABLE)
    first?.focus()
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
        return
      }
      if (e.key !== 'Tab' || !box.current) return
      const items = [...box.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null
      )
      if (items.length === 0) return
      const i = items.indexOf(document.activeElement as HTMLElement)
      if (e.shiftKey && i <= 0) {
        e.preventDefault()
        items[items.length - 1].focus()
      } else if (!e.shiftKey && i === items.length - 1) {
        e.preventDefault()
        items[0].focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      if (opener.current instanceof HTMLElement) opener.current.focus()
    }
  }, [shown])

  if (!shown) return null
  return createPortal(
    <div className={`modal-layer${leaving ? ' out' : ''}`}>
      <button
        type="button"
        className="modal-scrim"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        ref={box}
        className={`modal glass${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}
