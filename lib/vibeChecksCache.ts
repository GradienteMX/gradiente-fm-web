'use client'

// ── Vibe checks — module-level cache ────────────────────────────────────────
//
// Two surfaces share one cache, both keyed by itemId:
//   - useUserVibeCheck(itemId, userId) → reads the viewer's own check (if any)
//   - useVibeCheckAggregate(itemId)    → reads count + median min + median max
//
// Both fields fetch lazily on first hook subscription. Optimistic writes
// (castVibeCheck / clearVibeCheck in lib/vibeChecks.ts) update the user-vote
// + recompute the aggregate locally, then the API confirms or rolls back.
//
// Mirrors lib/pollVotesCache.ts / lib/savedCommentsCache.ts.

import { createClient } from '@/lib/supabase/client'

export type VibeCheck = {
  vibeMin: number
  vibeMax: number
  updatedAt: string
}

export type VibeCheckAggregate = {
  checkCount: number
  medianMin: number
  medianMax: number
}

type ItemEntry = {
  // Every known check for this item, keyed by user_id. We keep the full set
  // around so optimistic writes can recompute the aggregate without a server
  // round-trip; matches the polls cache's all-votes-in-memory shape.
  checks: Map<string, VibeCheck>
}

const cache = new Map<string, ItemEntry>()
const fetched = new Set<string>()
const inFlight = new Map<string, Promise<void>>()
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((fn) => fn())
}

function getOrCreate(itemId: string): ItemEntry {
  let entry = cache.get(itemId)
  if (!entry) {
    entry = { checks: new Map() }
    cache.set(itemId, entry)
  }
  return entry
}

// ── Aggregation (pure) ──────────────────────────────────────────────────────

// Median of an integer-valued array. For even-length sets, picks the lower of
// the two middle values to keep the result an integer (matches the
// `percentile_cont(0.5)::smallint` cast in the Postgres view's
// SELECT — both round half-down via SQL's `cast`).
function medianInt(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor((sorted.length - 1) / 2)
  return sorted[mid]
}

export function aggregateChecks(checks: Map<string, VibeCheck>): VibeCheckAggregate {
  if (checks.size === 0) return { checkCount: 0, medianMin: 0, medianMax: 0 }
  const mins: number[] = []
  const maxes: number[] = []
  checks.forEach((c) => {
    mins.push(c.vibeMin)
    maxes.push(c.vibeMax)
  })
  return {
    checkCount: checks.size,
    medianMin: medianInt(mins),
    medianMax: medianInt(maxes),
  }
}

// ── Sync reads ──────────────────────────────────────────────────────────────

export function getUserVibeCheckSync(
  itemId: string,
  userId: string,
): VibeCheck | null {
  return cache.get(itemId)?.checks.get(userId) ?? null
}

export function getVibeCheckAggregateSync(itemId: string): VibeCheckAggregate {
  const entry = cache.get(itemId)
  if (!entry) return { checkCount: 0, medianMin: 0, medianMax: 0 }
  return aggregateChecks(entry.checks)
}

// ── Server-truth writes ─────────────────────────────────────────────────────

export function setItemChecks(itemId: string, checks: Record<string, VibeCheck>) {
  const entry = getOrCreate(itemId)
  entry.checks.clear()
  for (const [userId, check] of Object.entries(checks)) {
    entry.checks.set(userId, check)
  }
  fetched.add(itemId)
  notify()
}

// ── Optimistic-local writes ────────────────────────────────────────────────

export function setLocalCheck(
  itemId: string,
  userId: string,
  check: VibeCheck,
) {
  const entry = getOrCreate(itemId)
  entry.checks.set(userId, check)
  notify()
}

export function removeLocalCheck(itemId: string, userId: string) {
  const entry = cache.get(itemId)
  if (!entry) return
  if (!entry.checks.has(userId)) return
  entry.checks.delete(userId)
  notify()
}

// Drop the itemId entirely — used by the realtime invalidator so the next
// subscriber refetches from the source of truth.
export function invalidateItem(itemId: string) {
  cache.delete(itemId)
  fetched.delete(itemId)
  notify()
}

export function clearAllVibeChecks() {
  if (cache.size === 0 && fetched.size === 0) return
  cache.clear()
  fetched.clear()
  notify()
}

// ── Subscription ────────────────────────────────────────────────────────────

export function subscribeVibeChecks(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

// ── Lazy fetch ──────────────────────────────────────────────────────────────

export function ensureVibeChecksFetched(itemId: string): Promise<void> {
  if (fetched.has(itemId)) return Promise.resolve()
  const existing = inFlight.get(itemId)
  if (existing) return existing
  const p = fetchVibeChecks(itemId).finally(() => inFlight.delete(itemId))
  inFlight.set(itemId, p)
  return p
}

async function fetchVibeChecks(itemId: string): Promise<void> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('vibe_checks')
    .select('user_id, vibe_min, vibe_max, updated_at')
    .eq('item_id', itemId)
  if (error) {
    console.error(`[vibeChecksCache] fetch ${itemId}:`, error)
    return
  }
  const map: Record<string, VibeCheck> = {}
  for (const row of data ?? []) {
    map[row.user_id] = {
      vibeMin: row.vibe_min,
      vibeMax: row.vibe_max,
      updatedAt: row.updated_at,
    }
  }
  setItemChecks(itemId, map)
}
