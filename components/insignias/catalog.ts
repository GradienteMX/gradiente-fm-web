/**
 * INSIGNIAS — what each pin is struck in.
 *
 * Plating follows the family (docs/06-LIBREA §5), and each metal was chosen
 * for what the family records:
 *
 *   craft      GOLD         you made things — the metal of the hand's work
 *   reception  NICKEL       others answered — a bright mirror: what you put
 *                           out comes back
 *   community  BLACK NICKEL you sparked something — the shield of the
 *                           underground collective, dark and hard
 *   presence   COPPER       sustained presence — the metal that deepens with
 *                           time (it takes patina; presence accrues)
 *
 * Enamel: the field is always the trophy's catalog colour (the contract in
 * lib/seed/trophies). A second, neutral enamel fills the band between the
 * border and the inner line — ink on the bright metals, paper on black
 * nickel — so every pin reads in the house's two inks.
 *
 * Two fills are special, because two trophies are the rarest stories:
 *
 *   presence_insider_track  GLITTER — the top of the presence ladder; metal
 *                           flakes in orange resin, each at its own angle,
 *                           twinkling one by one as the pin turns.
 *   thread_anchor           NACRE (pearlescent) — the anchor lives in the
 *                           sea, and nacre is how the sea builds: layer over
 *                           layer around one grain, the way a thread grows
 *                           reply over reply around its first post. Chosen
 *                           over glow-in-the-dark because phosphorescence
 *                           only speaks in the dark and the tray is always
 *                           lit; nacre speaks exactly when you tilt it.
 */

import type { TrophyKey, TrophyMeta } from '@/lib/trophies'
import type { Family } from './shapes'

export type Metal = 'oro' | 'niquel' | 'niquel-negro' | 'cobre'
export type Fill = 'esmalte' | 'glitter' | 'nacar'

export interface MetalSpec {
  /** Specular colour (F0) as sRGB — metals have no diffuse. */
  color: string
  /** Polished raised lines. */
  polish: number
  /** The struck edge and the clutch. */
  edge: number
  /** Word for assistive text. */
  name: string
}

export const METAL: Record<Metal, MetalSpec> = {
  oro: { color: '#ffd98a', polish: 0.12, edge: 0.2, name: 'oro' },
  niquel: { color: '#e2e3e0', polish: 0.1, edge: 0.18, name: 'níquel' },
  'niquel-negro': { color: '#5a5b61', polish: 0.09, edge: 0.16, name: 'níquel negro' },
  cobre: { color: '#f4b69b', polish: 0.13, edge: 0.22, name: 'cobre' },
}

export const FAMILY_METAL: Record<Family, Metal> = {
  craft: 'oro',
  reception: 'niquel',
  community: 'niquel-negro',
  presence: 'cobre',
}

/** The neutral band enamel: ink on bright metal, paper on black nickel. */
export const FAMILY_BAND: Record<Family, string> = {
  craft: '#15130f',
  reception: '#15130f',
  community: '#ece8dc',
  presence: '#15130f',
}

export const FILL: Partial<Record<TrophyKey, Fill>> = {
  presence_insider_track: 'glitter',
  thread_anchor: 'nacar',
}

export const FILL_NAME: Record<Fill, string> = {
  esmalte: 'esmalte duro',
  glitter: 'esmalte con brillantina',
  nacar: 'esmalte nacarado',
}

export function fillOf(key: TrophyKey): Fill {
  return FILL[key] ?? 'esmalte'
}

/** «Pin de oro, esmalte con brillantina» — the object in words. */
export function materialWords(t: Pick<TrophyMeta, 'key' | 'family'>): string {
  return `${METAL[FAMILY_METAL[t.family]].name}, ${FILL_NAME[fillOf(t.key)]}`
}

/** «TR·01» — a pin's place in the case (catalog order, never a rank). */
export function slotCode(i: number): string {
  return `TR·${String(i + 1).padStart(2, '0')}`
}
