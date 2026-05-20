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
