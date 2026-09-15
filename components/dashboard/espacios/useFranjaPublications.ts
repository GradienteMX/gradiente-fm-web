'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ITEM_ROW_SELECT, mapItemRowToContentItem } from '@/lib/dashboard/openItem'
import type { ContentItem } from '@/lib/types'

// Read the team's published history, including work by other members. Drafts
// stay in the owner's existing draft slice; published=true is explicit.
export function useFranjaPublications(franjaId: string | null, refresh: ContentItem[]) {
  const [state, setState] = useState<{ id: string | null; items: ContentItem[]; loading: boolean; error: boolean }>({ id: null, items: [], loading: true, error: false })
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!franjaId) return
    let cancelled = false
    const controller = new AbortController()
    setState((previous) => ({ id: franjaId, items: previous.id === franjaId ? previous.items : [], loading: true, error: false }))
    void (async () => {
      try {
        const { data, error } = await createClient().from('items')
          .select(ITEM_ROW_SELECT)
          .eq('franja_id' as never, franjaId as never)
          .eq('published', true)
          .order('published_at', { ascending: false })
          .abortSignal(controller.signal)
        if (error) throw error
        if (!cancelled) setState({ id: franjaId, items: (data ?? []).map(mapItemRowToContentItem), loading: false, error: false })
      } catch {
        if (!cancelled) setState((previous) => ({ ...previous, loading: false, error: true }))
      }
    })()
    return () => { cancelled = true; controller.abort() }
  }, [franjaId, refresh, retry])
  return { ...state, items: state.id === franjaId ? state.items : [], retry: () => setRetry((value) => value + 1) }
}
