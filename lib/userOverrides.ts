'use client'

// ── Frontend-only user-override store ──────────────────────────────────────
//
// Visual-prototype scaffolding for admin role assignment. Lets an admin edit
// any user's role / isMod / isOG and have the change reflect across every
// badge consumer (CommentList, PostHeader, etc.) without touching the static
// MOCK_USERS seed.
//
// Mirrors the lib/comments.ts idiom — sessionStorage-backed, listener
// pattern, dies when the tab closes. Only `role`, `isMod`, `isOG` are
// overridable; identity fields (id / username / displayName / joinedAt)
// are immutable.
//
// When the real backend (see [[Supabase Migration]]) lands, replace
// `setUserOverride` / `clearUserOverride` with Supabase update RPCs and
// drop the listener registry in favor of Realtime subscriptions.

import { useEffect, useState } from 'react'
import type { Role, User } from './types'
import { getUserById, MOCK_USERS } from './mockUsers'

const STORAGE_KEY = 'gradiente:user-overrides'

// ── Real-user cache (Supabase-backed) ──────────────────────────────────────
//
// Bridges the gap between the mock-data world (MOCK_USERS) and the real-auth
// world (public.users in Supabase). When a client component fetches users
// from the DB, it calls `setRealUsers(list)` to merge them in here. Anything
// querying a user id (useResolvedUser, getResolvedUserById) prefers a real
// user over a mock if both exist, so real signups (like Iker's @iker)
// resolve correctly throughout the comment column, post headers, etc.
//
// The cache is global, monotonically growing, and shared across components
// — fine at our scale. RLS-enforced reads mean only data the caller is
// allowed to see ends up here. Will be replaced by Realtime subscriptions
// in chunk 3 follow-up.
const realUserCache = new Map<string, User>()

export function setRealUsers(users: Iterable<User>) {
  let changed = false
  for (const u of users) {
    if (realUserCache.get(u.id) !== u) {
      realUserCache.set(u.id, u)
      changed = true
    }
  }
  if (changed) notify()
}

export function getRealUserById(id: string): User | undefined {
  return realUserCache.get(id)
}

// What an admin is allowed to edit. Identity fields are intentionally absent.
//
// partnerId convention:
//   undefined → no change (leave seed value alone)
//   string    → set to this partner id
//   null      → explicit clear (drop user from any partner)
export interface UserOverride {
  role?: Role
  isMod?: boolean
  isOG?: boolean
  partnerId?: string | null
  partnerAdmin?: boolean
}

type OverrideMap = Record<string, UserOverride>

function emptyMap(): OverrideMap {
  return {}
}

function readMap(): OverrideMap {
  if (typeof window === 'undefined') return emptyMap()
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyMap()
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as OverrideMap) : emptyMap()
  } catch {
    return emptyMap()
  }
}

function writeMap(m: OverrideMap) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(m))
  } catch {}
}

// ── Listener registry ──────────────────────────────────────────────────────

const listeners = new Set<() => void>()
function notify() {
  listeners.forEach((fn) => fn())
}

// ── Read API ───────────────────────────────────────────────────────────────

export function getUserOverride(id: string): UserOverride | undefined {
  const m = readMap()
  return m[id]
}

export function getResolvedUserById(id: string): User | undefined {
  // Real users (from Supabase) win over mock seed identities — important for
  // post-launch when real signups dominate. Mock fallback keeps the visual
  // prototype's seed comments / threads readable until pre-beta cleanup.
  const seed = realUserCache.get(id) ?? getUserById(id)
  if (!seed) return undefined
  const ov = readMap()[id]
  if (!ov) return seed
  return applyOverride(seed, ov)
}

// Returns the full roster with overrides applied. Used by the admin
// PermisosSection list view.
export function listResolvedUsers(): User[] {
  const ov = readMap()
  return MOCK_USERS.map((u) => (ov[u.id] ? applyOverride(u, ov[u.id]) : u))
}

