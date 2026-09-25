/**
 * The energy axis — 0 GLACIAL → 10 VOLCÁN.
 *
 * One module owns every derived representation of energy: names, the OKLCH
 * spectrum (as CSS strings and as linear/sRGB triples for GLSL), the energy
 * typography (Anybody wdth/wght), the effective band (author vs crowd), and
 * the filter predicate. Hue is reserved for energy across the whole UI.
 */

export const VIBE_NAMES = [
  'GLACIAL',
  'POLAR',
  'CHILL',
  'COOL',
  'FRESH',
  'GROOVE',
  'WARM',
  'HOT',
  'FUEGO',
  'BRASA',
  'VOLCÁN',
] as const

export type VibeName = (typeof VIBE_NAMES)[number]

/** What each slot sounds like — used in tooltips and the Horizonte legend. */
export const VIBE_FEEL: readonly string[] = [
  'ambient · hielo · drone',
  'lo-fi · downtempo',
  'house orgánico · dub · ambient techno',
  'deep house · minimal · jazz · neo soul',
  'house · electronica · techno melódico · nu disco',
  'tech house · electro · IDM · electrónica latina',
  'techno crudo · progressive · afro house · breaks',
  'techno de pico · D&B · UKG · bass',
  'hard techno · dark · jungle · footwork',
  'industrial · noise · deconstruido',
  'psy-trance · hyperpop · gqom',
]

/**
 * The real Gradiente thermal ramp (espectro-fm-web lib/utils.ts
 * VIBE_SLOT_COLORS — keep in lockstep with app/globals.css --e0…--e10).
 * Two hue arms, glacial cyan and ember orange, hinged through a near-neutral
 * "estática" grey at GROOVE, with monotonic lightness: dim is cold, bright is
 * hot. It never transits green, purple or magenta. OKLCH anchors:
 *   0 (0.515 0.089 215) · 1 (0.545 0.092 224) · 2 (0.575 0.075 233)
 *   3 (0.605 0.055 243) · 4 (0.628 0.034 253) · 5 (0.648 0.014 75)
 *   6 (0.668 0.085 32)  · 7 (0.684 0.140 38)  · 8 (0.700 0.196 45)
 *   9 (0.760 0.171 62)  · 10 (0.815 0.163 76)
 */
export const SPECTRUM_HEX: readonly string[] = [
  '#087487',
  '#217b98',
  '#48819e',
  '#6586a0',
  '#7a8a9d',
  '#948e85',
  '#c38174',
  '#e17756',
  '#fc6c0f',
  '#fc9414',
  '#feb225',
]

type RGB = [number, number, number]

const unhex = (h: string): RGB => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]
const degamma = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))

/** Gamma-encoded sRGB per stop, 0–1. */
export const SPECTRUM_SRGB: readonly RGB[] = SPECTRUM_HEX.map(unhex)

/** Linear-light RGB per stop (what lit shaders want). */
export const SPECTRUM_LINEAR: readonly RGB[] = SPECTRUM_SRGB.map((c) => c.map(degamma) as RGB)

const hex2 = (v: number) =>
  Math.round(v * 255)
    .toString(16)
    .padStart(2, '0')

/** The printed slot for an energy — the ramp is stepped, like ink swatches. */
export function energySlotHex(e: number): string {
  return SPECTRUM_HEX[Math.round(clampEnergy(e))]
}

/** Text colour that reads on an energy ground: paper on the two darkest slots, ink elsewhere. */
export function energyOn(e: number): string {
  return clampEnergy(e) < 1.5 ? '#edebe3' : '#111111'
}

