'use client'

/**
 * The waitlist, from the browser: the one write a visitor without an account
 * can make (POST /api/waitlist, production's route and contract) and what
 * this browser remembers about it. The server answers with the place in the
 * queue; no row of the list ever comes back.
 *
 * Remembered in localStorage — the email, alias and city this browser typed
 * and the place the server gave it — so a returning visitor sees their place
 * instead of an empty form. Shared by /espera and La Puerta's inline form.
 */

import type { WaitlistJoinResponse, WaitlistStats } from '@/lib/waitlist'

const LS_KEY = 'gradiente-v2:espera'

export interface Senal {
  email: string
  alias: string
  city: string
  /** 1-based place in the queue when the signal was left (it can only improve). */
  position: number
  /** Signals in the queue at that moment. */
  total: number | null
  /** When this browser left it (ISO). */
  at: string
}

/** The stored record as text (a stable snapshot for useSyncExternalStore). */
export function readSenalRaw(): string | null {
  try {
    return window.localStorage.getItem(LS_KEY)
  } catch {
    return null
  }
}

export function parseSenal(raw: string | null): Senal | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as Partial<Senal>
    // A record without a place is from before the real queue: forget it.
    return v?.email && typeof v.position === 'number' ? (v as Senal) : null
  } catch {
    return null
  }
}

export function writeSenal(v: Senal | null) {
  try {
    if (v) window.localStorage.setItem(LS_KEY, JSON.stringify(v))
    else window.localStorage.removeItem(LS_KEY)
  } catch {
    /* private mode: the queue still works, this browser just won't remember */
  }
}

export type JoinResult = { ok: true; position: number | null; total: number | null; already: boolean } | { ok: false; error: string }

/**
 * POST /api/waitlist { alias, email, city, source?, tel }. `tel` is the
 * honeypot: the route answers a filled one with a calm «ok» and no row
 * (position null). Idempotent on email: a repeat returns the existing place.
 */
export async function joinWaitlist(body: { alias: string; email: string; city: string; source?: string; tel: string }): Promise<JoinResult> {
  try {
    const res = await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = (await res.json().catch(() => null)) as WaitlistJoinResponse | null
    if (!res.ok || !data || data.ok === false) return { ok: false, error: data?.error ?? 'No se pudo enviar. Inténtalo de nuevo.' }
    return { ok: true, position: data.position, total: data.total, already: data.already }
  } catch {
    return { ok: false, error: 'No se pudo enviar. Revisa tu conexión.' }
  }
}

/** GET /api/waitlist — the counts and the queue's states (never who). Null when it can't be read. */
export async function readFila(): Promise<WaitlistStats | null> {
  try {
    const res = await fetch('/api/waitlist', { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as Partial<WaitlistStats>
    if (typeof data.senales !== 'number') return null
    return { senales: data.senales, espera: data.espera ?? 0, accesos: data.accesos ?? 0, fila: Array.isArray(data.fila) ? data.fila : [] }
  } catch {
    return null
  }
}
