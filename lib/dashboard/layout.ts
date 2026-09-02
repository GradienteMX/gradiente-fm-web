// «EL PLIEGO» — dashboard layout engine (FINAL_SPEC §2).
// Pure functions only: no React, no IO, no randomness. Same input → same
// output regardless of array order (ties break on widget id), so layouts are
// reproducible across boots, tabs, and devices.
//
// WIDGET ADMISSION RULE (§2.7, binding). A widget must:
//   (a) answer one distinct user question no other widget answers,
//   (b) contain the user's own true data or explicit choices,
//   (c) define an empty state and a «nuevo desde tu última visita»
//       derivation from the single lastSeen watermark.
// Failing any test → it becomes a facet of an existing widget, spine chrome,
// or is rejected. (Casualties: settings → masthead mode; messaging → mono
// footnote; saved mixes → a facet REPRODUCTOR consumes, GUARDADOS owns.)

// ── Registry ─────────────────────────────────────────────────────────────────

export type WidgetId =
  | 'crear'
  | 'cultivar'
  | 'actividad'
  | 'guardados'
  | 'reproductor'
  | 'novedades'
  | 'agenda'
  | 'mapa'
  | 'mercado'

export const ALL_WIDGET_IDS: readonly WidgetId[] = [
  'crear',
  'cultivar',
  'guardados',
  'mapa',
  'reproductor',
  'novedades',
  'agenda',
  'actividad',
  'mercado',
]

export function isWidgetId(value: unknown): value is WidgetId {
  return (
    typeof value === 'string' && (ALL_WIDGET_IDS as readonly string[]).includes(value)
  )
}

export type WidgetSize = { w: number; h: number }

type WidgetDef = {
  // Quantized size states (R4). First entry = the default/committed size;
  // edit-mode resize cycles through these and NOTHING else.
  allowedSizes: readonly WidgetSize[]
  // Widgets whose primary surface is unconditional (CULTIVAR's CREAR zone
  // exists for every permitted user) never collapse to the compact row.
  neverCompact?: boolean
}

// Revision-2 allowedSizes table (Iker 2026-08-22): every widget carries MORE
// resize states than the scale-pass build — the corner grip cycles through
// all of them, so "más opciones para hacer resize" is this table, not a new
// gesture. First entry = the committed default.
export const WIDGET_DEFS: Record<WidgetId, WidgetDef> = {
  // CREAR NUEVO — split out of CULTIVAR (revision-2 point 3): the acid block
  // is a whole widget now. Chips are law-visible, so it never compacts.
  crear: {
    allowedSizes: [
      { w: 4, h: 3 }, { w: 3, h: 3 }, { w: 4, h: 2 }, { w: 6, h: 2 }, { w: 12, h: 2 },
    ],
    neverCompact: true,
  },
  // CULTIVAR — the publications carousel (the garden retired, point 8).
  cultivar: {
    allowedSizes: [
      { w: 8, h: 3 }, { w: 12, h: 3 }, { w: 8, h: 4 }, { w: 12, h: 4 },
      { w: 6, h: 3 }, { w: 8, h: 2 },
    ],
  },
  actividad: {
    allowedSizes: [
      { w: 4, h: 3 }, { w: 4, h: 4 }, { w: 4, h: 2 }, { w: 6, h: 3 },
      { w: 6, h: 4 }, { w: 3, h: 3 },
    ],
  },
  guardados: {
    allowedSizes: [
      { w: 4, h: 3 }, { w: 7, h: 3 }, { w: 12, h: 3 }, { w: 4, h: 2 },
      { w: 7, h: 2 }, { w: 12, h: 2 },
    ],
  },
  reproductor: {
    allowedSizes: [
      { w: 4, h: 3 }, { w: 5, h: 3 }, { w: 6, h: 3 }, { w: 4, h: 2 }, { w: 5, h: 2 },
    ],
  },
  novedades: {
    allowedSizes: [
      { w: 4, h: 3 }, { w: 5, h: 3 }, { w: 6, h: 3 }, { w: 4, h: 2 }, { w: 5, h: 2 },
    ],
  },
  agenda: {
    allowedSizes: [
      { w: 4, h: 3 }, { w: 4, h: 4 }, { w: 6, h: 3 }, { w: 4, h: 2 }, { w: 6, h: 2 },
    ],
  },
  // MAPA — a static screenshot door to /mapa (point 15); center of row 2.
  mapa: {
    allowedSizes: [
      { w: 4, h: 3 }, { w: 3, h: 3 }, { w: 4, h: 2 }, { w: 6, h: 3 }, { w: 8, h: 4 },
    ],
  },
  // MERCADO — a DOOR into the ?espacio=mercado space (fase D). The old
  // {6,2}↔{12,2} self-resize depth state is retired: the storefront moved to
  // its own space, so reading an offer no longer rewrites the saved layout.
  // Default stays {6,2} so no existing layout shifts; the taller variants are
  // gone because a door has one row of content. Saved {6,3}/{12,3} entries
  // snap down through snapToAllowedSize — never a layout reset.
  mercado: {
    allowedSizes: [
      { w: 6, h: 2 }, { w: 4, h: 2 }, { w: 12, h: 2 }, { w: 3, h: 2 },
    ],
  },
}

