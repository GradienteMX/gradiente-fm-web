'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { useAuth } from '@/components/auth/useAuth'
import { useSearch } from '@/components/search/useSearch'
import { AuthBadge } from '@/components/auth/AuthBadge'
import { SystemObject } from '@/components/brand/SystemObject'
import { AhoraChip } from '@/components/chrome/AhoraChip'
import { useFeedPulse } from '@/lib/hooks/useFeedPulse'

// ── Navigation — the pliego masthead (ink stamping) ─────────────────────────
//
// The 64px black strip: it reads over the still-dark page bodies today and
// over paper once the later phases land. Anatomy: wordmark lockup (living
// SystemObject mark, fed by the real feed pulse) · four destinations ·
// AhoraChip + FEEDBACK BETA + AuthBadge. Active destination = bold + 2px
// acid baseline (acid on panel is a sanctioned use); everything else is
// mono d13 panel-text with a plain hover underline. No glow, no gradients,
// no scanlines — the print language is borders, fills, and type.
//
// The mobile menu is the ONLY phone entry to login/registro — AuthBadge is
// desktop-only — so it keeps the full set: destinations, feedback, and the
// auth controls, every row ≥44px.

const NAV_LINKS = [
  { href: '/', label: 'INICIO' },
  { href: '/agenda', label: 'AGENDA' },
  { href: '/foro', label: 'FORO' },
  { href: '/marketplace', label: 'MERCADO' },
]

// Beta feedback form — external Google Form, opens in a new tab.
const FEEDBACK_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSc71uI_yNHJW0z-iN2KVughYGURNQGl-wY7vTz8Q_03RzQfuw/viewform'

// Focus ring for controls on the ink strip (outline-ink is invisible here).
const FOCUS_ON_PANEL =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel-text'

