'use client'

/**
 * PANEL — the sheet the Tienda and the Pieza de mercado share. A portal over
 * the page under a flat veil; the sheet comes off the press from the rect it
 * was opened from (a sleeve, a store card) via the shared TRAMA engine, and
 * goes back into it on close. Sheets stack — the Pieza over its Tienda over
 * an Estación — and Esc closes only the one on top. Focus is trapped inside
 * and returned where it came from.
 */

import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useHydrated } from '@/lib/useMedia'
import { createPortal } from 'react-dom'
import type { OriginRect } from '@/lib/store/ui'
import { useUI } from '@/lib/store/ui'
import { setFieldDim } from '@/components/stage/api'
import { asentar, imprimirHoja } from '@/components/trama/api'
import styles from './Panel.module.css'

let open = 0
let locks = 0
let savedOverflow = ''

// The market's own stack, so a covered panel can recede behind the one on top.
let order: string[] = []
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())
const subscribe = (f: () => void) => {
  subs.add(f)
  return () => {
    subs.delete(f)
  }
}

const Ctx = createContext<{ close: () => void; isTop: () => boolean }>({ close: () => {}, isTop: () => false })

/** Close the panel you're inside, with its exit motion. */
export function usePanel() {
  return useContext(Ctx)
}

interface Props {
  label: string
  onClose: () => void
  children: ReactNode
  z?: number
  width?: number
  origin?: OriginRect | null
  /** Parent-driven exit (e.g. closing a whole stack at once). */
  leaving?: boolean
  /** A lighter veil when stacked over another panel. */
  stacked?: boolean
  /** Size to content instead of filling the viewport height. */
  compact?: boolean
}

/** Client-only: a portal can't be part of the server HTML, so it waits for mount. */
export function Panel(props: Props) {
  const mounted = useHydrated()
  return mounted ? <PanelFrame {...props} /> : null
}

function PanelFrame({ label, onClose, children, z = 62, width = 1100, origin = null, leaving = false, stacked = false, compact = false }: Props) {
  const panel = useRef<HTMLDivElement>(null)
  const returnTo = useRef<Element | null>(null)
  const [closing, setClosing] = useState(false)
  const id = useId()
  const covered = useSyncExternalStore(
    subscribe,
    () => order.length > 0 && order[order.length - 1] !== id && order.includes(id),
    () => false,
  )
  const closingRef = useRef(false)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  // Mount: lock the page, dim the field, unfold.
  useLayoutEffect(() => {
    const el = panel.current
    if (!el) return
    returnTo.current = document.activeElement
    open++
    order = [...order, id]
    emit()
    if (locks++ === 0) {
      savedOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    setFieldDim(0.72)
    // Whatever was printing behind settles now; this sheet comes off the press
    // from the sleeve or card it was opened from (TRAMA — instant when off).
    asentar(el)
    void imprimirHoja(el, { origin: originPoint(origin) })
    el.focus({ preventScroll: true })
    return () => {
      open--
      order = order.filter((x) => x !== id)
      emit()
      if (--locks === 0) document.body.style.overflow = savedOverflow
      if (open === 0 && !useUI.getState().lectura) setFieldDim(0)
      const back = returnTo.current as HTMLElement | null
      if (back && document.contains(back)) back.focus?.({ preventScroll: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const animateOut = useCallback(
    (then?: () => void) => {
      const el = panel.current
      if (!el) return then?.()
      void imprimirHoja(el, { reverse: true, origin: originPoint(origin) }).then(() => then?.())
    },
    [origin],
  )

  const close = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    setClosing(true)
    animateOut(() => onCloseRef.current())
  }, [animateOut])

  useEffect(() => {
    if (!leaving || closingRef.current) return
    closingRef.current = true
    setClosing(true)
    animateOut()
  }, [leaving, animateOut])

  const isTop = useCallback(() => {
    const all = document.querySelectorAll('[role="dialog"][aria-modal="true"]')
    return all[all.length - 1] === panel.current
  }, [])

  // Esc and Tab — only when this panel is the top-most modal on the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isTop()) return
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
        return
      }
      if (e.key === 'Tab' && panel.current) {
        const f = [...panel.current.querySelectorAll<HTMLElement>('a[href], button, input, textarea, select, iframe, [tabindex]:not([tabindex="-1"])')].filter(
          (x) => !x.hasAttribute('disabled') && x.offsetParent !== null,
        )
        if (!f.length) return
        const a = f[0]
        const b = f[f.length - 1]
        if (e.shiftKey && (document.activeElement === a || document.activeElement === panel.current)) {
          e.preventDefault()
          b.focus()
        } else if (!e.shiftKey && document.activeElement === b) {
          e.preventDefault()
          a.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close, isTop])

  return createPortal(
    <div className={styles.root} style={{ zIndex: z }} data-closing={closing || undefined} data-stacked={stacked || undefined} data-covered={covered || undefined}>
      <div className={styles.backdrop} onClick={close} aria-hidden="true" />
      <div className={styles.frame}>
        <div ref={panel} className={styles.panel} data-compact={compact || undefined} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} style={{ width: `min(${width}px, 100%)` }}>
          <Ctx.Provider value={{ close, isTop }}>{children}</Ctx.Provider>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function originPoint(o: OriginRect | null) {
  return o ? { x: o.x + o.width / 2, y: o.y + o.height / 2 } : null
}

/** Shared chrome bits so both panels read as siblings of the Lectura header. */
export function PanelHead({ children }: { children: ReactNode }) {
  return <header className={styles.head}>{children}</header>
}

export function PanelBody({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={[styles.body, className ?? ''].join(' ')} data-lenis-prevent="">
      {children}
    </div>
  )
}

export { styles as panelStyles }
