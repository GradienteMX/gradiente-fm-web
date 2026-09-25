'use client'

/**
 * SHEET — every modal surface that isn't a reading (access, search,
 * dialogs, report, composer confirmations): a paper sheet fed in over a
 * veiled page. Anything still printing underneath finishes the moment it
 * opens (TRAMA `asentar`); Esc and the backdrop close; focus is trapped and
 * returned.
 */

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { setFieldDim } from '@/components/stage/api'
import { asentar } from '@/components/trama/api'
import styles from './Sheet.module.css'

interface Props {
  open: boolean
  onClose: () => void
  children: ReactNode
  label: string
  variant?: 'center' | 'right' | 'top'
  width?: number
  z?: number
}

const stack: string[] = []

export function Sheet({ open, onClose, children, label, variant = 'center', width = 560, z = 80 }: Props) {
  const panel = useRef<HTMLDivElement>(null)
  const returnTo = useRef<Element | null>(null)
  const id = useId()
  // The latest onClose, without re-running the open effect: callers pass
  // inline functions, and re-running would bounce focus on every keystroke.
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    if (!open) return
    returnTo.current = document.activeElement
    stack.push(id)
    setFieldDim(0.6)
    // The gesture canvas sits above every sheet: settle the page under it.
    asentar(panel.current)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = window.setTimeout(() => {
      // An explicit autofocus wins over document order (a toggle may precede the field).
      const first =
        panel.current?.querySelector<HTMLElement>('[data-autofocus]') ??
        panel.current?.querySelector<HTMLElement>('input, textarea, select, button, [href], [tabindex]:not([tabindex="-1"])')
      first?.focus()
    }, 30)
    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== id) return
      if (e.key === 'Escape') {
        e.stopPropagation()
        close.current()
      }
      if (e.key === 'Tab' && panel.current) {
        const f = [...panel.current.querySelectorAll<HTMLElement>('input, textarea, select, button, [href], [tabindex]:not([tabindex="-1"])')].filter(
          (el) => !el.hasAttribute('disabled') && el.offsetParent !== null,
        )
        if (!f.length) return
        const a = f[0]
        const b = f[f.length - 1]
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault()
          b.focus()
        } else if (!e.shiftKey && document.activeElement === b) {
          e.preventDefault()
          a.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('keydown', onKey)
      const i = stack.indexOf(id)
      if (i >= 0) stack.splice(i, 1)
      if (!stack.length) setFieldDim(0)
      document.body.style.overflow = prevOverflow
      ;(returnTo.current as HTMLElement | null)?.focus?.()
    }
  }, [open, id])

  if (!open || typeof document === 'undefined') return null
  return createPortal(
    <div className={styles.root} data-variant={variant} style={{ zIndex: z }}>
      <div className={styles.backdrop} onClick={() => close.current()} aria-hidden="true" />
      <div ref={panel} className={styles.panel} role="dialog" aria-modal="true" aria-label={label} style={{ width: `min(${width}px, calc(100vw - 24px))` }}>
        {children}
      </div>
    </div>,
    document.body,
  )
}
