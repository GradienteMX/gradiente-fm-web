'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Smartphone, Monitor, X } from 'lucide-react'
import { isPaperRoute } from '@/lib/chrome/paperRoutes'

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

// The house focus grammar, panel variant — for the ink-bezel skin below.
const PANEL_FOCUS_RING =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel-text'

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

  // «EL PLIEGO» variant — the dashboard AND every paper route are a light
  // print surface (paper/ink/acid tokens); a dark panel reads as a foreign
  // object there. Same copy, same dismiss logic, pliego skin. The other skin
  // (below) is the ink-bezel register /mapa's chrome uses — the only ground
  // left that is dark on purpose.
  //
  // z-[110]: the dash shell is `fixed inset-0 z-40` and its own overlay stack
  // reaches z-[100] (HarvestConfirmModal) — the notice must sit above ALL of
  // it so the first tap lands on the notice, never on shell chrome beneath.
  //
  // Motion: none. The pliego motion constitution bans fades/scale entrances
  // (the site-wide overlay-backdrop-in/overlay-panel-in classes are both),
  // and the dark panel's 0.5s CRT boot-in also left ENTENDIDO's hit area
  // collapsed mid-animation — instant paint fixes both. Reduced-motion is
  // trivially complete (zero animation).
  const onPliego =
    ((pathname?.startsWith('/dashboard') || pathname === '/lab/dashboard') ??
      false) ||
    (pathname != null && isPaperRoute(pathname))

  if (onPliego) {
    return (
      // touch-manipulation + pointerup dismissal on the explicit controls:
      // under body-scroll-lock some touch pipelines (emulators included)
      // cancel the synthetic click after gesture disambiguation — pointerup
      // fires regardless, and dismiss() is idempotent if both arrive.
      <div
        className="fixed inset-0 z-[110] flex touch-manipulation items-end justify-center p-4 md:hidden"
        onClick={dismiss}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-notice-title"
      >
        <div className="absolute inset-0 bg-ink/50" aria-hidden />

        <div
          onClick={(e) => e.stopPropagation()}
          className="relative z-10 mb-6 flex w-full max-w-md flex-col overflow-hidden border border-ink bg-paper shadow-lift"
        >
          {/* Title strip */}
          <header className="flex min-h-11 items-center justify-between border-b border-ink bg-paper-raised pl-3 font-mono text-d11 tracking-widest text-ink-soft">
            <span className="flex items-center gap-2">
              <Smartphone size={12} strokeWidth={1.5} className="text-ink" />
              <span id="mobile-notice-title">//AVISO·MÓVIL</span>
            </span>
            <button
              type="button"
              onClick={dismiss}
              onPointerUp={dismiss}
              aria-label="Cerrar"
              className="flex h-11 w-11 items-center justify-center text-ink-faint hover:text-ink"
            >
              <X size={14} strokeWidth={1.5} />
            </button>
          </header>

          {/* Body */}
          <div className="flex flex-col gap-3 p-4">
            <h2 className="font-syne text-d18 font-bold leading-tight text-ink">
              La versión móvil casi está lista
            </h2>
            <p className="font-mono text-d11 leading-relaxed text-ink-soft">
              Estamos puliendo la experiencia en celular. Por ahora, para la
              beta completamente funcional, entrá desde tu computadora.
            </p>
            <p className="flex items-center gap-2 font-mono text-d11 leading-relaxed text-ink">
              <Monitor size={13} strokeWidth={1.5} className="shrink-0" />
              <span>Te esperamos en pantalla grande. ¡Gracias!</span>
            </p>
          </div>

          {/* Action row — acid fill-block (ink text on acid ≈13:1, legal use).
              min-h-11 = the 44px touch floor; hover = 1-step fill inversion
              (ink panel + acid text = the accent's other legal ground). */}
          <div className="flex items-center justify-end border-t border-ink bg-paper-raised p-2">
            <button
              type="button"
              onClick={dismiss}
              onPointerUp={dismiss}
              className="flex min-h-11 items-center justify-center border border-ink bg-acid px-6 font-mono text-d11 font-bold tracking-widest text-ink hover:bg-ink hover:text-acid"
            >
              ENTENDIDO
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Ink-bezel variant — /mapa's register: flat panel plates with panel-text
  // hairlines, no blur, no glow, acid reserved for the one own-action, the
  // focus grammar in its panel variant, ≥44px targets. Motion is dropped here
  // for the same reason the pliego branch has none: `overlay-panel-in` is the
  // 0.5s CRT boot-in (a scaleY(0.005) collapse), which left ENTENDIDO's hit
  // area flat while it played.
  return (
    <div
      className="fixed inset-0 z-[90] flex touch-manipulation items-end justify-center p-4 md:hidden"
      onClick={dismiss}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mobile-notice-title"
    >
      <div className="absolute inset-0 bg-ink/80" aria-hidden />

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 mb-6 flex w-full max-w-md flex-col overflow-hidden border border-panel-text/40 bg-panel text-panel-text"
      >
        {/* Title strip */}
        <header className="flex min-h-11 items-center justify-between border-b border-panel-text/40 pl-3 font-mono text-d11 tracking-widest text-panel-text/70">
          <span className="flex items-center gap-2">
            <Smartphone size={12} strokeWidth={1.5} className="text-panel-text" />
            <span id="mobile-notice-title">//AVISO·MÓVIL</span>
          </span>
          <button
            type="button"
            onClick={dismiss}
            // Parity with the paper branch: this panel locks body scroll, and
            // a locked dialog is exactly where the tap that never lands was
            // observed. Same hardening, same reason.
            onPointerUp={dismiss}
            aria-label="Cerrar"
            className={`flex h-11 w-11 items-center justify-center text-panel-text/70 transition-colors hover:text-panel-text ${PANEL_FOCUS_RING}`}
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        </header>

        {/* Body */}
        <div className="flex flex-col gap-3 p-4">
          <h2 className="font-syne text-d18 font-bold leading-tight text-panel-text">
            La versión móvil casi está lista
          </h2>
          <p className="font-mono text-d11 leading-relaxed text-panel-text/70">
            Estamos puliendo la experiencia en celular. Por ahora, para la beta
            completamente funcional, entrá desde tu computadora.
          </p>
          <p className="flex items-center gap-2 font-mono text-d11 leading-relaxed text-panel-text">
            <Monitor size={13} strokeWidth={1.5} className="shrink-0" />
            <span>Te esperamos en pantalla grande. ¡Gracias!</span>
          </p>
        </div>

        {/* Action row — the one acid moment on the bezel: a fill-block with
            panel-ink text on top (the whitelisted use), at the 44px floor. */}
        <div className="flex items-center justify-end border-t border-panel-text/40 p-2">
          <button
            type="button"
            onClick={dismiss}
            onPointerUp={dismiss}
            className={`flex min-h-11 items-center justify-center border border-acid bg-acid px-6 font-mono text-d11 font-bold tracking-widest text-panel transition-colors hover:bg-panel hover:text-acid ${PANEL_FOCUS_RING}`}
          >
            ENTENDIDO
          </button>
        </div>
      </div>
    </div>
  )
}
