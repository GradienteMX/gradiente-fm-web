/**
 * Sigils as geometry — one definition for SVG (the expediente) and canvas
 * (the card's printed/embossed face), so a pin on the card and its cell in
 * the trophy grid are the same mark.
 *
 * Trophy sigils translate the catalog's glyphs (◈ ✎ ! ? ⚓ ⊕ · ·· ··· ◉)
 * into the V2 pictogram family: circle-and-line geometry on a 20-unit grid,
 * 1.5 stroke — never a font fallback that changes per platform.
 */

import type { UserRank } from '@/lib/types'
import type { TrophyKey } from '@/lib/trophies'

export interface SigilPart {
  d: string
  fill?: boolean
}

const circ = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`

export const TROPHY_SIGIL: Record<TrophyKey, SigilPart[]> = {
  // ◈ five formats: a facet inside a facet
  versatile_voice: [{ d: 'M10 2.6 17.4 10 10 17.4 2.6 10Z' }, { d: 'M10 7 13 10 10 13 7 10Z', fill: true }],
  // ✎ the pen in motion
  published_voice: [{ d: 'M4 16l.9-3.6L13 4.3a1.9 1.9 0 0 1 2.7 2.7L7.6 15.1z' }, { d: 'M11.6 5.7l2.7 2.7' }],
  // ! the signal reaction
  signal_caster: [{ d: 'M10 3.6v8.2' }, { d: circ(10, 15.8, 1.35), fill: true }],
  // ? the question reaction
  question_caster: [{ d: 'M6.8 7.2a3.3 3.3 0 1 1 4.9 2.9c-1.1.6-1.7 1.3-1.7 2.5v.3' }, { d: circ(10, 16, 1.35), fill: true }],
  // ⚓ a thread that holds
  thread_anchor: [{ d: circ(10, 4.4, 1.9) }, { d: 'M10 6.4v10.6M6.6 9.2h6.8' }, { d: 'M3.8 12.4a6.2 6.2 0 0 0 12.4 0' }],
  // ⊕ the crowd's compass
  crowd_compass: [{ d: circ(10, 10, 6.8) }, { d: 'M10 3.2v13.6M3.2 10h13.6' }],
  // · ·· ··· presence, a state of being in three steps
  presence_logged: [{ d: circ(10, 10, 1.9), fill: true }],
  presence_deep: [{ d: circ(6.9, 10, 1.8), fill: true }, { d: circ(13.1, 10, 1.8), fill: true }],
  presence_persistent: [
    { d: circ(4.4, 10, 1.7), fill: true },
    { d: circ(10, 10, 1.7), fill: true },
    { d: circ(15.6, 10, 1.7), fill: true },
  ],
  // ◉ on the editorial radar
  presence_insider_track: [{ d: circ(10, 10, 6.8) }, { d: circ(10, 10, 3), fill: true }],
}

/** Same geometry as kit `RankSigil`, as parts. */
export const RANK_SIGIL: Record<UserRank, SigilPart[]> = {
  normie: [{ d: circ(10, 10, 6) }],
  detonador: [{ d: 'M10 2.5v4M10 13.5v4M2.5 10h4M13.5 10h4M4.7 4.7l2.8 2.8M12.5 12.5l2.8 2.8M15.3 4.7l-2.8 2.8M7.5 12.5l-2.8 2.8' }],
  enigma: [{ d: 'M10 10.2a1.4 1.4 0 1 1 1.4-1.4 3 3 0 0 1-3 3 4.4 4.4 0 0 1-4.4-4.4A5.8 5.8 0 0 1 9.8 1.6a7.2 7.2 0 0 1 7.2 7.2' }],
  espectro: [{ d: circ(10, 10, 7) }, { d: 'M3.2 10c1.2-2.6 2.4-2.6 3.4 0s2.2 2.6 3.4 0 2.2-2.6 3.4 0 2.2 2.6 3.4 0' }],
}

/** The Rueda as a mark: thirty spokes, an empty hub. */
export function ruedaPath(spokes = 30, inner = 3.2, outer = 9.6): string {
  let d = ''
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2 - Math.PI / 2
    const c = Math.cos(a)
    const s = Math.sin(a)
    d += `M${(10 + c * inner).toFixed(3)} ${(10 + s * inner).toFixed(3)}L${(10 + c * outer).toFixed(3)} ${(10 + s * outer).toFixed(3)}`
  }
  return d
}

export function Sigil({ parts, size = 20, className, title, strokeWidth = 1.5 }: { parts: SigilPart[]; size?: number; className?: string; title?: string; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      {parts.map((p, i) => (p.fill ? <path key={i} d={p.d} fill="currentColor" stroke="none" /> : <path key={i} d={p.d} />))}
    </svg>
  )
}

export function TrophySigil({ trophy, ...rest }: { trophy: TrophyKey; size?: number; className?: string; title?: string; strokeWidth?: number }) {
  return <Sigil parts={TROPHY_SIGIL[trophy] ?? TROPHY_SIGIL.presence_logged} {...rest} />
}

// ── canvas ──────────────────────────────────────────────────────────────────

const pathCache = new Map<string, Path2D>()
function p2d(d: string): Path2D {
  let p = pathCache.get(d)
  if (!p) {
    p = new Path2D(d)
    pathCache.set(d, p)
  }
  return p
}

/**
 * Draw sigil parts centered at (cx, cy) in the current transform, `size`
 * being the 20-unit box. `lw` is the stroke in 20-grid units.
 */
export function drawSigil(ctx: CanvasRenderingContext2D, parts: SigilPart[], cx: number, cy: number, size: number, style: string | CanvasGradient, lw = 1.5) {
  const k = size / 20
  ctx.save()
  ctx.translate(cx - size / 2, cy - size / 2)
  ctx.scale(k, k)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = lw
  ctx.strokeStyle = style
  ctx.fillStyle = style
  for (const part of parts) {
    const path = p2d(part.d)
    if (part.fill) ctx.fill(path)
    else ctx.stroke(path)
  }
  ctx.restore()
}
