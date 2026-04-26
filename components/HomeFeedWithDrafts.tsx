'use client'

import { useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import type { ContentItem } from '@/lib/types'
import { useDraftItems } from '@/lib/drafts'
import { ContentGrid } from './ContentGrid'

// Client wrapper around [[ContentGrid]] for the home feed. Two responsibilities:
//
//   1. Merge published session items (from [[useDraftItems]]) into the feed
//      so dashboard publish flow surfaces the new content.
//   2. Read `?pending=<id>` URL param and stamp the matching item with
//      `_pendingConfirm: true` — drives the glitch + corner-confirm UI on
//      the card (see [[ContentCard]] and [[Publish Confirmation Flow]]).
//
// IMPORTANT: pure drafts are NOT shown in the public feed. They're personal
// work-in-progress and belong in the dashboard drafts list (Chunk 2). The
// only exception is the item under active publish review, which we surface
// by id even if it's still in 'draft' state — that's the whole point of
// the pending preview.
//
// When backend lands, swap useDraftItems() for a real published-feed source.
export function HomeFeedWithDrafts({
  items,
  mode = 'home',
}: {
  items: ContentItem[]
  mode?: 'home' | 'category'
}) {
  const drafts = useDraftItems()
  const search = useSearchParams()
  const pendingId = search?.get('pending') ?? null

  const merged = useMemo(() => {
    // Visible session items: published OR the one under pending review.
    const visible = drafts.filter(
      (d) => d._draftState === 'published' || d.id === pendingId,
    )
    let merged: ContentItem[] = items
    if (visible.length > 0) {
      const visibleIds = new Set(visible.map((d) => d.id))
      merged = [...visible, ...items.filter((i) => !visibleIds.has(i.id))]
    }
    if (pendingId) {
      // Stamp the matching item with the transient pending flag — drives the
      // glitch + corner-confirm UI on its card.
      merged = merged.map((i) =>
        i.id === pendingId ? { ...i, _pendingConfirm: true } : i,
      )
    }
    return merged
  }, [drafts, items, pendingId])

  return <ContentGrid items={merged} mode={mode} />
}
