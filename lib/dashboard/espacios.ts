// ── ESPACIOS — the /dashboard tab model (PLIEGO fase D) ─────────────────────
//
// The panel stops being one scrolling grid of widgets and becomes four
// SPACES: PANEL · PUBLICAR · FRANJA · MERCADO.
//
// The load-bearing structural call: **only PANEL is a widget grid.** The
// other three are bespoke paper sheets. That is why fase D needs no layout
// schema bump — `DashboardLayoutMeta` stays at `v: 4`, the packer stays
// untouched, and edit mode keeps operating on the one and only grid, so a
// drag can never silently re-pack widgets the user cannot see (the failure
// mode a per-tab grid would have introduced).
//
// Tab state lives in the URL as `?espacio=<id>` so every space deep-links,
// survives the back button, and can be restored after the compose
// round-trip. An absent/unknown/ungranted value resolves to `panel` — never
// an error, matching the `?section=` resolver's rule.
//
// Gating: FRANJA and MERCADO exist only for franja-team users
// (`currentUser.franjaId`). Admins no longer get a marketplace space here —
// per the 2026-09 governance call marketplace activation is SELF-SERVICE for
// the franja team (MERCADO › AJUSTES), and the admin lever is an abuse
// kill-switch that lives on /admin, not an approval queue on the panel.

export type EspacioId = 'panel' | 'publicar' | 'franja' | 'mercado'

export const ESPACIO_IDS: readonly EspacioId[] = [
  'panel',
  'publicar',
  'franja',
  'mercado',
]

export const ESPACIO_LABELS: Record<EspacioId, string> = {
  panel: 'PANEL',
  publicar: 'PUBLICAR',
  franja: 'FRANJA',
  mercado: 'MERCADO',
}

export const DEFAULT_ESPACIO: EspacioId = 'panel'

/** URL param name — one constant so the page, the strip and the tab bar agree. */
export const ESPACIO_PARAM = 'espacio'

export interface EspacioFlags {
  /** `!!currentUser.franjaId` — the ONLY gate for the franja/mercado spaces. */
  isFranjaTeam: boolean
}

export function isEspacioId(value: string | null | undefined): value is EspacioId {
  return !!value && (ESPACIO_IDS as readonly string[]).includes(value)
}

/**
 * The spaces this viewer may see, in tab order. PANEL and PUBLICAR are
 * universal (every account can hold drafts and publish); FRANJA and MERCADO
 * require team membership.
 *
 * A space whose gate is closed is never rendered as a disabled tab — the
 * recon's most likely fase-D bug was a dead tab with an empty body, so the
 * rule is: no grant, no tab.
 */
export function visibleEspacios(flags: EspacioFlags): readonly EspacioId[] {
  return ESPACIO_IDS.filter(
    (id) => flags.isFranjaTeam || (id !== 'franja' && id !== 'mercado'),
  )
}

/**
 * Resolve a raw `?espacio=` value against this viewer's grants. Unknown or
 * ungranted values fall back to PANEL rather than erroring — a franja member
 * who loses team access mid-session lands on the panel, not on a broken page.
 */
export function resolveEspacio(
  raw: string | null | undefined,
  flags: EspacioFlags,
): EspacioId {
  if (!isEspacioId(raw)) return DEFAULT_ESPACIO
  return visibleEspacios(flags).includes(raw) ? raw : DEFAULT_ESPACIO
}

/** Build a `/dashboard` href for a space (PANEL is the bare path). */
export function espacioHref(id: EspacioId): string {
  return id === DEFAULT_ESPACIO ? '/dashboard' : `/dashboard?${ESPACIO_PARAM}=${id}`
}
