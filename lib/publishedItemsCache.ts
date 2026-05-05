'use client'

// ── Published items — module-level cache ────────────────────────────────────
//
// The user's own published items (rows from `public.items` where
// created_by = auth.uid()) are loaded by `useMyPublishedItems` and primed
// into this cache so `getItemById` (lib/drafts.ts) can resolve them
// synchronously when the dashboard's "Publicados" UI clicks through to
// the editor.
//
// Without this cache, opening a published item from "Publicados" would
// hit `getItemById` → null → composer hydrates as empty → publishing
// would mint a NEW item.id (instead of reusing the existing one) and
// duplicate the row. See chunk 3 wiki/log entry "edit-published flow".
//
// Symmetric shape with `lib/draftsCache.ts`. Keyed by ContentItem.id.

import type { ContentItem } from './types'

const cache = new Map<string, ContentItem>()
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((fn) => fn())
}

// ── Reads ──────────────────────────────────────────────────────────────────

export function getPublishedItemSync(id: string): ContentItem | null {
  return cache.get(id) ?? null
}

// ── Writes (server truth) ──────────────────────────────────────────────────

// Replace the entire set — used by useMyPublishedItems on every refetch.
export function setAllPublishedItems(items: Iterable<ContentItem>) {
  cache.clear()
  for (const it of items) cache.set(it.id, it)
  notify()
}

export function clearPublishedItemsCache() {
  if (cache.size === 0) return
  cache.clear()
  notify()
}

// Optimistic per-id removal — used by the delete flow so the dashboard's
// "Publicados" grid drops the tile before the API round-trip completes.
// router.refresh() refetches `useMyPublishedItems` and primes the cache
// from server truth shortly after.
export function removePublishedItemLocal(id: string) {
  if (!cache.has(id)) return
  cache.delete(id)
  notify()
}

// ── Subscription ───────────────────────────────────────────────────────────

export function subscribePublishedItems(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
