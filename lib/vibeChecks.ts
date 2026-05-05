'use client'

// ── Vibe checks — write API + hooks ─────────────────────────────────────────
//
// Public surface for the [[VibeFader]] component. Mirrors lib/polls.ts in
// shape: optimistic-local-then-confirm writes, two read hooks (own check +
// crowd aggregate), realtime invalidation per item.
//
// Threshold: when check_count >= VIBE_CHECK_THRESHOLD, the displayed band
// switches from author's [vibeMin, vibeMax] to the crowd median. Both the
// fader visual and filterByVibe()'s effective-band derivation use this.

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  aggregateChecks,
  ensureVibeChecksFetched,
  getUserVibeCheckSync,
  getVibeCheckAggregateSync,
  invalidateItem,
  removeLocalCheck,
  setLocalCheck,
  subscribeVibeChecks,
  type VibeCheck,
  type VibeCheckAggregate,
} from './vibeChecksCache'

export const VIBE_CHECK_THRESHOLD = 5

// ── Read API (sync helpers) ────────────────────────────────────────────────

export function getUserVibeCheck(itemId: string, userId: string): VibeCheck | null {
  return getUserVibeCheckSync(itemId, userId)
}

export function getVibeCheckAggregate(itemId: string): VibeCheckAggregate {
  return getVibeCheckAggregateSync(itemId)
}

// Effective band — what filtering and the fader's "displayed" position use.
// Falls through to author's range when crowd hasn't reached threshold.
export function effectiveVibeBand(
  authorMin: number,
  authorMax: number,
  aggregate: VibeCheckAggregate,
): [number, number] {
  if (aggregate.checkCount >= VIBE_CHECK_THRESHOLD) {
    return [aggregate.medianMin, aggregate.medianMax]
  }
  return [authorMin, authorMax]
}

// ── Write API (optimistic) ─────────────────────────────────────────────────

export async function castVibeCheck(
  itemId: string,
  userId: string,
  vibeMin: number,
  vibeMax: number,
) {
  if (vibeMin < 0 || vibeMax > 10 || vibeMin > vibeMax) return
  const previous = getUserVibeCheckSync(itemId, userId)
  setLocalCheck(itemId, userId, {
    vibeMin,
    vibeMax,
    updatedAt: new Date().toISOString(),
  })
  try {
    const res = await fetch(`/api/vibe-checks/${encodeURIComponent(itemId)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ vibeMin, vibeMax }),
    })
    if (!res.ok) throw new Error('vibe-check api failed')
  } catch {
    if (previous) setLocalCheck(itemId, userId, previous)
    else removeLocalCheck(itemId, userId)
  }
}

export async function clearVibeCheck(itemId: string, userId: string) {
  const previous = getUserVibeCheckSync(itemId, userId)
  if (!previous) return
  removeLocalCheck(itemId, userId)
  try {
    const res = await fetch(`/api/vibe-checks/${encodeURIComponent(itemId)}`, {
      method: 'DELETE',
    })
    if (!res.ok) throw new Error('clear-vibe-check api failed')
  } catch {
    setLocalCheck(itemId, userId, previous)
  }
}

// ── Hooks ───────────────────────────────────────────────────────────────────

// User's own check for this item — null when logged-out or unvoted.
// Triggers a fetch of the item's full check set on first subscription so
// the parallel aggregate hook is primed off the same load.
export function useUserVibeCheck(
  itemId: string | null,
  userId: string | null,
): VibeCheck | null {
  const [check, setCheck] = useState<VibeCheck | null>(() =>
    itemId && userId ? getUserVibeCheckSync(itemId, userId) : null,
  )
  useEffect(() => {
    if (!itemId) {
      setCheck(null)
      return
    }
    void ensureVibeChecksFetched(itemId)
    if (!userId) {
      setCheck(null)
      return
    }
    const refresh = () => setCheck(getUserVibeCheckSync(itemId, userId))
    refresh()
    return subscribeVibeChecks(refresh)
  }, [itemId, userId])
  return check
}

// Crowd aggregate (count + median min + median max). Lazy fetch on first
// subscription. Each subscriber also opens a realtime channel scoped to
// this item so peer votes invalidate + refetch automatically.
export function useVibeCheckAggregate(itemId: string | null): VibeCheckAggregate {
  const [agg, setAgg] = useState<VibeCheckAggregate>(() =>
    itemId
      ? getVibeCheckAggregateSync(itemId)
      : { checkCount: 0, medianMin: 0, medianMax: 0 },
  )
  useEffect(() => {
    if (!itemId) {
      setAgg({ checkCount: 0, medianMin: 0, medianMax: 0 })
      return
    }
    void ensureVibeChecksFetched(itemId)
    const refresh = () => setAgg(getVibeCheckAggregateSync(itemId))
    refresh()
    const unsub = subscribeVibeChecks(refresh)

    // Realtime: invalidate this item's cache on any peer write so the next
    // refresh pulls fresh data. Local optimistic writes update the cache
    // directly and don't depend on this echo.
    const supabase = createClient()
    const channel = supabase
      .channel(`vibe-checks:item:${itemId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vibe_checks',
          filter: `item_id=eq.${itemId}`,
        },
        () => {
          invalidateItem(itemId)
          void ensureVibeChecksFetched(itemId)
        },
      )
      .subscribe()

    return () => {
      unsub()
      void supabase.removeChannel(channel)
    }
  }, [itemId])
  return agg
}

// Convenience: re-export for consumers that want the pure aggregator.
export { aggregateChecks }
export type { VibeCheck, VibeCheckAggregate }
