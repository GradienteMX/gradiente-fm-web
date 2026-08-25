'use client'

import { useEffect, useState } from 'react'
import {
  getUserRankSync,
  requestUserRank,
  subscribeUserRanks,
} from '@/lib/userRanksCache'
import type { UserRank } from '@/lib/types'

// Replaces the old in-comments useUserRank that read from
// getAllCommentsMerged() (mock + session). The new shape:
//   - On mount, queue a batched DB fetch via requestUserRank(userId)
//   - Subscribe to cache updates so the badge re-renders when the
//     batch returns
//   - Sync read from cache; default 'normie' until the first flush
//
// Per-component micro-flicker on first render is acceptable (matches
// the pre-migration hook's SSR-safe initial 'normie').

// user_rank_signals.user_id is uuid-typed. One non-uuid id (mock authors
// like 'u1', lab fixtures) in the batched `in (…)` makes the WHOLE select
// fail with 22P02 — poisoning every valid id in the batch and spamming
// [userRanksCache] flush errors on retry. Non-uuid ids can't have a rank
// row by definition, so skip the fetch and let the sync default ('normie')
// stand.
const UUID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function useUserRank(userId: string): UserRank {
  const [, tick] = useState(0)

  useEffect(() => {
    if (!userId || !UUID_SHAPE.test(userId)) return
    requestUserRank(userId)
    const unsub = subscribeUserRanks(() => tick((t) => t + 1))
    return () => {
      unsub()
    }
  }, [userId])

  return getUserRankSync(userId)
}
