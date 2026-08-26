'use client'

// ── Private-class dashboard state — localStorage only ──────────────────────
//
// Follows and the activity watermark are the same privacy class as saves
// (RLS self-only) but `users.profile_meta` is member-readable
// (`users_public_read`), so they MUST NOT live there (FINAL_SPEC §2.4,
// addendum v3). v1 keeps them per-device in localStorage, namespaced per uid
// so account switches on one browser never bleed state.
//
// Keys:
//   gradiente:dashboard:follows:<uid>          {v:1, follows:[{kind,key}]}
//   gradiente:dashboard:lastSeenActivity:<uid> ISO timestamp string
//
// UPGRADE PATH (documented, zero SQL now — migration history drift forbids
// `db push`; Iker applies SQL manually): promote follows to a `user_follows`
// table anchored on the existing `entities` registry —
//   user_follows(user_id uuid FK users, entity_id uuid FK entities,
//                followed_at timestamptz default now(),
//                PK(user_id, entity_id))
// with self-only RLS cloned from `user_saves_self_only`, POST/DELETE
// /api/follows/[entityId] cloned from the saves routes, and a followsCache
// module cloned from lib/itemSavesCache. Franjas are items (type='franja'),
// not entities, so the migration either mints an entity per franja or adds a
// second target column. On first boot after the table exists, seed it from
// this store, then keep localStorage as a mirror.
//
// The watermark is the ONE read-state for the whole dashboard: the spine's
// unread count and ACTIVIDAD's badge both derive from this key — never a
// second per-row read state.

export type FollowKind = 'franja' | 'genre'

export interface DashboardFollow {
  kind: FollowKind
  key: string
}

interface FollowsStore {
  v: 1
  follows: DashboardFollow[]
}

function followsKey(uid: string): string {
  return `gradiente:dashboard:follows:${uid}`
}

function lastSeenKey(uid: string): string {
  return `gradiente:dashboard:lastSeenActivity:${uid}`
}

// ── in-tab listeners + cross-tab storage events ────────────────────────────

const followListeners = new Set<() => void>()
const lastSeenListeners = new Set<() => void>()

let storageHooked = false
function hookStorageEvents() {
  if (storageHooked || typeof window === 'undefined') return
  storageHooked = true
  // Cross-tab: localStorage `storage` events fire only in OTHER tabs, so a
  // follow or watermark advance in tab A updates tab B's widgets live.
  window.addEventListener('storage', (e) => {
    if (!e.key) return
    if (e.key.startsWith('gradiente:dashboard:follows:')) {
      followListeners.forEach((fn) => fn())
    } else if (e.key.startsWith('gradiente:dashboard:lastSeenActivity:')) {
      lastSeenListeners.forEach((fn) => fn())
    }
  })
}

export function subscribeFollows(fn: () => void): () => void {
  hookStorageEvents()
  followListeners.add(fn)
  return () => {
    followListeners.delete(fn)
  }
}

export function subscribeLastSeenActivity(fn: () => void): () => void {
  hookStorageEvents()
  lastSeenListeners.add(fn)
  return () => {
    lastSeenListeners.delete(fn)
  }
}

// ── follows ────────────────────────────────────────────────────────────────

export function readFollows(uid: string): DashboardFollow[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(followsKey(uid))
    if (!raw) return []
    const parsed = JSON.parse(raw) as Partial<FollowsStore> | null
    // Unknown/missing version → treat as absent (forward-compatible defaults).
    if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.follows)) return []
    return parsed.follows.filter(
      (f): f is DashboardFollow =>
        !!f &&
        (f.kind === 'franja' || f.kind === 'genre') &&
        typeof f.key === 'string' &&
        f.key.length > 0,
    )
  } catch {
    return []
  }
}

function writeFollows(uid: string, follows: DashboardFollow[]): void {
  if (typeof window === 'undefined') return
  const store: FollowsStore = { v: 1, follows }
  try {
    window.localStorage.setItem(followsKey(uid), JSON.stringify(store))
  } catch {
    // Quota/private-mode: the in-memory notify below still updates this tab.
  }
  followListeners.forEach((fn) => fn())
}

export function isFollowing(uid: string, follow: DashboardFollow): boolean {
  return readFollows(uid).some((f) => f.kind === follow.kind && f.key === follow.key)
}

export function addFollow(uid: string, follow: DashboardFollow): DashboardFollow[] {
  const current = readFollows(uid)
  if (current.some((f) => f.kind === follow.kind && f.key === follow.key)) return current
  const next = [...current, follow]
  writeFollows(uid, next)
  return next
}

export function removeFollow(uid: string, follow: DashboardFollow): DashboardFollow[] {
  const current = readFollows(uid)
  const next = current.filter((f) => !(f.kind === follow.kind && f.key === follow.key))
  if (next.length !== current.length) writeFollows(uid, next)
  return next
}

// ── activity watermark ─────────────────────────────────────────────────────

// ISO timestamp of the newest activity row the user has seen, or null (never
// marked → everything is new).
export function readLastSeenActivity(uid: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(lastSeenKey(uid))
  } catch {
    return null
  }
}

// Advance-only: the watermark never moves backwards, so an offscreen mount
// or a stale tab can't resurrect already-seen rows as "new".
export function advanceLastSeenActivity(uid: string, iso: string): void {
  if (typeof window === 'undefined') return
  const current = readLastSeenActivity(uid)
  if (current && current >= iso) return
  try {
    window.localStorage.setItem(lastSeenKey(uid), iso)
  } catch {
    return
  }
  lastSeenListeners.forEach((fn) => fn())
}