export function Navigation() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  // AuthBadge is desktop-only (hidden md:flex), so the mobile menu carries the
  // login / registro / panel / salir controls instead.
  const { isAuthed, openLogin, logout } = useAuth()
  const { openSearch } = useSearch()

  // Live feed piece count — feeds the brand mark's signal strength only.
  const { activeCount } = useFeedPulse()

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <header className="sticky top-0 z-50 border-b border-ink bg-panel text-panel-text">
      <div className="mx-auto flex h-16 w-full max-w-screen-2xl items-stretch gap-4 px-4 md:px-8">
        {/* ── Wordmark lockup ── */}
        <Link
          href="/"
          aria-label="Inicio"
          className={`flex shrink-0 items-center gap-2.5 ${FOCUS_ON_PANEL}`}
        >
          {/* Living ASCII brand mark — canvas-2D icosahedron lit by the live
              feed piece count. Density/heat/spin ARE the readout. */}
          <SystemObject signalStrength={activeCount} size={32} />
          <span className="flex flex-col gap-0.5">
            <span className="font-syne text-d18 font-extrabold leading-none tracking-tight text-panel-text">
              GRADIENTE
            </span>
            <span className="hidden font-mono text-d11 uppercase tracking-widest text-panel-text/60 sm:block">
              SUBSISTEMA CULTURAL · CDMX
            </span>
          </span>
        </Link>

        {/* ── Desktop destinations ── */}
        <nav
          aria-label="Navegación"
          className="hidden min-w-0 flex-1 items-stretch justify-center md:flex"
        >
          {NAV_LINKS.map((link) => {
            const active = isActive(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex items-center px-4 font-mono text-d13 uppercase tracking-widest ${
                  active
                    ? 'font-bold text-panel-text'
                    : 'text-panel-text/80 hover:underline hover:underline-offset-4'
                } ${FOCUS_ON_PANEL}`}
              >
                {link.label}
                {/* Active baseline — acid on panel (sanctioned use). */}
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-acid"
                  />
                )}
              </Link>
            )
          })}
        </nav>

        {/* ── Right cluster ── */}
        <div className="ml-auto flex shrink-0 items-center gap-3">
          {/* Now-playing chip — its own subscriber leaf, so audio ticks never
              re-render this header. Hidden on phones (the HUD covers it). */}
          <div className="hidden sm:block">
            <AhoraChip />
          </div>

          {/* Búsqueda — the visible trigger for the global SearchOverlay
              (the `/` shortcut in SearchProvider is the other door). */}
          <button
            type="button"
            onClick={openSearch}
            className={`hidden min-h-11 items-center md:flex ${FOCUS_ON_PANEL}`}
            aria-label="Buscar"
          >
            <span className="flex items-center gap-1.5 border border-panel-text/60 px-2 py-1 font-mono text-d11 uppercase tracking-widest text-panel-text hover:bg-panel-text hover:text-panel">
              <svg
                width="12"
                height="12"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                aria-hidden
              >
                <circle cx="6" cy="6" r="4.4" />
                <path d="M9.4 9.4 L13 13" />
              </svg>
              BUSCAR
            </span>
          </button>

          {/* Feedback (beta) — external Google Form, new tab. */}
          <a
            href={FEEDBACK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`hidden min-h-11 items-center md:flex ${FOCUS_ON_PANEL}`}
          >
            <span className="border border-panel-text/60 px-2 py-1 font-mono text-d11 uppercase tracking-widest text-panel-text hover:bg-panel-text hover:text-panel">
              FEEDBACK BETA
            </span>
          </a>

          {/* Identity slot — desktop only. */}
          <AuthBadge />

          {/* Mobile toggle */}
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menú"
            aria-expanded={mobileOpen}
            className={`flex min-h-11 min-w-11 items-center justify-center md:hidden ${FOCUS_ON_PANEL}`}
          >
            <span aria-hidden className="font-syne text-xl font-extrabold">
              {mobileOpen ? '×' : '≡'}
            </span>
          </button>
        </div>
      </div>

      {/* ── Mobile menu — hard cut open/close, ink register ── */}
      {mobileOpen && (
        <nav
          aria-label="Navegación"
          className="border-t border-panel-text/20 md:hidden"
        >
          {NAV_LINKS.map((link) => {
            const active = isActive(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-11 items-center gap-3 border-b border-panel-text/20 px-4 font-mono text-d13 uppercase tracking-widest ${
                  active ? 'font-bold text-panel-text' : 'text-panel-text/80'
                } ${FOCUS_ON_PANEL}`}
              >
                {/* 8px acid dot marks the active row (acid on panel — legal);
                    a transparent twin keeps the labels aligned. */}
                <span
                  aria-hidden
                  className={`h-2 w-2 shrink-0 ${active ? 'bg-acid' : 'bg-transparent'}`}
                />
                {link.label}
              </Link>
            )
          })}

          {/* Feedback (beta) — external, opens new tab */}
          <a
            href={FEEDBACK_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMobileOpen(false)}
            className={`flex min-h-11 items-center gap-3 border-b border-panel-text/20 px-4 font-mono text-d13 uppercase tracking-widest text-panel-text/80 ${FOCUS_ON_PANEL}`}
          >
            <span aria-hidden className="h-2 w-2 shrink-0 bg-transparent" />
            FEEDBACK BETA
          </a>

          {/* Auth controls — only place login/registro is reachable on phones. */}
          {!isAuthed ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false)
                  openLogin('login')
                }}
                className={`flex min-h-11 w-full items-center gap-3 border-b border-panel-text/20 px-4 text-left font-mono text-d13 uppercase tracking-widest text-panel-text ${FOCUS_ON_PANEL}`}
              >
                <span aria-hidden className="h-2 w-2 shrink-0 bg-transparent" />
                INICIAR SESIÓN
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false)
                  openLogin('signup')
                }}
                className={`flex min-h-11 w-full items-center gap-3 px-4 text-left font-mono text-d13 uppercase tracking-widest text-panel-text ${FOCUS_ON_PANEL}`}
              >
                <span aria-hidden className="h-2 w-2 shrink-0 bg-transparent" />
                REGISTRARSE
              </button>
            </>
          ) : (
            <>
              <Link
                href="/dashboard"
                onClick={() => setMobileOpen(false)}
                className={`flex min-h-11 items-center gap-3 border-b border-panel-text/20 px-4 font-mono text-d13 uppercase tracking-widest text-panel-text ${FOCUS_ON_PANEL}`}
              >
                <span aria-hidden className="h-2 w-2 shrink-0 bg-transparent" />
                PANEL
              </Link>
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false)
                  void logout()
                }}
                className={`flex min-h-11 w-full items-center gap-3 px-4 text-left font-mono text-d13 uppercase tracking-widest text-panel-text/80 ${FOCUS_ON_PANEL}`}
              >
                <span aria-hidden className="h-2 w-2 shrink-0 bg-transparent" />
                SALIR
              </button>
            </>
          )}
        </nav>
      )}
    </header>
  )
}
