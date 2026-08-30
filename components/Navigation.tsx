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
import { isPaperRoute } from '@/lib/chrome/paperRoutes'

// ── Navigation — the pliego masthead (dual-stamped) ─────────────────────────
//
// ONE anatomy, TWO grounds, chosen at runtime via isPaperRoute(pathname):
//
//   INK stamping (still-dark routes — foro, marketplace, franja, overlays…):
//   the 64px black strip from fase A, unchanged. Active destination = bold +
//   2px acid baseline (acid on panel is a sanctioned use); everything else is
//   mono d13 panel-text with a plain hover underline.
//
//   PAPER stamping (feed routes — home, agenda, category pages): same strip
//   printed on paper — bg-paper, ink type, 2px ink base rule. Active
//   destination = bold + 2px sys-red-paper baseline (red is the PUBLIC
//   editorial/live accent on paper; acid stays reserved for the ink stamping
//   and own-action badges). Chips are ink hairline + fill inversion.
//
// The SystemObject mark rasterizes the thermal ramp (grey→orange, tuned
// against black) — on paper it sits on a small 32px bg-panel plate with an
// ink border so the instrument stays legible (instrument doctrine).
//
// No glow, no gradients, no scanlines — the print language is borders, fills,
// and type, on either ground.
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

// Focus ring for controls on the ink strip (outline-ink is invisible there)
// vs on the paper strip (the house 2px ink outline, offset 2).
const FOCUS_ON_PANEL =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel-text'
const FOCUS_ON_PAPER =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

