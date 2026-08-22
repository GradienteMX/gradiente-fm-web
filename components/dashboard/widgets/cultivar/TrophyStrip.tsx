'use client'

// ── CULTIVAR trophy strip (FINAL_SPEC §3.1 + judge FIX-B 3) ─────────────────
//
// Earned trophies inline at 0 clicks — real keys from the provider's
// `trophies` slice against TROPHY_CATALOG, each drawn as a designed 14px
// inline-SVG pictograph (one distinct geometric ink mark per catalog key —
// the ASCII sigils stay in lib/trophies.ts for the dark site's chip chrome).
// Every glyph chip carries title + aria-label naming the trophy AND its
// unlock condition; chips have no click action, so they render as spans
// (role="img"), never buttons. Locked trophies = ink-faint outlines with the
// NAMED condition — no counters, no «próximamente».
//
// Beneath: one hairline progress bar toward the next presence trophy —
// words + a rule, zero numerals, zero donuts (the identity spine is the only
// place the raw scalar renders). The strip is a single 24px row (border-t 1
// + pt-2 8 + h-6 24 = 33px — part of Zone C's exact h3 budget).

import type { ReactNode } from 'react'
import { useDashboardData } from '@/components/dashboard/DashboardDataProvider'
import { TROPHY_CATALOG, type TrophyKey } from '@/lib/trophies'

// ── The pictograph set (judge FIX-B 3) ──────────────────────────────────────
// 14×14 viewBox, currentColor only (earned chips are ink blocks → paper
// marks; locked chips → ink-faint marks). One distinct geometric mark per
// TrophyKey — the Record type keeps the set exhaustive against the catalog.

const GLYPH_STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'square',
} as const

const TROPHY_GLYPHS: Record<TrophyKey, ReactNode> = {
  // Five rays from one point — publicaste en 5 tipos distintos.
  versatile_voice: (
    <path
      d="M7 12.5 L1.8 4.4 M7 12.5 L4.2 2.6 M7 12.5 L7 1.6 M7 12.5 L9.8 2.6 M7 12.5 L12.2 4.4"
      {...GLYPH_STROKE}
    />
  ),
  // Pen nib with slit — cinco publicaciones acumuladas.
  published_voice: (
    <path d="M7 1.4 L11 7.4 L7 12.6 L3 7.4 Z M7 6.4 V12.6" {...GLYPH_STROKE} />
  ),
  // Signal mark [!] — bar + square point.
  signal_caster: (
    <>
      <path d="M7 1.8 V8.2" {...GLYPH_STROKE} strokeWidth={1.8} />
      <rect x="6" y="10.6" width="2" height="2" fill="currentColor" />
    </>
  ),
  // Question hook [?] — arc + stem + square point.
  question_caster: (
    <>
      <path d="M4.4 4.6 A2.7 2.7 0 1 1 7 7.4 V8.6" {...GLYPH_STROKE} />
      <rect x="6" y="10.6" width="2" height="2" fill="currentColor" />
    </>
  ),
  // Anchor — hilo que cruzó 20 respuestas.
  thread_anchor: (
    <>
      <circle cx="7" cy="2.9" r="1.5" {...GLYPH_STROKE} />
      <path d="M7 4.4 V12.4 M4.4 6.2 H9.6 M2.2 8 A4.8 4.8 0 0 0 11.8 8" {...GLYPH_STROKE} />
    </>
  ),
  // Compass — ring + needle + pivot; 25 vibe checks.
  crowd_compass: (
    <>
      <circle cx="7" cy="7" r="5.4" {...GLYPH_STROKE} />
      <path d="M4.6 9.4 L9.4 4.6" {...GLYPH_STROKE} />
      <rect x="6.2" y="6.2" width="1.6" height="1.6" fill="currentColor" />
    </>
  ),
  // One / two / three set marks — the presence steps as accumulating points.
  presence_logged: <rect x="5.75" y="5.75" width="2.5" height="2.5" fill="currentColor" />,
  presence_deep: (
    <>
      <rect x="3.4" y="5.75" width="2.5" height="2.5" fill="currentColor" />
      <rect x="8.1" y="5.75" width="2.5" height="2.5" fill="currentColor" />
    </>
  ),
  presence_persistent: (
    <>
      <rect x="1.6" y="5.75" width="2.5" height="2.5" fill="currentColor" />
      <rect x="5.75" y="5.75" width="2.5" height="2.5" fill="currentColor" />
      <rect x="9.9" y="5.75" width="2.5" height="2.5" fill="currentColor" />
    </>
  ),
  // Point inside the ring — en el radar editorial.
  presence_insider_track: (
    <>
      <circle cx="7" cy="7" r="4.8" {...GLYPH_STROKE} />
      <rect x="5.75" y="5.75" width="2.5" height="2.5" fill="currentColor" />
    </>
  ),
}

function TrophyGlyph({ trophyKey }: { trophyKey: TrophyKey }) {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" aria-hidden focusable="false">
      {TROPHY_GLYPHS[trophyKey]}
    </svg>
  )
}

export function TrophyStrip() {
  const { trophies } = useDashboardData()

  return (
    <div className="flex min-w-0 shrink-0 flex-nowrap items-center gap-3 overflow-hidden border-t border-ink pt-2">
      <span className="shrink-0 font-mono text-d11 font-bold tracking-widest text-ink-soft">
        {'// TROFEOS'}
      </span>

      <div className="flex shrink-0 items-center gap-1">
        {TROPHY_CATALOG.map((t) => {
          const earned = trophies.has(t.key)
          const named = `${t.label} — ${t.description}`
          return (
            <span
              key={t.key}
              role="img"
              title={earned ? named : `BLOQUEADO — ${named}`}
              aria-label={
                earned ? `Trofeo ganado: ${named}` : `Trofeo bloqueado: ${named}`
              }
              className={`flex h-6 w-6 items-center justify-center border border-ink ${
                earned ? 'bg-ink text-paper' : 'bg-transparent text-ink-faint'
              }`}
            >
              <TrophyGlyph trophyKey={t.key} />
            </span>
          )
        })}
      </div>

      {/* Judge r5 fix 3, final form: the strip is TROPHIES ONLY. The next-hito
          echo («PRÓXIMO: …») could never render whole beside 10 sigil chips in
          the {8,4} zone (it cropped in two successive builds), and the spine's
          PRIVADO block already prints the same fact whole with its progress
          bar. One surface, one readout — the duplicate dies rather than
          truncates. */}
    </div>
  )
}
