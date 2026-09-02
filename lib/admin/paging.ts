// ── CONTENIDO paging — the shared arithmetic ────────────────────────────────
//
// Its own module, and NOT part of lib/data/adminItems.ts, because three
// different worlds need the same number: the server query, the server page's
// param clamp, and the client pager UI. adminItems.ts carries `import
// 'server-only'`, so a client component importing a VALUE from it fails the
// production build (type imports are erased and are fine; values are not).
// That is not a theoretical hazard — it is the build error this file exists to
// have already fixed.
//
// One constant, one clamp: a pager built on a different page size than the
// query silently skips or repeats rows at every boundary, and that class of bug
// looks like missing data rather than a paging error.

export const ADMIN_PAGE_SIZE = 50

/**
 * Normalise `?desde=` into a real page offset: non-negative, and snapped to a
 * page boundary so a hand-edited `?desde=37` lands on a page the pager can
 * actually walk back from rather than a window straddling two.
 *
 * Deliberately NOT capped at the corpus size — listAdminItems slices after
 * ranking, so an over-large offset yields an empty page, which the tab renders
 * as an honest empty state. Clamping to the last page would instead show real
 * rows under a URL that asked for different ones.
 */
export function clampAdminOffset(raw: string | number | undefined | null): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.floor(Math.round(n) / ADMIN_PAGE_SIZE) * ADMIN_PAGE_SIZE
}

/** 1-based page number for display. */
export function adminPageNumber(offset: number): number {
  return Math.floor(offset / ADMIN_PAGE_SIZE) + 1
}

/** Total pages for a result count; always at least 1 so «1 de 0» is impossible. */
export function adminPageCount(total: number): number {
  return Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE))
}
