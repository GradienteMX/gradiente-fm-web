'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Real feed pulse for the header heartbeat:
//   - lastCuratedAt: max(items.hp_last_updated_at) — when the HP rollup (or a
//     publish) last actually MOVED the feed. Honest at any traffic level: a
//     no-op rollup tick doesn't advance it, so it never over-promises churn.
//   - activeCount: how many pieces are live in the feed.
//
// Authed-only: items reads are auth-gated (migration 0014), so anonymous
// visitors get nulls and the header hides the readout (they're redirected to
// /welcome anyway). Polls every 90s; a 30s clock tick advances the "hace Xm"
// label between polls. `now` starts at 0 so nothing time-dependent renders
// during SSR (avoids a hydration mismatch) — it's set once data lands client-side.
export function useFeedPulse(): {
  lastCuratedAt: string | null
  activeCount: number | null
  now: number
} {
  const [lastCuratedAt, setLastCuratedAt] = useState<string | null>(null)
  const [activeCount, setActiveCount] = useState<number | null>(null)
  const [now, setNow] = useState(0)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    const load = async () => {
      const [{ count }, { data }] = await Promise.all([
        supabase.from('items').select('id', { count: 'exact', head: true }).eq('published', true),
        supabase
          .from('items')
          .select('hp_last_updated_at')
          .eq('published', true)
          .not('hp_last_updated_at', 'is', null)
          .order('hp_last_updated_at', { ascending: false })
          .limit(1),
      ])
      if (cancelled) return
      setActiveCount(count ?? null)
      setLastCuratedAt(data?.[0]?.hp_last_updated_at ?? null)
      setNow(Date.now())
    }

    void load()
    const poll = setInterval(load, 90_000)
    const tick = setInterval(() => setNow(Date.now()), 30_000)
    return () => {
      cancelled = true
      clearInterval(poll)
      clearInterval(tick)
    }
  }, [])

  return { lastCuratedAt, activeCount, now }
}
