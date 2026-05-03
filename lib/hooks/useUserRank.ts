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
export function useUserRank(userId: string): UserRank {
  const [, tick] = useState(0)

  useEffect(() => {
    if (!userId) return
    requestUserRank(userId)
    const unsub = subscribeUserRanks(() => tick((t) => t + 1))
    return () => {
      unsub()
    }
  }, [userId])

  return getUserRankSync(userId)
}
