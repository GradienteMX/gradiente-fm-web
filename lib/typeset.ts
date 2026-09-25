/**
 * Display typesetting for energy titles.
 *
 * Titles are set at their piece's energy — glacial titles are very wide.
 * A fixed font-size would break long Spanish words mid-letter, so the size
 * is derived from the widest word: it must fit the container's inline size
 * (`cqi`) at that energy's width and weight. Pure CSS at runtime, no measuring.
 */

import { energyFont } from './vibe'

/** Approximate advances for Anybody at wdth 100, wght 400, in em. */
function advance(ch: string): number {
  if (/[iljtfIJ.,:;'!|¡]/.test(ch)) return 0.34
  if (/[mwMW@]/.test(ch)) return 0.86
  if (/[A-ZÁÉÍÓÚÑÜ]/.test(ch)) return 0.7
  if (/[0-9]/.test(ch)) return 0.6
  if (/[a-záéíóúñü]/.test(ch)) return 0.6
  return 0.5
}

/** Width of a word in em at wdth 100 / wght 400. */
function wordEm(word: string): number {
  let w = 0
  for (const ch of word) w += advance(ch)
  return w
}

export function longestWord(text: string): number {
  return text.split(/[\s/—–-]+/).reduce((m, w) => Math.max(m, w.length), 0)
}

/** The widest word's width in em (at the base axes). */
export function widestWordEm(text: string): number {
  return text.split(/[\s/—–-]+/).reduce((m, w) => Math.max(m, wordEm(w)), 0)
}

/**
 * CSS font-size that keeps the widest word within `share` of the
 * container's inline size, clamped to [minPx, maxPx]. Heavy weights run
 * markedly wider (black is ~30 % wider than regular in Anybody).
 */
export function fitTitle(text: string, energy: number, maxPx: number, minPx = 14, share = 0.96): string {
  const { wdth, wght } = energyFont(energy)
  const em = Math.max(2.2, widestWordEm(text)) * (wdth / 100) * (1 + Math.max(0, wght - 400) / 1700)
  const cqi = (share * 100) / em
  return `clamp(${minPx}px, ${cqi.toFixed(2)}cqi, ${maxPx}px)`
}
