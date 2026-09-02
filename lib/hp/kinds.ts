// ── HL interaction kinds — the one vocabulary ───────────────────────────────
//
// The four item-side interaction kinds and their nominal weights lived as a
// module-private const inside app/api/hp-events/route.ts, which made them
// unreadable from any UI. The admin per-kind breakdown needs them, so they are
// lifted here. The ROUTE still stamps the weight server-side — this module is
// the source it stamps from, not a second copy.
//
// NO TAILWIND CLASS STRINGS IN THIS FILE. tailwind.config.ts content globs are
// ['./pages/**','./components/**','./app/**','./context/**'] — lib/ is NOT
// scanned, so any class name parked here is purged from the build and fails
// silently at runtime. Colours ship as hex and are applied via style props,
// the same contract lib/dashboard/palette.ts already follows.

/** The four gestures a reader can make that grant HL to an item. */
export type HpEventKind = 'click' | 'open' | 'save' | 'comment'

/**
 * The two ledger kinds no reader can produce. Both are written already stamped
 * `processed_at`, so the rollup never folds them a second time.
 *
 *   admin_adjust — written by admin_adjust_item_hp() (0049 §5). Exists so
 *                  injected HL shows as its own band instead of quietly
 *                  blending into organic reach.
 *   decay        — written by apply_hp_rollup() (0049 §3) for each item it
 *                  re-anchors, carrying the NEGATIVE amount that tick's decay
 *                  removed. Historical decay is not reconstructible from
 *                  anchors after the fact, so recording it forward is the only
 *                  honest way to draw a net line.
 */
export type HpSystemKind = 'admin_adjust' | 'decay'

export type HpLedgerKind = HpEventKind | HpSystemKind

/**
 * Nominal weight per gesture, tuned 2026-06-02 via scripts/hpSim.mjs.
 * Roughly proportional to commitment: a click is a glance, a save is a
 * decision. Spawn HP is 20 (50 editorial) for scale.
 *
 * ⚠ These are the BASE weights. What actually lands in hp_events.weight is
 * base × a per-caller novelty multiplier m ∈ [0.6, 1.5] (migration 0025), so
 * `sum(weight) / KIND_WEIGHTS[kind]` is NOT the event count and can be wrong
 * by up to ±50%. Count events with hp_events.base_weight; sum HL with
 * hp_events.weight. The multiplier itself stays under the hood.
 */
export const KIND_WEIGHTS: Record<HpEventKind, number> = {
  click: 0.5,
  open: 1.5,
  save: 4,
  comment: 3,
}

export const HP_EVENT_KINDS = Object.keys(KIND_WEIGHTS) as HpEventKind[]

export function isHpEventKind(value: unknown): value is HpEventKind {
  return typeof value === 'string' && value in KIND_WEIGHTS
}

/** Display labels. Spanish, mono-uppercase register, same as every other chip. */
export const KIND_LABELS: Record<HpLedgerKind, string> = {
  click: 'CLIC',
  open: 'APERTURA',
  save: 'GUARDADO',
  comment: 'COMENTARIO',
  admin_adjust: 'AJUSTE ADMIN',
  decay: 'DECAIMIENTO',
}

/**
 * Two-letter codes. Same non-colour redundancy channel the content types use
 * (lib/dashboard/palette.ts TYPE_CODES): hue is never the only signal, so
 * every swatch travels with its code. It is what keeps GUARDADO (#9A3412) and
 * AJUSTE ADMIN (#8A5300) — two browns — apart at a glance.
 */
export const KIND_CODES: Record<HpLedgerKind, string> = {
  click: 'CL',
  open: 'AP',
  save: 'GU',
  comment: 'CO',
  admin_adjust: 'AJ',
  decay: 'DE',
}

/**
 * Swatch hues. All six measure ≥4.5:1 as text on BOTH paper grounds
 * (#EDEBE3 and #F6F4EC) — pinned by tests/dashboard/contrast.test.ts.
 * Deliberately disjoint from CATEGORY_ON_LIGHT: a CONTENIDO row shows a
 * content-type swatch and a kind breakdown side by side, and two palettes
 * that alias would make the row unreadable.
 *
 * The four reader kinds are one family and share one legend. The two system
 * kinds never appear in that legend — decay is chart-only, admin_adjust is a
 * separate stated line under the item's breakdown — precisely so an injection
 * can never be read as a fifth flavour of engagement.
 */
export const KIND_ON_LIGHT: Record<HpLedgerKind, string> = {
  click: '#57534E',
  open: '#0E6E62',
  save: '#9A3412',
  comment: '#5B21B6',
  admin_adjust: '#8A5300',
  decay: '#C42B20',
}

/** True for the kinds a reader produced. The breakdown table shows only these. */
export function isReaderKind(kind: string): kind is HpEventKind {
  return kind in KIND_WEIGHTS
}

/**
 * The three FLUJO DE VIDA series. Ink for the net line (it is the subject),
 * HP blue for the creator-side series (the reserved Human-Presence register),
 * sys-red for decay (the only series that is always a loss).
 */
export const SERIES_ON_LIGHT = {
  hlNeto: '#111111',
  hpCreadores: '#1D4ED8',
  decaimiento: '#C42B20',
} as const

export type SeriesKey = keyof typeof SERIES_ON_LIGHT

export const SERIES_LABELS: Record<SeriesKey, string> = {
  hlNeto: 'HL NETO',
  hpCreadores: 'HP CREADORES',
  decaimiento: 'DECAIMIENTO',
}

/**
 * The date the item-side ledger began. Before migration 0049 apply_hp_rollup
 * DELETED every hp_events row it folded, so no per-kind history exists prior
 * to this — roughly 2,110 events were destroyed and are unrecoverable.
 *
 * Every admin surface that charts item HL over time MUST clamp its window to
 * this date and say so. An empty stretch of chart left of it would read as
 * "nobody interacted", which is the opposite of the truth.
 *
 * Set to the day the migration is applied in production. Until then the UI
 * treats the whole ledger as pre-history and prints the «SIN HISTORIAL» note.
 */
export const LEDGER_EPOCH = '2026-09-02'

/** True when `iso` predates the ledger and no per-kind data can exist for it. */
export function isBeforeLedger(iso: string): boolean {
  return iso < LEDGER_EPOCH
}
