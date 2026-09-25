/**
 * Indexical codes for the Territorio (TRAMA grammar): two-letter format
 * codes, the format plates (flat pastel tokens), and energy written as a
 * code — "04–07 · FRESH → HOT". Codes are catalog facts, never rankings.
 */

import type { ContentType } from '@/lib/types'
import { VIBE_NAMES } from '@/lib/vibe'

export type LayerKey = ContentType | 'mercado'

export const CODE: Record<LayerKey, string> = {
  evento: 'EV',
  mix: 'MX',
  review: 'RS',
  editorial: 'ED',
  articulo: 'AR',
  listicle: 'LS',
  noticia: 'NT',
  opinion: 'OP',
  franja: 'FR',
  mercado: 'MK',
}

/** Format plates are tokens; formats never take hue on the land itself. */
export const PLATE: Record<LayerKey, string> = {
  evento: 'var(--p-evento)',
  mix: 'var(--p-mix)',
  review: 'var(--p-review)',
  editorial: 'var(--p-texto)',
  articulo: 'var(--p-texto)',
  opinion: 'var(--p-texto)',
  listicle: 'var(--p-lista)',
  noticia: 'var(--p-noticia)',
  franja: 'var(--p-franja)',
  mercado: 'var(--p-franja)',
}

const two = (n: number) => String(Math.round(n)).padStart(2, '0')

/** "05 · GROOVE" or "04–07 · FRESH → HOT". */
export function energyCode(min: number, max: number): string {
  const a = Math.round(min)
  const b = Math.round(max)
  if (a === b) return `${two(a)} · ${VIBE_NAMES[a]}`
  return `${two(a)}–${two(b)} · ${VIBE_NAMES[a]} → ${VIBE_NAMES[b]}`
}

/** The token for an energy step. */
export function eVar(e: number): string {
  return `var(--e${Math.max(0, Math.min(10, Math.round(e)))})`
}

/** Type on an energy ground: paper on the two coldest steps, ink elsewhere. */
export function onE(e: number): string {
  return Math.round(e) <= 1 ? 'var(--paper)' : 'var(--ink)'
}

/** A stepped band as printed: hard stops between the integer steps. */
export function bandSteps(min: number, max: number): string {
  const a = Math.round(min)
  const b = Math.round(max)
  if (a >= b) return eVar(a)
  const n = b - a + 1
  const stops: string[] = []
  for (let k = 0; k < n; k++) {
    const from = ((k / n) * 100).toFixed(2)
    const to = (((k + 1) / n) * 100).toFixed(2)
    stops.push(`${eVar(a + k)} ${from}% ${to}%`)
  }
  return `linear-gradient(90deg, ${stops.join(', ')})`
}
