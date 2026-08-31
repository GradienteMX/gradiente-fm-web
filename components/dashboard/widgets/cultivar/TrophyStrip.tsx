'use client'

// ── CULTIVAR trophy strip (FINAL_SPEC §3.1 + judge FIX-B 3) ─────────────────
//
// Earned trophies inline at 0 clicks — real keys from the provider's
// `trophies` slice against TROPHY_CATALOG, each drawn as a designed 14px
// inline-SVG pictograph (the canonical set — extracted to
// components/trophies/TrophyGlyphs in fase E so the public expediente
// renders the same iconography).
// Every glyph chip carries title + aria-label naming the trophy AND its
// unlock condition; chips have no click action, so they render as spans
// (role="img"), never buttons. Locked trophies = ink-faint outlines with the
// NAMED condition — no counters, no «próximamente».
//
// Beneath: one hairline progress bar toward the next presence trophy —
// words + a rule, zero numerals, zero donuts (the identity spine is the only
// place the raw scalar renders). The strip is a single 24px row (border-t 1
// + pt-2 8 + h-6 24 = 33px — part of Zone C's exact h3 budget).

import { useDashboardData } from '@/components/dashboard/DashboardDataProvider'
import { TROPHY_CATALOG } from '@/lib/trophies'
import { TrophyGlyph } from '@/components/trophies/TrophyGlyphs'

export function TrophyStrip() {
  const { trophies } = useDashboardData()

  return (
    <div className="flex min-w-0 shrink-0 flex-nowrap items-center gap-3 overflow-hidden border-t border-ink pt-2">
      <span className="shrink-0 font-mono text-d11 font-bold tracking-widest text-ink-soft">
        TROFEOS
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
