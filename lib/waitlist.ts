// Shared waitlist vocabulary — imported by BOTH the /espera form (browser)
// and the /api/waitlist route (server), so the select options and the
// server-side allowlist can never drift apart. Keep this file dependency-free
// (no supabase imports) so it stays safe to import anywhere.

export const WAITLIST_ALIAS_MAX = 20

// "03_ CIUDAD / ZONA". CDMX-first on purpose — the scene the site covers.
export const WAITLIST_CITIES = [
  'Ciudad de México, MX',
  'Área Metropolitana, MX',
  'Guadalajara, MX',
  'Monterrey, MX',
  'Otra ciudad, MX',
  'Fuera de México',
] as const

// "04_ ¿CÓMO NOS ENCONTRASTE?" — the campaign-attribution question.
export const WAITLIST_SOURCES = [
  'Señal en X (Twitter)',
  'Instagram',
  'TikTok',
  'Un amigo / boca a boca',
  'Flyer / QR en un evento',
  'Un DJ / colectivo',
  'Otro canal',
] as const

// Pragmatic format gate — the real proof of an address is the invite email
// eventually landing, so this only needs to reject obvious garbage.
export const WAITLIST_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export interface WaitlistJoinResponse {
  ok: boolean
  /** 1-based queue position at join time (people ahead can only leave). */
  position: number | null
  /** Total signups ever, for the "de N señales" flourish. */
  total: number | null
  /** True when this email was already on the list (idempotent re-submit). */
  already: boolean
  error?: string
}

export interface WaitlistStats {
  /** Total signups ever ("SEÑALES ENCONTRADAS"). */
  senales: number
  /** status = pending ("EN LISTA DE ESPERA"). */
  espera: number
  /** status = invited ("ACCESOS CONCEDIDOS"). */
  accesos: number
}
