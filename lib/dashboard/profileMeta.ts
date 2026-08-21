'use client'

// ── profile_meta.dashboard — THE single writer ─────────────────────────────
//
// Every write to the dashboard namespace of `users.profile_meta` goes through
// `updateDashboardMeta()` — no other module may PATCH profile_meta or call
// `supabase.from('users').update` for it (grep-enforced in review). The server
// side (`/api/users/me` PATCH `dashboard` key) merges the delta key-by-key
// into `profile_meta.dashboard`, preserving every other namespace.
//
// Concurrency contract (FINAL_SPEC §2.4): writes are SERIALIZED — at most one
// PATCH in flight; deltas arriving while one is airborne coalesce
// (client-side merge) into a single follow-up PATCH. Two rapid gestures cost
// two requests at most, and a slow network can never reorder deltas.
//
// profile_meta is member-readable (`users_public_read`), so ONLY the widget
// layout lives here. Private-class dashboard state (follows, activity
// watermark) lives in lib/dashboard/localState.ts instead.
//
// The canonical shape of the namespace is `DashboardLayoutMeta` in
// lib/dashboard/layout.ts; this module stays structurally generic so it can
// carry future namespace keys without edits.

export type DashboardMetaDelta = Record<string, unknown>

interface FlushWaiter {
  resolve: (ok: boolean) => void
}

let pendingDelta: DashboardMetaDelta | null = null
let pendingWaiters: FlushWaiter[] = []
let inFlight = false

async function flushLoop(): Promise<void> {
  if (inFlight) return
  inFlight = true
  try {
    while (pendingDelta) {
      const delta = pendingDelta
      const waiters = pendingWaiters
      pendingDelta = null
      pendingWaiters = []
      let ok = false
      try {
        const res = await fetch('/api/users/me', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ dashboard: delta }),
        })
        ok = res.ok
      } catch {
        ok = false
      }
      // Failures are values, not throws (the localStorage mirror still holds
      // the layout on this device; the next successful write re-syncs).
      waiters.forEach((w) => w.resolve(ok))
    }
  } finally {
    inFlight = false
  }
}

// Queue a namespaced delta for the dashboard key. Resolves `true` once the
// PATCH carrying this delta (possibly coalesced with later ones) succeeded,
// `false` if it failed. Callers should already have mirrored to localStorage.
export function updateDashboardMeta(partial: DashboardMetaDelta): Promise<boolean> {
  pendingDelta = { ...(pendingDelta ?? {}), ...partial }
  const promise = new Promise<boolean>((resolve) => {
    pendingWaiters.push({ resolve })
  })
  void flushLoop()
  return promise
}

// ── localStorage mirror (instant boot) ─────────────────────────────────────
//
// `gradiente:dashboard:layout:<uid>` holds the last-known layout meta so the
// grid paints in its saved arrangement before the profile fetch lands.
// Reconciliation rule (§2.4): the provider compares this mirror against the
// server's profile_meta.dashboard on boot — server wins on `v` mismatch.

function layoutKey(uid: string): string {
  return `gradiente:dashboard:layout:${uid}`
}

export function readLocalDashboardLayout(uid: string): unknown | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(layoutKey(uid))
    return raw ? (JSON.parse(raw) as unknown) : null
  } catch {
    return null
  }
}

export function writeLocalDashboardLayout(uid: string, meta: unknown): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(layoutKey(uid), JSON.stringify(meta))
  } catch {
    // Quota/private-mode failures are non-fatal — profile_meta remains the
    // source of truth on next boot.
  }
}
