'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { AuthBadge } from '@/components/auth/AuthBadge'
import { SystemObject } from '@/components/brand/SystemObject'
import { useFeedPulse } from '@/lib/hooks/useFeedPulse'

// Header destinations. Trimmed from 9 → 5 on 2026-05-12 to break the visual
// equivalence with the SECCIÓN rail (beta testers were ignoring FORO +
// MARKETPLACE because they read as duplicates of //NOTICIA / //MIX / etc
// filter rows). The /about entry (labeled EMPIEZA AQUÍ) surfaces the
// invitation-as-about page — the orientation/guide for new visitors.
// Every item renders in sys-orange by default; only the *active* item
// switches to an orange → red gradient + glow. The differentiation is
// "selected vs not," not "this item is its own color."
const NAV_LINKS = [
  { href: '/',            label: 'HOME' },
  { href: '/agenda',      label: 'AGENDA' },
  { href: '/foro',        label: 'FORO' },
  { href: '/marketplace', label: 'MARKETPLACE' },
  { href: '/about',       label: 'EMPIEZA AQUÍ' },
]

// Beta feedback form — external Google Form, opens in a new tab. Rendered as
// a distinct amber CTA chip (not a section link) so it reads as "give us
// feedback" rather than another destination.
const FEEDBACK_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSc71uI_yNHJW0z-iN2KVughYGURNQGl-wY7vTz8Q_03RzQfuw/viewform'

// Active-state gradient — sys-orange → sys-red, matching the header's top
// accent bar so the "this is where you are" cue is visually rhymed with the
// brand chrome. Inline (not Tailwind) because it feeds WebkitBackgroundClip.
const ACTIVE_GRADIENT = 'linear-gradient(to right, #F97316, #E63329)'

// "hace Xm" label for the feed heartbeat (terminal voice, Spanish).
function agoLabel(minutes: number): string {
  if (minutes < 1) return 'AHORA'
  if (minutes < 60) return `HACE ${minutes}m`
  if (minutes < 1440) return `HACE ${Math.floor(minutes / 60)}h`
  return `HACE ${Math.floor(minutes / 1440)}d`
}

// Identity mottos only — no status readouts. The strip never claims system
// state it can't verify (the feed heartbeat at the right edge is the one
// honest live readout on this row).
const DATA_STRIP = [
  'GRADIENTE·SUBSISTEMA·CULTURAL', '//', 'TRANSMISIÓN·CDMX', '//',
  'FRECUENCIA·ABIERTA', '//', 'MÚSICA·ELECTRÓNICA', '//', 'ARCHIVO·VIVO', '//',
  'GUÍAS·NO·GATEKEEPERS', '//', 'SIN·ALGORITMO', '//',
  '00·GLACIAL····10·VOLCÁN', '//', 'CDMX·UNDERGROUND', '//',
]

