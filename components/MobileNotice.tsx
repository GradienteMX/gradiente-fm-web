'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Smartphone, Monitor, X } from 'lucide-react'

// ── MobileNotice ───────────────────────────────────────────────────────────
//
// A one-time, dismissible heads-up shown ONLY on small viewports while the
// mobile experience is still being polished. It does NOT block the site —
// the user can close it and keep browsing the (rough) mobile layout.
//
// Visibility is twofold:
//   - CSS (`md:hidden`) guarantees it never renders on desktop, even before
//     JS hydrates.
//   - A viewport + localStorage check inside the component keeps it from
//     re-appearing once dismissed, and avoids the body-scroll/backdrop work
//     on desktop.
//
// Bump DISMISS_KEY's version suffix to re-surface the notice for everyone
// (e.g. when the mobile beta ships and the message should change/retire).

const DISMISS_KEY = 'gradiente:mobile-notice:v1'
const MOBILE_MAX_WIDTH = 768 // Tailwind `md` breakpoint

export function MobileNotice() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // Never on the invite gate — /welcome is where invited users log in and
    // enter their code, and it has its own mobile-tuned entry flow. A "go to
    // desktop" notice there reads as "you can't get in."
    if (pathname?.startsWith('/welcome')) return
    // Only ever show on a phone-sized viewport, and only if not dismissed.
    const isMobile = window.innerWidth < MOBILE_MAX_WIDTH
    if (!isMobile) return
    try {
      if (localStorage.getItem(DISMISS_KEY)) return
    } catch {
      // localStorage can throw in private mode — fail open (show once).
    }
    setOpen(true)
  }, [pathname])

  // Lock body scroll while the notice is up.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      // ignore — worst case it shows again next visit
    }
    setOpen(false)
  }

  if (!open || pathname?.startsWith('/welcome')) return null

  return (
    <div
      className="overlay-backdrop-in fixed inset-0 z-[90] flex items-end justify-center p-4 md:hidden"
      onClick={dismiss}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mobile-notice-title"
    >
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" aria-hidden />

      <div
        onClick={(e) => e.stopPropagation()}
        className="eva-box eva-scanlines overlay-panel-in relative z-10 mb-6 flex w-full max-w-md flex-col overflow-hidden bg-base"
      >
        {/* Title strip */}
        <header className="flex items-center justify-between border-b border-border bg-elevated/60 px-3 py-2 font-mono text-[10px] tracking-widest text-secondary">
          <span className="flex items-center gap-2">
            <Smartphone size={12} strokeWidth={1.5} className="text-sys-amber" />
            <span id="mobile-notice-title">//AVISO·MÓVIL</span>
          </span>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Cerrar"
            className="text-muted transition-colors hover:text-primary"
          >
            <X size={12} strokeWidth={1.5} />
          </button>
        </header>

        {/* Body */}
        <div className="flex flex-col gap-3 p-4">
          <h2 className="font-syne text-lg font-bold leading-tight text-primary">
            La versión móvil casi está lista
          </h2>
          <p className="font-mono text-[11px] leading-relaxed text-secondary">
            Estamos puliendo la experiencia en celular. Por ahora, para la beta
            completamente funcional, entrá desde tu computadora.
          </p>
          <p className="flex items-center gap-2 font-mono text-[11px] leading-relaxed text-sys-amber">
            <Monitor size={13} strokeWidth={1.5} className="shrink-0" />
            <span>Te esperamos en pantalla grande. ¡Gracias!</span>
          </p>
        </div>

        {/* Action row */}
        <div className="flex items-center justify-end border-t border-border/60 bg-elevated/30 px-3 py-2">
          <button
            type="button"
            onClick={dismiss}
            className="border px-4 py-1.5 font-mono text-[10px] tracking-widest transition-colors"
            style={{
              borderColor: '#F97316',
              color: '#F97316',
              backgroundColor: '#F973161a',
            }}
          >
            ENTENDIDO
          </button>
        </div>
      </div>
    </div>
  )
}