function applyOverride(seed: User, ov: UserOverride): User {
  const next: User = {
    ...seed,
    role: ov.role ?? seed.role,
  }
  // Flags: explicit `false` clears, `true` sets, `undefined` falls through to
  // the seed value. Keeps the override map small (no need to write `false`
  // when the seed is also false).
  if (ov.isMod !== undefined) next.isMod = ov.isMod
  if (ov.isOG !== undefined) next.isOG = ov.isOG
  // partnerId — null means explicit clear; string means set; undefined leaves seed.
  if (ov.partnerId === null) {
    delete next.partnerId
  } else if (ov.partnerId !== undefined) {
    next.partnerId = ov.partnerId
  }
  if (ov.partnerAdmin !== undefined) next.partnerAdmin = ov.partnerAdmin
  return next
}

// ── Write API ──────────────────────────────────────────────────────────────

// Patch-merge: pass only the fields you want to change. Pass `undefined` to
// leave a field alone; for `partnerId` pass `null` to explicitly clear.
export function setUserOverride(id: string, patch: UserOverride) {
  if (!getUserById(id)) return // guard against typos in caller
  const m = readMap()
  const prev = m[id] ?? {}
  const next: UserOverride = { ...prev }
  if (patch.role !== undefined) next.role = patch.role
  if (patch.isMod !== undefined) next.isMod = patch.isMod
  if (patch.isOG !== undefined) next.isOG = patch.isOG
  if (patch.partnerId !== undefined) next.partnerId = patch.partnerId
  if (patch.partnerAdmin !== undefined) next.partnerAdmin = patch.partnerAdmin
  // Drop the entry entirely if it now matches the seed — keeps storage tidy.
  const seed = getUserById(id)!
  const isNoop =
    (next.role === undefined || next.role === seed.role) &&
    (next.isMod === undefined || (next.isMod ?? false) === (seed.isMod ?? false)) &&
    (next.isOG === undefined || (next.isOG ?? false) === (seed.isOG ?? false)) &&
    (next.partnerId === undefined ||
      (next.partnerId === null
        ? seed.partnerId === undefined
        : next.partnerId === seed.partnerId)) &&
    (next.partnerAdmin === undefined ||
      (next.partnerAdmin ?? false) === (seed.partnerAdmin ?? false))
  if (isNoop) {
    delete m[id]
  } else {
    m[id] = next
  }
  writeMap(m)
  notify()
}

export function clearUserOverride(id: string) {
  const m = readMap()
  if (!(id in m)) return
  delete m[id]
  writeMap(m)
  notify()
}

export function clearAllOverrides() {
  writeMap(emptyMap())
  notify()
}

// ── React hooks ────────────────────────────────────────────────────────────

// Live-resolved User by id. Re-renders when any override changes. Returns
// `undefined` for unknown ids (matches getUserById).
//
// Computes the result *synchronously* each render rather than syncing via
// effect — this matters for the [[useAuth]] consumer, where a one-frame
// lag between `userId` changing and `resolved` updating would briefly drop
// `currentUser` to null and flicker the LoginOverlay open. The tick state
// is just a "force re-render" signal for override-change subscriptions.
export function useResolvedUser(id: string | null | undefined): User | undefined {
  const [, forceTick] = useState(0)
  useEffect(() => {
    const refresh = () => forceTick((t) => t + 1)
    listeners.add(refresh)
    return () => {
      listeners.delete(refresh)
    }
  }, [])
  if (!id) return undefined
  return getResolvedUserById(id)
}

// Full roster with overrides applied — drives the PermisosSection list.
export function useResolvedUsers(): User[] {
  const [users, setUsers] = useState<User[]>(() => listResolvedUsers())
  useEffect(() => {
    const refresh = () => setUsers(listResolvedUsers())
    refresh()
    listeners.add(refresh)
    return () => {
      listeners.delete(refresh)
    }
  }, [])
  return users
}

// Boolean: does the user have any active override? Used by the admin list
// to render the "EDITADO" chip.
export function useHasOverride(id: string): boolean {
  const [has, setHas] = useState(() => !!getUserOverride(id))
  useEffect(() => {
    const refresh = () => setHas(!!getUserOverride(id))
    refresh()
    listeners.add(refresh)
    return () => {
      listeners.delete(refresh)
    }
  }, [id])
  return has
}
