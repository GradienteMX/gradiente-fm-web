'use client'

// ── Drafts — module-level cache ─────────────────────────────────────────────
//
// The user's drafts (rows from `public.drafts` where author_id = auth.uid())
// are loaded once after auth (AuthProvider effect — see useAuth) and kept in
// this module-scoped Map keyed by the contained ContentItem.id (NOT the
// drafts.id uuid).
//
// Why key by ContentItem.id:
//   - The composer creates an id once via `newItemId(type)` and reuses it on
//     every save so subsequent commits UPDATE the same row.
//   - All call sites (Fields.tsx, PublishConfirmOverlay, OverlayShell, etc.)
//     look up by ContentItem.id; making the cache key match means
//     `getItemById(id)` stays a sync read.
//   - The drafts.id uuid is purely an internal PK; it never leaves the API.
//
// Writers (upsertItem in lib/drafts.ts, called by the composer) update the
// cache optimistically, then the API confirms; subscribers (useDraftItems)
// re-render via the listener pattern.
//
// Symmetric with lib/savedCommentsCache.ts / lib/itemSavesCache.ts /
// lib/pollVotesCache.ts. Cleared on logout via clearDraftsCache().

import type { DraftItem } from './drafts'

const cache = new Map<string, DraftItem>()
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((fn) => fn())
}

// ── Reads ──────────────────────────────────────────────────────────────────

export function getDraftSync(id: string): DraftItem | null {
  return cache.get(id) ?? null
}

export function getAllDraftsSync(): DraftItem[] {
  return Array.from(cache.values())
}

// ── Writes (server truth) ──────────────────────────────────────────────────

// Replace the entire set — used by AuthProvider on auth-state change.
export function setAllDrafts(drafts: Iterable<DraftItem>) {
  cache.clear()
  for (const d of drafts) cache.set(d.id, d)
  notify()
}

// ── Writes (optimistic local) ──────────────────────────────────────────────

export function setDraftLocal(draft: DraftItem) {
  cache.set(draft.id, draft)
  notify()
}

export function removeDraftLocal(id: string) {
  if (!cache.has(id)) return
  cache.delete(id)
  notify()
}

export function clearDraftsCache() {
  if (cache.size === 0) return
  cache.clear()
  notify()
}

// ── Subscription ───────────────────────────────────────────────────────────

export function subscribeDrafts(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
