'use client'

/**
 * Session — who is looking. The real Supabase session, read on the server by
 * the root layout (`auth.getUser()`), which sends the viewer's own row with
 * the world; `useMe()` is that row (with whatever the viewer just changed on
 * it applied). Signing in and out go through the production routes — see
 * lib/auth/client.ts. There is nothing to wait for on the client: the
 * session is known at the first paint.
 */

import type { User, UserRank } from '@/lib/types'
import { useWorld } from './world'
import * as perm from '@/lib/permissions'
import { reactionsReceived } from './world-core'

/** Always true: the session arrives with the page. Kept for surfaces that used to wait for it. */
export function useSessionReady(): boolean {
  return true
}

/** The signed-in person, or null. */
export function useMe(): User | null {
  return useWorld((s) => (s.world.viewer ? (s.world.users[s.world.viewer] ?? null) : null))
}

export function rankFor(signal: number, provocative: number): UserRank {
  return perm.rankFromCounts(signal, provocative)
}

/** Derived posting texture — labels people, never weights content. */
export function useRank(userId: string | null | undefined): UserRank {
  return useWorld((s) => {
    if (!userId) return 'normie'
    const rx = reactionsReceived(s.world, userId)
    return perm.rankFromCounts(rx.signal, rx.provocative)
  })
}

export { perm }
