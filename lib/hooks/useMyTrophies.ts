'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth/useAuth'

// ── useMyTrophies ──────────────────────────────────────────────────────────
//
// Fetches the current user's earned trophy keys once per auth-state change.
// Returns a Set for cheap `.has(key)` lookups from the composer affordance
// row. Anonymous users get an empty set silently.
//
// Module-scoped cache so multiple composer instances on a page (root + N
// replies) don't each fire their own fetch.

let cachedKeys: Set<string> | null = null
let cachedForUserId: string | null = null
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((fn) => fn())
}

export function useMyTrophies(): Set<string> {
  const { currentUser } = useAuth()
  const userId = currentUser?.id ?? null
  const [, tick] = useState(0)

  useEffect(() => {
    if (!userId) {
      cachedKeys = new Set()
      cachedForUserId = null
      notify()
      return
    }
    if (cachedForUserId === userId && cachedKeys !== null) return
    let cancelled = false
    void fetch('/api/users/me/trophies')
      .then((res) => (res.ok ? res.json() : { keys: [] }))
      .then((body: { keys: string[] }) => {
        if (cancelled) return
        cachedKeys = new Set(body.keys ?? [])
        cachedForUserId = userId
        notify()
      })
      .catch(() => {
        if (cancelled) return
        cachedKeys = new Set()
        cachedForUserId = userId
        notify()
      })

    const refresh = () => tick((t) => t + 1)
    listeners.add(refresh)
    return () => {
      cancelled = true
      listeners.delete(refresh)
    }
  }, [userId])

  return cachedKeys ?? new Set()
}