// ── Grid constants (§2.1) ────────────────────────────────────────────────────

export const DESKTOP_COLS = 12
export const TABLET_COLS = 6
export const TABLET_MIN_W = 3
export const ROW_UNIT_PX = 96
export const GUTTER_DESKTOP_PX = 24
export const GUTTER_MOBILE_PX = 16
// Data-aware boot (§2.5): an empty widget renders as a single teaching row.
export const COMPACT_H = 1

// ── Schema (§2.4, versioned, binding) ────────────────────────────────────────

export type LayoutEntry = { id: WidgetId; x: number; y: number; w: number; h: number }

// profile_meta.dashboard — LAYOUT ONLY (public-readable column; nothing
// behavioral/private lives here — follows + watermark are localStorage).
export type DashboardLayoutMeta = {
  // v4 = the revision-2 schema (CREAR split out, PERFIL absorbed into the
  // spine, MAPA centered on row 2). v≠4 normalizes to defaults — pre-revision
  // layouts reference retired ids/sizes; nuking them is correct.
  v: 4
  layout: LayoutEntry[] // desktop, 12-col units
  hidden: WidgetId[]
  mobileOrder: WidgetId[] // defaults to layout reading order; user-overridable later
}

// ── Committed defaults (§2.5 — RESTABLECER restores exactly this) ────────────

export const DEFAULT_DESKTOP_LAYOUT: readonly LayoutEntry[] = [
  // Row 1: the acid CREAR block beside the publications carousel.
  { id: 'crear', x: 0, y: 0, w: 4, h: 3 },
  { id: 'cultivar', x: 4, y: 0, w: 8, h: 3 },
  // Row 2: MAPA sits center-top between GUARDADOS and REPRODUCTOR (point 15).
  { id: 'guardados', x: 0, y: 3, w: 4, h: 3 },
  { id: 'mapa', x: 4, y: 3, w: 4, h: 3 },
  { id: 'reproductor', x: 8, y: 3, w: 4, h: 3 },
  // Row 3: FRANJAS · AGENDA · ACTIVIDAD.
  { id: 'novedades', x: 0, y: 6, w: 4, h: 3 },
  { id: 'agenda', x: 4, y: 6, w: 4, h: 3 },
  { id: 'actividad', x: 8, y: 6, w: 4, h: 3 },
  // Row 4: franja-team/admin only (registry-gated).
  { id: 'mercado', x: 0, y: 9, w: 6, h: 2 },
]

// Mobile stack default (§2.5) — intentionally NOT the desktop reading order.
export const DEFAULT_MOBILE_ORDER: readonly WidgetId[] = [
  'crear',
  'cultivar',
  'actividad',
  'reproductor',
  'guardados',
  'agenda',
  'novedades',
  'mapa',
  'mercado',
]

