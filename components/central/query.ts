'use client'

/**
 * Central keeps every view state in the URL — tab, window, filters, the open
 * dossier — so a view bookmarks, survives Back from «Ver en público», and can
 * be handed to another admin. Writes go through the native History API,
 * which Next folds into `useSearchParams` without a server round trip (the
 * same mechanism Lectura uses for `?item=`).
 */

import { useCallback } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export type QueryPatch = Record<string, string | number | null | undefined>

export function useQuery() {
  const params = useSearchParams()
  const pathname = usePathname() ?? '/central'

  const get = useCallback((k: string) => params.get(k), [params])

  const set = useCallback(
    (patch: QueryPatch, mode: 'replace' | 'push' = 'replace') => {
      const sp = new URLSearchParams(window.location.search)
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === undefined || v === '') sp.delete(k)
        else sp.set(k, String(v))
      }
      const q = sp.toString()
      const url = q ? `${pathname}?${q}` : pathname
      if (url === `${window.location.pathname}${window.location.search}`) return
      if (mode === 'push') window.history.pushState(null, '', url)
      else window.history.replaceState(null, '', url)
    },
    [pathname],
  )

  return { params, get, set }
}

/** Build an in-Central href (for real links that middle-click and bookmark). */
export function centralHref(patch: Record<string, string | number | null | undefined>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(patch)) if (v !== null && v !== undefined && v !== '') sp.set(k, String(v))
  const q = sp.toString()
  return q ? `/central?${q}` : '/central'
}
