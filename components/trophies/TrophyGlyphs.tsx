import type { ReactNode } from 'react'
import type { TrophyKey } from '@/lib/trophies'

// ── Canonical trophy pictographs (fase E) ───────────────────────────────────
//
// The ONE trophy iconography site-wide. Born inside the CULTIVAR TrophyStrip
// (judge FIX-B 3), extracted here so the dashboard strip and the public
// expediente (/u/[username] TrophyGrid) draw from the same set — the ASCII
// sigils stay in lib/trophies.ts as data but no longer render as chrome.
//
// 14×14 viewBox, currentColor only (earned chips are ink blocks → paper
// marks; locked chips → ink-faint marks). One distinct geometric mark per
// TrophyKey — the Record type keeps the set exhaustive against the catalog.

const GLYPH_STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'square',
} as const

export const TROPHY_GLYPHS: Record<TrophyKey, ReactNode> = {
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

// Convenience renderer — `size` scales the square SVG while the 14×14
// viewBox keeps stroke geometry identical across surfaces (14 = strip chip,
// larger on the expediente cells). Decorative by contract: the surrounding
// chip/cell carries the accessible name.
export function TrophyGlyph({ trophyKey, size = 14 }: { trophyKey: TrophyKey; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden focusable="false">
      {TROPHY_GLYPHS[trophyKey]}
    </svg>
  )
}