export function defaultSize(id: WidgetId): WidgetSize {
  return WIDGET_DEFS[id].allowedSizes[0]
}

export function defaultLayoutMeta(
  widgets: readonly WidgetId[] = ALL_WIDGET_IDS
): DashboardLayoutMeta {
  const allowed = new Set(widgets)
  return {
    v: 4,
    layout: packLayout(
      DEFAULT_DESKTOP_LAYOUT.filter((entry) => allowed.has(entry.id)),
      DESKTOP_COLS
    ),
    hidden: [],
    mobileOrder: DEFAULT_MOBILE_ORDER.filter((id) => allowed.has(id)),
  }
}

// ── Size quantization (R4) ───────────────────────────────────────────────────

export function snapToAllowedSize(id: WidgetId, w: number, h: number): WidgetSize {
  const sizes = WIDGET_DEFS[id].allowedSizes
  let best = sizes[0]
  let bestDist = Infinity
  for (const size of sizes) {
    const dist = Math.abs(size.w - w) + Math.abs(size.h - h)
    if (dist < bestDist) {
      best = size
      bestDist = dist
    }
  }
  return best
}

// Edit-mode corner grip cycles through the declared states (§2.2).
export function nextAllowedSize(id: WidgetId, current: WidgetSize): WidgetSize {
  const sizes = WIDGET_DEFS[id].allowedSizes
  const index = sizes.findIndex((s) => s.w === current.w && s.h === current.h)
  return sizes[(index + 1) % sizes.length]
}

// ── Packer (§2.1 — deterministic top-left gravity) ───────────────────────────

function rectsCollide(a: LayoutEntry, b: LayoutEntry): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

function clampEntry(entry: LayoutEntry, cols: number): LayoutEntry {
  const w = Math.min(Math.max(1, Math.floor(entry.w)), cols)
  const h = Math.max(1, Math.floor(entry.h))
  const x = Math.min(Math.max(0, Math.floor(entry.x)), cols - w)
  const y = Math.max(0, Math.floor(entry.y))
  return { id: entry.id, x, y, w, h }
}

