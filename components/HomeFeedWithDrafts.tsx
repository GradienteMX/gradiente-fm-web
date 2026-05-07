'use client'

import { useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import type { ContentItem } from '@/lib/types'
import { useDraftItems } from '@/lib/drafts'
import { ContentGrid } from './ContentGrid'

// Client wrapper around [[ContentGrid]] for the home feed. Two responsibilities:
//
//   1. Merge published session items (from [[useDraftItems]]) into the feed
//      so dashboard publish flow surfaces new content immediately. Pure
//      drafts stay hidden — they're personal work-in-progress and live in
//      the dashboard drafts list.
//
//   2. When the user lands here from the publish-confirm overlay, the URL
//      carries `?fresh=<id>`. Scroll the matching card into view, then
//      clear the param so back/forward doesn't re-trigger the scroll.
export function HomeFeedWithDrafts({
  items,
  mode = 'home',
}: {
  items: ContentItem[]
  mode?: 'home' | 'category'
}) {
  const drafts = useDraftItems()
  const search = useSearchParams()
  const freshId = search?.get('fresh') ?? null

  const merged = useMemo(() => {
    const visible = drafts.filter((d) => d._draftState === 'published')
    if (visible.length === 0) return items
    const visibleIds = new Set(visible.map((d) => d.id))
    return [...visible, ...items.filter((i) => !visibleIds.has(i.id))]
  }, [drafts, items])

  // Auto-scroll the just-published card into view. Two scrolls because
  // lazy-loaded `<img>`s above/below shift the layout after the first
  // scroll lands; the second one (post-load) corrects that drift. After
  // we've scheduled both, drop the URL param so back/forward doesn't
  // re-trigger this on subsequent visits.
  useEffect(() => {
    if (!freshId) return
    const find = () =>
      document.querySelector(`[data-card-id="${CSS.escape(freshId)}"]`)
    const scroll = () => {
      const el = find()
      if (el && el instanceof HTMLElement) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
    const t1 = window.setTimeout(scroll, 120)
    const t2 = window.setTimeout(scroll, 800)
    // Strip ?fresh from the URL once the scroll has been scheduled. Use
    // replaceState so back/forward isn't polluted with the transient param.
    const t3 = window.setTimeout(() => {
      if (typeof window === 'undefined') return
      const url = new URL(window.location.href)
      if (url.searchParams.has('fresh')) {
        url.searchParams.delete('fresh')
        window.history.replaceState(
          window.history.state,
          '',
          url.pathname + url.search,
        )
      }
    }, 1000)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.clearTimeout(t3)
    }
  }, [freshId])

  return <ContentGrid items={merged} mode={mode} />
}
