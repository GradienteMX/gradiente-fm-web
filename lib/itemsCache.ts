'use client'

// ── Items — slug-keyed client cache ─────────────────────────────────────────
//
// Bridge between server-rendered item lists (`getItems()` on the home/type
// pages) and client-only consumers that need to look an item up by slug
// without re-fetching (most importantly OverlayRouter, which resolves
// `?item=<slug>` against this cache).
//
// Populated from `ContentGrid` on every render — every page that renders
// items pushes them through. Survives client-side navigations because the
// module is shared across pages; clearing only happens on a full reload.
// Symmetric with `realUserCache` in lib/userOverrides.ts.

import type { ContentItem } from './types'

const cache = new Map<string, ContentItem>()
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((fn) => fn())
}

export function recordItems(items: ContentItem[]) {
  if (items.length === 0) return
  for (const item of items) cache.set(item.slug, item)
  notify()
}

export function getItemBySlugSync(slug: string): ContentItem | null {
  return cache.get(slug) ?? null
}

// Snapshot read of every item the client has seen this session. Used by
// PartnerOverlay to surface a partner's body of //PRESENTA-attributed work
// without needing a dedicated server fetch — partners draw from whatever the
// active page already streamed in. Returns a fresh array so callers can
// filter/sort without mutating shared state.
export function getAllItemsSync(): ContentItem[] {
  return Array.from(cache.values())
}

export function subscribeItems(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

// ── Related content — vibe first, grid neighborhood second ─────────────────
//
// The "SIGUIENTES / LECTURA RELACIONADA" rails at the foot of overlays.
// Candidates come from the REAL items the client has already streamed (this
// cache), not from mock data. Ranking is deliberately simple:
//   1. Vibe closeness EXCLUSIVELY — |candidate vibe center − item vibe center|.
//   2. Tie-break: the candidate most directly BELOW the current item in the
//      grid (next-lower HP). Anything ABOVE sorts after everything below,
//      nearest first. Grid position ≈ HP prominence, the same signal the
//      mosaic lays out by.
export function getRelatedByVibe(
  item: ContentItem,
  opts: { types?: ContentItem['type'][]; limit?: number } = {},
): ContentItem[] {
  const { types, limit = 3 } = opts
  const center = (i: ContentItem) => (i.vibeMin + i.vibeMax) / 2
  const c0 = center(item)
  const hp0 = item.hp ?? 0
  // "Below in the grid" = lower HP. Below beats above; smaller drop first.
  const gridRank = (c: ContentItem) => {
    const drop = hp0 - (c.hp ?? 0)
    return drop >= 0 ? drop : 1e6 - drop
  }
  return getAllItemsSync()
    .filter(
      (c) =>
        c.id !== item.id &&
        c.type !== 'partner' &&
        (!types || types.includes(c.type)),
    )
    .sort((a, b) => {
      const dv = Math.abs(center(a) - c0) - Math.abs(center(b) - c0)
      if (dv !== 0) return dv
      return gridRank(a) - gridRank(b)
    })
    .slice(0, limit)
}