export function Navigation() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  // AuthBadge is desktop-only (hidden md:flex), so the mobile menu carries the
  // login / registro / panel / salir controls instead.
  const { isAuthed, openLogin, logout } = useAuth()
  const { openSearch } = useSearch()

  // Live feed piece count — feeds the brand mark's signal strength only.
  const { activeCount } = useFeedPulse()

  // Which stamping? Paper routes get the paper masthead; everything else
  // keeps the fase-A ink strip.
  const paper = isPaperRoute(pathname)
  const focusRing = paper ? FOCUS_ON_PAPER : FOCUS_ON_PANEL

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  // Bordered chip (BUSCAR / FEEDBACK BETA) — hairline + fill inversion on
  // either ground.
  const chipClass = paper
    ? 'border border-ink px-2 py-1 font-mono text-d11 uppercase tracking-widest text-ink hover:bg-ink hover:text-paper'
    : 'border border-panel-text/60 px-2 py-1 font-mono text-d11 uppercase tracking-widest text-panel-text hover:bg-panel-text hover:text-panel'

  // Mobile menu row separators: ink hairlines on paper, faint panel-text on ink.
  const rowBorder = paper ? 'border-b border-ink' : 'border-b border-panel-text/20'

  return (
    <header
      className={`sticky top-0 z-50 ${
        paper
          ? 'border-b-2 border-ink bg-paper text-ink'
          : 'border-b border-ink bg-panel text-panel-text'
      }`}
    >
      <div className="mx-auto flex h-16 w-full max-w-screen-2xl items-stretch gap-4 px-4 md:px-8">
        {/* ── Wordmark lockup ── */}
        <Link
          href="/"
          aria-label="Inicio"
          className={`flex shrink-0 items-center gap-2.5 ${focusRing}`}
        >
          {/* Living ASCII brand mark — canvas-2D icosahedron lit by the live
              feed piece count. Density/heat/spin ARE the readout. Its ramp is
              tuned against black, so on paper it rides a small panel plate. */}
          {paper ? (
            <span
              aria-hidden
              className="flex h-8 w-8 shrink-0 items-center justify-center border border-ink bg-panel"
            >
              <SystemObject signalStrength={activeCount} size={28} />
            </span>
          ) : (
            <SystemObject signalStrength={activeCount} size={32} />
          )}
          <span className="flex flex-col gap-0.5">
            <span
              className={`font-syne text-d18 font-extrabold leading-none tracking-tight ${
                paper ? 'text-ink' : 'text-panel-text'
              }`}
            >
              GRADIENTE
            </span>
            <span
              className={`hidden font-mono text-d11 uppercase tracking-widest sm:block ${
                paper ? 'text-ink-faint' : 'text-panel-text/60'
              }`}
            >
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
                    ? paper
                      ? 'font-bold text-ink'
                      : 'font-bold text-panel-text'
                    : paper
                      ? 'text-ink-soft hover:underline hover:underline-offset-4'
                      : 'text-panel-text/80 hover:underline hover:underline-offset-4'
                } ${focusRing}`}
              >
                {link.label}
                {/* Active baseline — sys-red-paper on paper (the public live
                    accent), acid on panel (sanctioned use). */}
                {active && (
                  <span
                    aria-hidden
                    className={`absolute inset-x-0 bottom-0 h-0.5 ${
                      paper ? 'bg-sys-red-paper' : 'bg-acid'
                    }`}
                  />
                )}
              </Link>
            )
          })}
        </nav>

        {/* ── Right cluster ── */}
        <div className="ml-auto flex shrink-0 items-center gap-3">
          {/* Now-playing chip — its own subscriber leaf, so audio ticks never
              re-render this header. Hidden on phones (the HUD covers it).
              Ground-aware internally via isPaperRoute. */}
          <div className="hidden sm:block">
            <AhoraChip />
          </div>

          {/* Búsqueda — the visible trigger for the global SearchOverlay
              (the `/` shortcut in SearchProvider is the other door). */}
          <button
            type="button"
            onClick={openSearch}
            className={`hidden min-h-11 items-center md:flex ${focusRing}`}
            aria-label="Buscar"
          >
            <span className={`flex items-center gap-1.5 ${chipClass}`}>
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
            className={`hidden min-h-11 items-center md:flex ${focusRing}`}
          >
            <span className={chipClass}>FEEDBACK BETA</span>
          </a>

          {/* Identity slot — desktop only. Ground-aware internally. */}
          <AuthBadge />

          {/* Mobile toggle — inherits the strip's ink/panel-text color. */}
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menú"
            aria-expanded={mobileOpen}
            className={`flex min-h-11 min-w-11 items-center justify-center md:hidden ${focusRing}`}
          >
            <span aria-hidden className="font-syne text-xl font-extrabold">
              {mobileOpen ? '×' : '≡'}
            </span>
          </button>
        </div>
      </div>

      {/* ── Mobile menu — hard cut open/close, stamped like the strip ── */}
      {mobileOpen && (
        <nav
          aria-label="Navegación"
          className={`md:hidden ${
            paper ? 'border-t border-ink bg-paper' : 'border-t border-panel-text/20'
          }`}
        >
          {NAV_LINKS.map((link) => {
            const active = isActive(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-11 items-center gap-3 px-4 font-mono text-d13 uppercase tracking-widest ${rowBorder} ${
                  active
                    ? paper
                      ? 'font-bold text-ink'
                      : 'font-bold text-panel-text'
                    : paper
                      ? 'text-ink-soft'
                      : 'text-panel-text/80'
                } ${focusRing}`}
              >
                {/* 8px square marks the active row: sys-red-paper on paper
                    (editorial state, not an own-action — acid stays out),
                    acid on panel (legal there). A transparent twin keeps the
                    labels aligned. */}
                <span
                  aria-hidden
                  className={`h-2 w-2 shrink-0 ${
                    active
                      ? paper
                        ? 'bg-sys-red-paper'
                        : 'bg-acid'
                      : 'bg-transparent'
                  }`}
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
            className={`flex min-h-11 items-center gap-3 px-4 font-mono text-d13 uppercase tracking-widest ${rowBorder} ${
              paper ? 'text-ink-soft' : 'text-panel-text/80'
            } ${focusRing}`}
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
                className={`flex min-h-11 w-full items-center gap-3 px-4 text-left font-mono text-d13 uppercase tracking-widest ${rowBorder} ${
                  paper ? 'text-ink' : 'text-panel-text'
                } ${focusRing}`}
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
                className={`flex min-h-11 w-full items-center gap-3 px-4 text-left font-mono text-d13 uppercase tracking-widest ${
                  paper ? 'text-ink' : 'text-panel-text'
                } ${focusRing}`}
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
                className={`flex min-h-11 items-center gap-3 px-4 font-mono text-d13 uppercase tracking-widest ${rowBorder} ${
                  paper ? 'text-ink' : 'text-panel-text'
                } ${focusRing}`}
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
                className={`flex min-h-11 w-full items-center gap-3 px-4 text-left font-mono text-d13 uppercase tracking-widest ${
                  paper ? 'text-ink-soft' : 'text-panel-text/80'
                } ${focusRing}`}
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