function readingOrder(a: LayoutEntry, b: LayoutEntry): number {
  if (a.y !== b.y) return a.y - b.y
  if (a.x !== b.x) return a.x - b.x
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

// Sort by (y, x, id); place each at the topmost free row for its column span.
// Widgets float up-left; collisions push later widgets down. Collision-free
// by construction; a drop re-packs the whole list around the new coordinates.
export function packLayout(entries: readonly LayoutEntry[], cols: number): LayoutEntry[] {
  const ordered = entries.map((entry) => clampEntry(entry, cols)).sort(readingOrder)
  const placed: LayoutEntry[] = []
  for (const entry of ordered) {
    let y = 0
    // Scan downward for the first row where the span fits.
    for (;;) {
      const candidate = { ...entry, y }
      if (!placed.some((other) => rectsCollide(candidate, other))) {
        placed.push(candidate)
        break
      }
      y++
    }
  }
  return placed.sort(readingOrder)
}

export function packedHeight(entries: readonly LayoutEntry[]): number {
  return entries.reduce((max, entry) => Math.max(max, entry.y + entry.h), 0)
}

// ── Tablet remap (§2.1 — derived, never stored) ──────────────────────────────

export function remapToTablet(layout: readonly LayoutEntry[]): LayoutEntry[] {
  const halved = layout.map((entry) => {
    const w = Math.min(TABLET_COLS, Math.max(TABLET_MIN_W, Math.ceil(entry.w / 2)))
    const x = Math.min(Math.max(0, Math.floor(entry.x / 2)), TABLET_COLS - w)
    return { id: entry.id, x, y: entry.y, w, h: entry.h }
  })
  return packLayout(halved, TABLET_COLS)
}

// ── Mobile order (§2.1 — 1-col priority stack) ───────────────────────────────

export function deriveMobileOrder(layout: readonly LayoutEntry[]): WidgetId[] {
  return [...layout].sort(readingOrder).map((entry) => entry.id)
}

// ── Read normalization (§2.4 — forward-compatible) ───────────────────────────
// Unknown `v` → defaults win. Unknown WidgetIds are dropped. Missing widgets
// are appended at the bottom at their default size. Sizes snap to the
// widget's allowedSizes. `widgets` scopes the registry per user (MERCADO
// exists only for franja-team accounts — §3.9).

export function normalizeLayoutMeta(
  raw: unknown,
  widgets: readonly WidgetId[] = ALL_WIDGET_IDS
): DashboardLayoutMeta {
  const allowed = new Set(widgets)
  if (!isRecord(raw) || raw.v !== 4) return defaultLayoutMeta(widgets)

  const seen = new Set<WidgetId>()
  const layout: LayoutEntry[] = []
  for (const value of asArray(raw.layout)) {
    const entry = parseEntry(value)
    if (!entry || !allowed.has(entry.id) || seen.has(entry.id)) continue
    seen.add(entry.id)
    const size = snapToAllowedSize(entry.id, entry.w, entry.h)
    layout.push({ id: entry.id, x: entry.x, y: entry.y, w: size.w, h: size.h })
  }
  // Missing widgets append at the bottom, each below the last.
  let bottom = packedHeight(layout)
  for (const id of widgets) {
    if (seen.has(id)) continue
    const size = defaultSize(id)
    layout.push({ id, x: 0, y: bottom, w: size.w, h: size.h })
    bottom += size.h
  }

  const hidden = dedupeIds(asArray(raw.hidden)).filter((id) => allowed.has(id))

  const mobileOrder = dedupeIds(asArray(raw.mobileOrder)).filter((id) =>
    allowed.has(id)
  )
  const packed = packLayout(layout, DESKTOP_COLS)
  for (const id of deriveMobileOrder(packed)) {
    if (!mobileOrder.includes(id)) mobileOrder.push(id)
  }

  return { v: 4, layout: packed, hidden, mobileOrder }
}

// ── Render helpers ───────────────────────────────────────────────────────────

// Hidden widgets keep their stored slot but never render; the remaining
// widgets re-pack so the vacated space collapses (§2.2 OCULTOS).
export function visibleEntries(meta: DashboardLayoutMeta, cols = DESKTOP_COLS): LayoutEntry[] {
  const hidden = new Set(meta.hidden)
  return packLayout(
    meta.layout.filter((entry) => !hidden.has(entry.id)),
    cols
  )
}

// Data-aware boot (§2.5): a widget whose primary slice is empty renders in
// compact mode (h = 1, single teaching row) and the packer collapses the
// space. `presence[id] === false` means empty; undefined means has data.
// neverCompact widgets (CULTIVAR — CREAR is unconditional content) are exempt.
export function applyCompactModes(
  entries: readonly LayoutEntry[],
  presence: Partial<Record<WidgetId, boolean>>,
  cols = DESKTOP_COLS
): { entries: LayoutEntry[]; compact: Set<WidgetId> } {
  const compact = new Set<WidgetId>()
  const adjusted = entries.map((entry) => {
    if (presence[entry.id] === false && !WIDGET_DEFS[entry.id].neverCompact) {
      compact.add(entry.id)
      return { ...entry, h: COMPACT_H }
    }
    return entry
  })
  return { entries: packLayout(adjusted, cols), compact }
}

// ── Parsing internals ────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function parseEntry(value: unknown): LayoutEntry | null {
  if (!isRecord(value)) return null
  const { id, x, y, w, h } = value
  if (!isWidgetId(id)) return null
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(w) || !isFiniteNumber(h)) {
    return null
  }
  return clampEntry({ id, x, y, w, h }, DESKTOP_COLS)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function dedupeIds(values: unknown[]): WidgetId[] {
  const out: WidgetId[] = []
  for (const value of values) {
    if (isWidgetId(value) && !out.includes(value)) out.push(value)
  }
  return out
}
