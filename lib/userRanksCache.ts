'use client'

// ── User ranks — module-level cache + batched fetch ─────────────────────────
//
// Per-user UserRank derived from `user_rank_signals` view (migration 0005).
// Sits in front of the view so multiple components rendering rank badges
// for the same set of users (CommentList, PostHeader, dashboard sections)
// trigger ONE batched fetch per visible author-set instead of N queries.
//
// Pattern mirrors lib/itemSavesCache.ts / lib/savedCommentsCache.ts:
//   - Module-scoped cache + listener Set
//   - Sync getter for components (`getUserRankSync`)
//   - Async writer (`requestUserRank`) that batches via microtask, runs
//     a single SELECT … in (ids), fills cache, notifies listeners
//
// What's NOT here yet:
//   - Realtime invalidation. comment_reactions IS in supabase_realtime
//     (squash 0004) so we could subscribe + invalidate the affected
//     author's rank on each reaction event. Skipped for v1: ranks
//     change slowly (need 5+ received reactions to leave 'normie'),
//     and a session-bounded cache is enough for beta. Plumb in chunk 4.

import { createClient } from '@/lib/supabase/client'
import { rankFromCounts } from '@/lib/permissions'
import type { UserRank } from '@/lib/types'

const cache = new Map<string, UserRank>()
const pending = new Set<string>()
const listeners = new Set<() => void>()
let flushTimer: ReturnType<typeof setTimeout> | null = null

function notify() {
  listeners.forEach((fn) => fn())
}

// ── Reads ──────────────────────────────────────────────────────────────────

export function getUserRankSync(userId: string): UserRank {
  // Optimistic default until first flush completes — same shape as the
  // pre-migration hook, which also returned 'normie' on initial render.
  return cache.get(userId) ?? 'normie'
}

// ── Batched fetch ──────────────────────────────────────────────────────────

// Adds id to the pending queue + schedules a microtask flush. Many
// components calling this synchronously in the same render cycle land
// in the same batch.
export function requestUserRank(userId: string) {
  if (!userId) return
  if (cache.has(userId) || pending.has(userId)) return
  pending.add(userId)
  if (flushTimer === null) {
    flushTimer = setTimeout(flushPending, 0)
  }
}

async function flushPending() {
  flushTimer = null
  if (pending.size === 0) return
  const ids = Array.from(pending)
  pending.clear()

  const { data, error } = await createClient()
    .from('user_rank_signals')
    .select('user_id, signal_count, prov_count')
    .in('user_id', ids)

  if (error) {
    // Don't poison the cache — leave the ids unset so a later request
    // retries. Surface the failure for debugging.
    // eslint-disable-next-line no-console
    console.error('[userRanksCache] flush failed:', error)
    return
  }

  for (const row of data ?? []) {
    const signal = Number(row.signal_count ?? 0)
    const prov = Number(row.prov_count ?? 0)
    cache.set(row.user_id as string, rankFromCounts(signal, prov))
  }
  // Users absent from the view rows have zero received reactions →
  // explicitly cache 'normie' so subsequent requestUserRank calls for
  // the same id are no-ops.
  for (const id of ids) {
    if (!cache.has(id)) cache.set(id, 'normie')
  }
  notify()
}

// ── Lifecycle ──────────────────────────────────────────────────────────────

export function clearUserRanksCache() {
  if (cache.size === 0 && pending.size === 0) return
  cache.clear()
  pending.clear()
  if (flushTimer !== null) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  notify()
}

export function subscribeUserRanks(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
