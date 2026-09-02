// ── /admin tab model ────────────────────────────────────────────────────────
//
// The tab set went 5 → 7 (RESUMEN and CONTENIDO are new; MODERACIÓN is new;
// INVITACIONES + ESPERA merged into ACCESO). That is a URL change, so the old
// ?tab= values are ALIASED rather than dropped — every one of them still lands
// somewhere sensible.
//
// The alias table is not politeness. Two live callers depend on these values:
// the dashboard's retired-approvals redirect points at `/admin?tab=franjas`
// (app/dashboard/page.tsx), and the team has four months of bookmarks. A
// silent fallback to the default tab reads as "the panel lost my page".
//
// Kept deliberately free of React so both the server page and the client tab
// bar can import it without dragging a client boundary across the route.

export const ADMIN_TABS = [
  'resumen',
  'contenido',
  'eventos',
  'franjas',
  'usuarios',
  'acceso',
  'moderacion',
] as const

export type AdminTab = (typeof ADMIN_TABS)[number]

export const ADMIN_TAB_LABELS: Record<AdminTab, string> = {
  resumen: 'RESUMEN',
  contenido: 'CONTENIDO',
  eventos: 'EVENTOS',
  franjas: 'FRANJAS',
  usuarios: 'USUARIOS',
  acceso: 'ACCESO',
  moderacion: 'MODERACIÓN',
}

// Both alias tables are Maps, not plain objects, and that is not a style
// choice: the key comes straight off ?tab= in the URL. A plain-object lookup
// of `LEGACY['__proto__']` returns Object.prototype — a truthy non-string that
// sails past `?? 'resumen'` and lands an object where a tab id belongs. A Map
// has no prototype chain to walk, so a hostile key simply misses.

/** Pre-redesign ?tab= values → where they land now. */
const LEGACY = new Map<string, AdminTab>([
  ['invites', 'acceso'],
  ['espera', 'acceso'],
  ['users', 'usuarios'],
  ['events', 'eventos'],
  // 'franjas' is unchanged and needs no alias, but the dashboard links to it
  // by name — listing it here documents that the link is load-bearing.
  ['franjas', 'franjas'],
])

/**
 * Legacy values that additionally select a sub-tab inside their new home.
 * Exported so tests can assert it against the alias table without reaching
 * into module privates; read it through legacySubTab() in application code.
 */
export const LEGACY_SUBTAB: ReadonlyMap<string, string> = new Map([
  ['espera', 'espera'],
  ['invites', 'invitaciones'],
])

/** Sub-tab a legacy ?tab= value should open inside its new home, if any. */
export function legacySubTab(raw: string | undefined | null): string | undefined {
  return raw ? LEGACY_SUBTAB.get(raw) : undefined
}

/**
 * Resolve ?tab= to a real tab. Unknown values fall to RESUMEN — the overview
 * is the honest landing place for "I do not know where you meant to go".
 *
 * Both the page and the tab bar MUST call this. Before the redesign the page
 * fell back to 'invites' while the bar cast the raw param straight to its
 * union, so `?tab=bogus` rendered INVITACIONES content with NO tab latched —
 * a state where the panel disagreed with itself about where you were.
 */
export function resolveAdminTab(raw: string | undefined | null): AdminTab {
  if (!raw) return 'resumen'
  if ((ADMIN_TABS as readonly string[]).includes(raw)) return raw as AdminTab
  return LEGACY.get(raw) ?? 'resumen'
}

/** Canonical href for a tab. The default tab owns the bare /admin URL. */
export function adminTabHref(tab: AdminTab): string {
  return tab === 'resumen' ? '/admin' : `/admin?tab=${tab}`
}