export function Navigation() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  // Real CDMX wall clock. Stable placeholder server-side, filled on mount —
  // same hydration pattern as the feed pulse (nothing time-dependent in SSR).
  const [clock, setClock] = useState('--:--:--')

  useEffect(() => {
    const fmt = new Intl.DateTimeFormat('es-MX', {
      timeZone: 'America/Mexico_City',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
    const update = () => setClock(fmt.format(new Date()))
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  // Real feed heartbeat — how long since the HP rollup last moved the feed +
  // active piece count. now=0 until the hook resolves client-side, so nothing
  // time-dependent renders during SSR.
  const { lastCuratedAt, activeCount, now } = useFeedPulse()
  const curatedMs = lastCuratedAt ? Date.parse(lastCuratedAt) : null
  const minutesAgo =
    curatedMs !== null && now > 0 ? Math.max(0, Math.floor((now - curatedMs) / 60000)) : null
  const feedFresh = minutesAgo !== null && minutesAgo < 6 // within one rollup cycle

  return (
    <header className="eva-scanlines sticky top-0 z-50 bg-base">

      {/* ── Top gradient bar ── */}
      <div className="h-[2px] w-full bg-gradient-to-r from-sys-red via-sys-orange to-sys-red" />

      {/* ── Main bar ── */}
      <div className="h-[54px] border-b border-border-subtle">
      <div className="mx-auto flex h-full max-w-screen-2xl items-stretch px-4 md:px-8">

        {/* ── Logo — wordmark lockup ── */}
        <Link
          href="/"
          className="group flex items-center gap-2.5 border-r-2 border-sys-orange pl-3 pr-4 transition-colors hover:bg-hover"
        >
          {/* Living ASCII brand mark — a rotating icosahedron lattice
              rasterized into a character grid, lit by the live feed piece
              count (tonight's signal strength). Density/heat/spin ARE the
              readout — no raw number. ~40px, canvas-2D, no WebGL context. */}
          <SystemObject signalStrength={activeCount} size={40} />
          <div className="flex flex-col gap-[3px]">
            <span className="font-syne text-[17px] font-black leading-none tracking-tighter text-sys-orange">
              GRADIENTE
            </span>
            <span className="font-mono text-[6px] tracking-[0.2em] text-muted">
              // SUBSISTEMA·CULTURAL·CDMX
            </span>
          </div>
        </Link>

        {/* ── Desktop nav links ──
            Inactive = always-visible sys-orange (no dim-until-active —
            the original complaint was that inactive items vanished).
            Active = orange → red gradient text + matching bottom bar +
            subtle tinted bg. The gradient is the only thing that swaps;
            color identity is consistent, "selected" is what reads. */}
        <nav className="hidden flex-1 items-stretch justify-center md:flex">
          {NAV_LINKS.map((link) => {
            const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className="group relative flex items-center justify-center border-r border-border-subtle px-6 transition-colors"
                style={{
                  // Subtle gradient tint behind the active item — mirrors
                  // the text gradient at ~6% opacity. Reads as "boxed"
                  // without dominating.
                  background: active
                    ? 'linear-gradient(to right, rgba(249,115,22,0.08), rgba(230,51,41,0.08))'
                    : 'transparent',
                }}
              >
                {/* Label.
                    - Inactive: solid sys-orange, no glow.
                    - Active: gradient text via bg-clip. `text-shadow` does
                      NOT render on bg-clipped text (the underlying glyph
                      is transparent), so the active glow uses `filter:
                      drop-shadow()` instead — that works because filter
                      operates on the rendered pixels, gradient included. */}
                <span
                  className={`font-syne text-[13px] font-bold leading-none tracking-widest ${
                    active ? '' : 'text-sys-orange'
                  }`}
                  style={
                    active
                      ? {
                          background: ACTIVE_GRADIENT,
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                          filter: 'drop-shadow(0 0 6px rgba(249,115,22,0.7)) drop-shadow(0 0 14px rgba(230,51,41,0.35))',
                        }
                      : undefined
                  }
                >
                  {link.label}
                </span>
                {/* Active bottom bar — same orange→red gradient as the label */}
                {active && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-[2px]"
                    style={{
                      background:
                        'linear-gradient(to right, transparent, #F97316, #E63329, transparent)',
                      boxShadow: '0 0 6px rgba(249,115,22,0.5)',
                    }}
                  />
                )}
                {/* Hover crosshair */}
                <span
                  className="absolute right-1 top-1 font-mono text-[9px] text-sys-orange opacity-0 transition-opacity group-hover:opacity-30"
                >+</span>
              </Link>
            )
          })}
        </nav>

        {/* ── CDMX clock — the header's one true time readout ── */}
        {/* Hidden below 2xl — pure chrome, sacrificed first when the
            DASHBOARD button needs viewport room at MacBook widths. */}
        <div className="hidden items-stretch border-l border-border-subtle 2xl:flex">
          <div className="flex flex-col items-center justify-center gap-[2px] px-4">
            <span className="font-mono text-[6px] tracking-[0.2em] text-muted">CDMX</span>
            <span className="font-mono text-[15px] font-bold leading-none tracking-[0.05em] tabular-nums text-sys-orange">
              {clock}
            </span>
          </div>
        </div>

        {/* Feedback (beta) — external Google Form, new tab. Amber chip so it
            reads as a distinct CTA, not another section. */}
        <a
          href={FEEDBACK_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden items-center border-l border-border-subtle px-3 md:flex"
        >
          <span className="border border-sys-amber/60 px-2 py-1 font-mono text-[10px] font-bold tracking-widest text-sys-amber transition-colors hover:bg-sys-amber/10">
            FEEDBACK BETA
          </span>
        </a>

        {/* Auth badge — LOGIN / DASHBOARD slot */}
        <AuthBadge />

        {/* Mobile toggle */}
        <button
          className="ml-auto flex items-center px-4 text-sys-orange md:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Menú"
        >
          <span className="font-syne text-xl font-black">
            {mobileOpen ? '×' : '≡'}
          </span>
        </button>
      </div>
      </div>

      {/* ── Data strip ── */}
      <div className="border-b-2 border-border-subtle bg-base">
      <div className="mx-auto flex h-[20px] max-w-screen-2xl items-center overflow-hidden px-4 md:px-8">
        {/* Left accent bar */}
        <div className="h-full w-[3px] flex-shrink-0 bg-gradient-to-b from-sys-orange to-sys-red" />

        {/* Tick ruler */}
        <div className="flex h-full flex-shrink-0 items-end gap-[3px] pb-[3px] pl-2">
          {[6, 4, 4, 4, 8, 4, 4, 4, 6].map((h, i) => (
            <div key={i} className="w-px flex-shrink-0 bg-border-subtle" style={{ height: `${h}px` }} />
          ))}
        </div>

        {/* Scrolling text */}
        <div className="relative flex-1 overflow-hidden">
          <div className="flex animate-[nge-ticker_55s_linear_infinite] gap-6 whitespace-nowrap pl-3">
            {[...DATA_STRIP, ...DATA_STRIP].map((token, i) => (
              <span
                key={i}
                className={`font-mono text-[8px] ${
                  token === '//' ? 'text-sys-orange/25' : 'text-muted'
                }`}
              >
                {token}
              </span>
            ))}
          </div>
        </div>

        {/* SYS status — real feed heartbeat: when the HP rollup last moved the
            feed (max items.hp_last_updated_at) + active piece count. The dot
            pulses (motion-safe) when re-curated within the last rollup cycle.
            Authed-only data; anonymous visitors see just the dim dot. */}
        <div className="flex flex-shrink-0 items-center gap-1.5 border-l border-border-subtle px-3">
          <span
            className={`h-[4px] w-[4px] rounded-full bg-sys-orange ${feedFresh ? 'motion-safe:animate-pulse' : ''}`}
            style={{
              boxShadow: '0 0 4px #F97316',
              opacity: minutesAgo === null ? 0.4 : feedFresh ? 1 : 0.6,
            }}
          />
          {minutesAgo !== null && (
            <span className="font-mono text-[7px] tabular-nums text-sys-orange/60">
              RECURADO {agoLabel(minutesAgo)}
              {activeCount !== null && (
                <span className="hidden opacity-70 sm:inline">
                  {' '}· {activeCount} PIEZAS
                </span>
              )}
            </span>
          )}
        </div>
      </div>
      </div>

      {/* ── Mobile menu ── */}
      {mobileOpen && (
        <nav className="border-t border-border-subtle bg-base">
          {NAV_LINKS.map((link) => {
            const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 border-b border-border-subtle px-4 py-3"
                style={{
                  background: active
                    ? 'linear-gradient(to right, rgba(249,115,22,0.08), rgba(230,51,41,0.08))'
                    : 'transparent',
                }}
              >
                <span className="font-mono text-[10px] text-sys-orange">
                  {active ? '▶' : '·'}
                </span>
                <span
                  className={`font-syne text-xs font-bold tracking-widest ${
                    active ? '' : 'text-sys-orange'
                  }`}
                  style={
                    active
                      ? {
                          background: ACTIVE_GRADIENT,
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                          filter: 'drop-shadow(0 0 6px rgba(249,115,22,0.7)) drop-shadow(0 0 14px rgba(230,51,41,0.35))',
                        }
                      : undefined
                  }
                >
                  {link.label}
                </span>
              </Link>
            )
          })}
          {/* Feedback (beta) — external, opens new tab */}
          <a
            href={FEEDBACK_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 border-b border-border-subtle px-4 py-3"
          >
            <span className="font-mono text-[10px] text-sys-amber">·</span>
            <span className="font-syne text-xs font-bold tracking-widest text-sys-amber">
              FEEDBACK BETA
            </span>
          </a>
        </nav>
      )}
    </header>
  )
}
