'use client'

// ── Saved items — module-level cache ────────────────────────────────────────
//
// The user's saved-item IDs are loaded once after auth (AuthProvider →
// `setSavedItemIds(...)`) and kept in this module-scoped Set so synchronous
// queries (`isItemSaved(id)` from lib/saves.ts) stay fast and hookless
// rendering works.
//
// Symmetric with lib/savedCommentsCache.ts. Writers (toggleSavedItem) update
// the cache optimistically, then the API confirms; subscribers
// (useIsItemSaved) re-render via the listener pattern below.

const cache = new Set<string>()
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((fn) => fn())
}

export function getSavedItemIds(): ReadonlySet<string> {
  return cache
}

export function isItemSavedSync(itemId: string): boolean {
  return cache.has(itemId)
}

// Replace the entire set — used by AuthProvider on auth-state change.
export function setSavedItemIds(ids: Iterable<string>) {
  cache.clear()
  for (const id of ids) cache.add(id)
  notify()
}

export function addSavedItemIdLocal(id: string) {
  if (cache.has(id)) return
  cache.add(id)
  notify()
}

export function removeSavedItemIdLocal(id: string) {
  if (!cache.has(id)) return
  cache.delete(id)
  notify()
}

export function clearSavedItemIds() {
  if (cache.size === 0) return
  cache.clear()
  notify()
}

export function subscribeSavedItems(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
