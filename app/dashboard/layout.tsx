'use client'

import { useEffect, type ReactNode } from 'react'

// ── /dashboard shell — «EL PLIEGO» paper surface (FINAL_SPEC §7.1) ──────────
//
// The dashboard opts out of the dark chrome (ChromeFrame nulls Navigation/
// GlobalPlayerBar/VibeSlider/footer; CRTOverlay suppresses the scanline
// shader) and paints its own full-bleed cream shell ABOVE the padded dark
// <main> — the /mapa full-bleed pattern: fixed inset-0 z-40 with its own
// scroll. z-40 sits under MiniTransport (50), the compose sheet (60), and
// the site overlay stack (its own higher z), per the §7.6 z-order table.
//
// `.dash-shell` in globals.css carries the paper ground, scoped scrollbar
// (paper track / ink thumb), ::selection (ink on acid), and overscroll
// containment; the `html.dash-route` toggle below extends the paper to the
// documentElement/body so scrollbar gutters and rubber-banding never flash
// #0D0D0D around the print surface.

export default function DashboardLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.add('dash-route')
    return () => {
      document.documentElement.classList.remove('dash-route')
    }
  }, [])

  return (
    <div className="dash-shell fixed inset-0 z-40 overflow-y-auto overflow-x-hidden">
      {children}
    </div>
  )
}