/** Continuous color at any energy (0–10), interpolated in OKLab-ish via stops. */
export function energyRGB(e: number): RGB {
  const x = clampEnergy(e)
  const i = Math.min(9, Math.floor(x))
  const t = x - i
  const a = SPECTRUM_SRGB[i]
  const b = SPECTRUM_SRGB[i + 1]
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

export function energyHex(e: number): string {
  const [r, g, b] = energyRGB(e)
  return `#${hex2(r)}${hex2(g)}${hex2(b)}`
}

export function energyRGBA(e: number, alpha: number): string {
  const [r, g, b] = energyRGB(e)
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha})`
}

/** CSS linear-gradient across a band — the energy line under every piece. */
export function bandGradient(min: number, max: number, dir = 'to right'): string {
  if (max - min < 0.001) return energyHex(min)
  const steps = Math.max(2, Math.ceil((max - min) * 2) + 1)
  const stops: string[] = []
  for (let k = 0; k < steps; k++) {
    const e = min + ((max - min) * k) / (steps - 1)
    stops.push(`${energyHex(e)} ${((k / (steps - 1)) * 100).toFixed(1)}%`)
  }
  return `linear-gradient(${dir}, ${stops.join(', ')})`
}

/** The full spectrum as a CSS gradient (Horizonte track, legends). */
export const SPECTRUM_GRADIENT = bandGradient(0, 10)

/**
 * A band printed as swatches: one hard-edged block per slot it covers —
 * how the ramp appears on paper (chips, energy rules, legends).
 */
export function bandSteps(min: number, max: number, dir = 'to right'): string {
  const a = Math.round(clampEnergy(min))
  const b = Math.round(clampEnergy(max))
  if (a === b) return SPECTRUM_HEX[a]
  const n = b - a + 1
  const stops: string[] = []
  for (let k = 0; k < n; k++) {
    const from = ((k / n) * 100).toFixed(2)
    const to = (((k + 1) / n) * 100).toFixed(2)
    stops.push(`${SPECTRUM_HEX[a + k]} ${from}% ${to}%`)
  }
  return `linear-gradient(${dir}, ${stops.join(', ')})`
}

/** The whole ramp as eleven swatches. */
export const SPECTRUM_STEPS = bandSteps(0, 10)

// ── Energy typography ───────────────────────────────────────────────────────

/**
 * Anybody variable axes for a given energy. Glacial is wide and even;
 * volcán is compressed and black. Printed type stays assertive at both ends
 * (never hairline): the width carries the temperature.
 */
export function energyFont(e: number): { wdth: number; wght: number } {
  const x = clampEnergy(e) / 10
  return {
    wdth: Math.round(148 - x * 88), // 148 → 60
    wght: Math.round(430 + x * 470), // 430 → 900
  }
}

/** `font-variation-settings` string for a given energy. */
export function energyVariation(e: number): string {
  const { wdth, wght } = energyFont(e)
  return `"wdth" ${wdth}, "wght" ${wght}`
}

// ── Bands ───────────────────────────────────────────────────────────────────

export type VibeRange = [number, number]

export const FULL_RANGE: VibeRange = [0, 10]

export function clampEnergy(e: number): number {
  return Math.min(10, Math.max(0, e))
}

export function vibeName(e: number): VibeName {
  return VIBE_NAMES[Math.round(clampEnergy(e))]
}

export function bandLabel(min: number, max: number): string {
  const a = vibeName(min)
  const b = vibeName(max)
  return a === b ? a : `${a} → ${b}`
}

export function bandMid(min: number, max: number): number {
  return (min + max) / 2
}

/** The crowd takes over from the author at this many readings. */
export const VIBE_CHECK_THRESHOLD = 5

export interface BandSource {
  vibeMin: number
  vibeMax: number
  vibeCheckCount?: number
  vibeCheckMedianMin?: number
  vibeCheckMedianMax?: number
}

/** Author band until the crowd reaches the threshold, then the crowd median. */
export function effectiveBand(item: BandSource): { min: number; max: number; source: 'autor' | 'comunidad' } {
  if (
    (item.vibeCheckCount ?? 0) >= VIBE_CHECK_THRESHOLD &&
    item.vibeCheckMedianMin !== undefined &&
    item.vibeCheckMedianMax !== undefined
  ) {
    return { min: item.vibeCheckMedianMin, max: item.vibeCheckMedianMax, source: 'comunidad' }
  }
  return { min: item.vibeMin, max: item.vibeMax, source: 'autor' }
}

/** A piece passes when its effective band overlaps the selected range. */
export function bandOverlaps(item: BandSource, range: VibeRange): boolean {
  const { min, max } = effectiveBand(item)
  return max >= range[0] && min <= range[1]
}

export function isFullRange(range: VibeRange): boolean {
  return range[0] <= 0.0001 && range[1] >= 9.9999
}

/** Median of a list of integers (used by the local calibration store). */
export function median(values: number[]): number {
  if (values.length === 0) return 0
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2)
}
