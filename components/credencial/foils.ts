/**
 * Role foils — each role is a different KIND of foil, and its iridescence is
 * compressed into the role's hue band exactly the way the original
 * `glassCard.js` did it: the cosine rainbow `spectral(p)` is centred on the
 * phase closest to the role's colour (`rolePhaseFor`) and swings only
 * ±spread/2 around it (`hueBand` in GLSL). The lector keeps the whole
 * rainbow (spread 1).
 *
 * The card itself is now printed on its role's livery, which shares the
 * foil's hue family (curador violet on opinión violet, guía green on
 * editorial green, insider cyan on mix cyan). So the foils are stamped over
 * bare metal (silver, chrome, black for the admin — they read against the
 * matte board by gloss) and those three bands are wider: the iridescence
 * swings out of the stock's own hue instead of sinking into it.
 *
 * One difference, on purpose: the original matched the phase in *linear*
 * light because its shaders went through three's sRGB output; V2's card
 * shaders work in display space (no colorspace chunks), so the phase is
 * matched against the sRGB bytes — the colour you see is the role's colour.
 */

import type { Role } from '@/lib/types'

export type FoilKind = 'difraccion' | 'glitter' | 'lenticular' | 'hielo' | 'brasa'

export interface RoleFoil {
  kind: FoilKind
  /** The original ROLES colour. */
  color: string
  /** Width of the hue band on the cosine rainbow (1 = full spectrum). */
  spread: number
  /** Shader switch. */
  code: number
  /** What it is, in words (for the expediente / a11y). */
  name: string
}

export const ROLE_FOIL: Record<Role, RoleFoil> = {
  user: { kind: 'difraccion', color: '#d2a24f', spread: 1, code: 0, name: 'foil de difracción' },
  curator: { kind: 'glitter', color: '#c084fc', spread: 0.5, code: 1, name: 'foil de glitter' },
  guide: { kind: 'lenticular', color: '#4ade80', spread: 0.45, code: 2, name: 'foil lenticular' },
  insider: { kind: 'hielo', color: '#22d3ee', spread: 0.5, code: 3, name: 'foil de hielo quebrado' },
  admin: { kind: 'brasa', color: '#f97316', spread: 0.24, code: 4, name: 'foil de brasa' },
}

const TAU = Math.PI * 2

function hexRGB(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

/** The original's search: the phase of `spectral()` nearest to a colour. */
export function rolePhaseFor(hex: string): number {
  const [r, g, b] = hexRGB(hex)
  let best = 0
  let bestD = Infinity
  for (let i = 0; i < 512; i++) {
    const p = i / 512
    const sr = 0.52 + 0.48 * Math.cos(TAU * p)
    const sg = 0.52 + 0.48 * Math.cos(TAU * (p + 0.33))
    const sb = 0.52 + 0.48 * Math.cos(TAU * (p + 0.67))
    const d = (sr - r) ** 2 + (sg - g) ** 2 + (sb - b) ** 2
    if (d < bestD) {
      bestD = d
      best = p
    }
  }
  return best
}

const phases = new Map<string, number>()

/** Phase + spread + shader code for a role (phases memoized). */
export function foilFor(role: Role): { phase: number; spread: number; code: number; color: string } {
  const f = ROLE_FOIL[role] ?? ROLE_FOIL.user
  let phase = phases.get(f.color)
  if (phase === undefined) {
    phase = rolePhaseFor(f.color)
    phases.set(f.color, phase)
  }
  return { phase, spread: f.spread, code: f.code, color: f.color }
}
