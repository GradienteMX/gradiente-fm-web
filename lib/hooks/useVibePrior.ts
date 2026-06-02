'use client'

import { useEffect, useState } from 'react'
// Type-only import — erased at build time, so the server-only vibePriors module
// (which imports next/headers) is never pulled into the client bundle.
import type { VibePrior } from '@/lib/data/vibePriors'

// Debounced fetch of the composer vibe-prior. Re-runs as the author edits genres
// / venue so the suggestion sharpens live. Aborts the in-flight request on each
// change. Returns prior=null when there's nothing to suggest (so the UI hides).
export function useVibePrior(input: { genres: string[]; venue?: string | null }): {
  prior: VibePrior | null
  loading: boolean
} {
  const [prior, setPrior] = useState<VibePrior | null>(null)
  const [loading, setLoading] = useState(false)

  const genresKey = input.genres.join(',')
  const venue = input.venue ?? ''

  useEffect(() => {
    let cancelled = false
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      setLoading(true)
      const qs = new URLSearchParams()
      if (genresKey) qs.set('genres', genresKey)
      if (venue) qs.set('venue', venue)
      fetch(`/api/vibe-prior?${qs.toString()}`, { signal: ctrl.signal })
        .then((res) => (res.ok ? res.json() : { prior: null }))
        .then((json: { prior: VibePrior | null }) => {
          if (!cancelled) setPrior(json.prior ?? null)
        })
        .catch(() => {
          // aborted or network error — leave the last good suggestion in place
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 400)

    return () => {
      cancelled = true
      ctrl.abort()
      clearTimeout(timer)
    }
  }, [genresKey, venue])

  return { prior, loading }
}
