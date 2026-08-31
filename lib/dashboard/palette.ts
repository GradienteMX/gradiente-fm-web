// «EL PLIEGO» light-surface palette — the dashboard's programmatic color
// source (canvas 2D, SVG schematic, WebGL, style props). JSX class styling
// uses the matching tailwind.config.ts tokens; the hexes here are the same
// values — change in lockstep.
//
// categoryColorOnLight() is the on-cream counterpart of lib/utils.ts
// categoryColor() (dark ground, untouched). One exported map so the planned
// articulo/editorial/opinion type merge only deletes rows here.

import type { ContentType } from '@/lib/types'

export const DASH_PAPER = '#EDEBE3'
export const DASH_PAPER_RAISED = '#F6F4EC'
export const DASH_INK = '#111111'
export const DASH_INK_SOFT = '#3D3A33'
export const DASH_INK_FAINT = '#5C5850'
export const DASH_ACID = '#D8FF00'
export const DASH_SYS_RED = '#C42B20'
// HP blue — Human Presence (revision-2 point 7): the identity spine's big HP
// block + the CULTIVAR scalar. ≥4.5:1 on both paper grounds (5.5:1 on paper).
export const DASH_HP_BLUE = '#1D4ED8'
export const DASH_PANEL = '#111111'
export const DASH_PANEL_TEXT = '#EDEBE3'

// Acid accent whitelist: acid is banned as text or border on paper grounds
// (1.2:1). These are the ONLY legal renderings; reviewers reject anything
// else in the dashboard tree.
export const ACID_LEGAL_USES = [
  'fill-block', // acid background block with ink text on top (≈13:1)
  'on-panel', // any acid graphic/text inside a black panel
  'dot-badge', // solid acid dot/badge ≥8px with a 1px ink outline, on paper
] as const
export type AcidLegalUse = (typeof ACID_LEGAL_USES)[number]

// Category colors on cream — every value measures ≥4.5:1 on BOTH paper and
// paper-raised as text (verified by tests/dashboard/contrast.test.ts).
// Four spec values landed a hair under 4.5:1 on paper when measured and were
// darkened one step per the spec's own failure rule (original in comment).
export const CATEGORY_ON_LIGHT: Record<ContentType, string> = {
  evento: '#B3261C',
  mix: '#155E75', // spec #0E7490 measured 4.49:1 — darkened
  review: '#7A510A', // spec #92610A measured 4.47:1 — darkened
  editorial: '#3F6212', // spec #4D7C0F measured 4.18:1 — darkened
  opinion: '#6D28D9',
  articulo: '#705207', // spec #8A6508 measured 4.46:1 — darkened
  noticia: DASH_INK_SOFT,
  listicle: '#A81A5B',
  franja: '#4B5563',
}

export function categoryColorOnLight(type: ContentType): string {
  return CATEGORY_ON_LIGHT[type]
}

// ── Type language (canonical Spanish display labels) ────────────────────────
// ONE chip vocabulary for the whole dashboard — mirrors CrearZone's
// COMPOSE_TYPE_LABELS exactly for the 8 composable types and completes the
// ContentType union (listicle → LISTA, franja → FRANJA). Never render a raw
// `item.type` enum in the UI; the planned articulo/editorial/opinion external
// merge only edits rows here.
export const TYPE_DISPLAY_LABELS: Record<ContentType, string> = {
  evento: 'EVENTO',
  mix: 'MIX',
  noticia: 'NOTICIA',
  review: 'RESEÑA',
  editorial: 'EDITORIAL',
  opinion: 'OPINIÓN',
  articulo: 'ARTÍCULO',
  listicle: 'LISTA',
  franja: 'FRANJA',
}

export function typeDisplayLabel(type: ContentType): string {
  return TYPE_DISPLAY_LABELS[type]
}

// 2-letter type codes — the non-color channel that rides beside every
// category swatch (review/articulo ambers alias; hue is never the sole
// signal). Mono, uppercase, paired 1:1 with the swatch.
export const TYPE_CODES: Record<ContentType, string> = {
  evento: 'EV',
  mix: 'MX',
  noticia: 'NO',
  review: 'RE',
  editorial: 'ED',
  opinion: 'OP',
  articulo: 'AR',
  listicle: 'LI',
  franja: 'PA',
}

export function typeCode(type: ContentType): string {
  return TYPE_CODES[type]
}

// ── Artwork scrim (bottom-seated ink gradient) ──────────────────────────────
// For text seated over card artwork on black-panel tiles: a bottom-anchored
// slab at ≥0.94 ink alpha with a 28px fade-out ramp on top. The consuming
// block MUST pad its top by the ramp height (pt-7 = 28px) so no glyph ever
// rides the ramp — measured worst case (panel-text #EDEBE3 over pure-white
// artwork at 0.94 alpha) is 13.8:1; over dark artwork it approaches the solid
// panel's 15.9:1. Both clear WCAG AA 4.5:1 with wide margin.
const PANEL_RGB = '17, 17, 17' // DASH_PANEL — change in lockstep
export const PANEL_SCRIM_RAMP_PX = 28
export const PANEL_SCRIM = `rgba(${PANEL_RGB}, 0.94)`
export const PANEL_SCRIM_GRADIENT = `linear-gradient(to top, ${PANEL_SCRIM} 0%, ${PANEL_SCRIM} calc(100% - ${PANEL_SCRIM_RAMP_PX}px), rgba(${PANEL_RGB}, 0) 100%)`
