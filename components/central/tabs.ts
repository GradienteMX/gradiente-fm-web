/**
 * CENTRAL — the tab model. Deliberately free of React so the `/admin`
 * redirect (a server file) and the client console resolve `?tab=` with the
 * same function. Old production values are aliased, never dropped: a
 * bookmark to `/admin?tab=espera` must still land somewhere real.
 *
 * Aliases live in Maps, not object literals: the key comes straight off the
 * URL, and `LEGACY['__proto__']` on a plain object is a truthy non-string.
 */

export const TABS = ['resumen', 'contenido', 'eventos', 'franjas', 'usuarios', 'acceso', 'moderacion'] as const
export type Tab = (typeof TABS)[number]

export const TAB_LABEL: Record<Tab, string> = {
  resumen: 'Resumen',
  contenido: 'Contenido',
  eventos: 'Eventos',
  franjas: 'Franjas',
  usuarios: 'Usuarios',
  acceso: 'Acceso',
  moderacion: 'Moderación',
}

const LEGACY = new Map<string, { tab: Tab; sub?: string }>([
  ['invites', { tab: 'acceso', sub: 'invitaciones' }],
  ['invitaciones', { tab: 'acceso', sub: 'invitaciones' }],
  ['espera', { tab: 'acceso', sub: 'espera' }],
  ['users', { tab: 'usuarios' }],
  ['events', { tab: 'eventos' }],
  ['moderation', { tab: 'moderacion' }],
  ['reportes', { tab: 'moderacion' }],
])

export function resolveTab(raw: string | null | undefined): Tab {
  if (!raw) return 'resumen'
  if ((TABS as readonly string[]).includes(raw)) return raw as Tab
  return LEGACY.get(raw)?.tab ?? 'resumen'
}

/** Sub-space a legacy `?tab=` value should open inside its new home. */
export function legacySub(raw: string | null | undefined): string | undefined {
  return raw ? LEGACY.get(raw)?.sub : undefined
}

/**
 * Query keys each tab owns. Switching tabs clears the previous tab's keys
 * (a CONTENIDO search must not follow you into USUARIOS); `tab` and `dias`
 * are page-wide, and Lectura's own keys (`item`, `hilo`…) are never touched.
 */
export const TAB_KEYS: Record<Tab, string[]> = {
  resumen: [],
  contenido: ['tipo', 'estado', 'q', 'orden', 'pagina', 'ficha'],
  eventos: ['filtro', 'q', 'ev'],
  franjas: ['filtro', 'q', 'franja'],
  usuarios: ['rol', 'q', 'u'],
  acceso: ['sub', 'q', 'estado'],
  moderacion: ['cola'],
}

export const WINDOWS = [7, 30, 90, 180] as const
export const DEFAULT_DAYS = 30

/** `?dias=` snapped to the nearest offered window — the UI shows what is used. */
export function resolveDays(raw: string | null | undefined): number {
  const n = Number(raw)
  if (!raw || !Number.isFinite(n)) return DEFAULT_DAYS
  let best: number = WINDOWS[0]
  for (const w of WINDOWS) if (Math.abs(w - n) < Math.abs(best - n)) best = w
  return best
}
