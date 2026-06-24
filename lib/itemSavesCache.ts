'use client'

// ── Saved items — module-level cache ────────────────────────────────────────
//
// The user's saved-item IDs are loaded once after auth (AuthProvider →
// `setSavedItemIds(...)`) and kept in this module-scoped Set so synchronous
// queries (`isItemSaved(id)` from lib/saves.ts) stay fast and hookless
// rendering works.
//
// Notifications are PER-KEY: saving/unsaving item X notifies only the
// subscribers watching X (plus any global "any-change" subscribers), so one
// toggle re-renders ~1 SavedBadge instead of every badge on the page (the home
// grid mounts ~140). Bulk changes (auth swap / clear) notify everyone.
//
// Symmetric with lib/savedCommentsCache.ts.

const cache = new Set<string>()
const listeners = new Set<() => void>() // global: any change
const keyedListeners = new Map<string, Set<() => void>>() // per itemId

function notifyGlobal() {
  listeners.forEach((fn) => fn())
}

// Fire the subscribers watching `id`, plus the global "any-change" subscribers.
function notifyKey(id: string) {
  const set = keyedListeners.get(id)
  if (set) set.forEach((fn) => fn())
  notifyGlobal()
}

// Fire every per-key subscriber + the global ones (bulk set replacement).
function notifyAll() {
  keyedListeners.forEach((set) => set.forEach((fn) => fn()))
  notifyGlobal()
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
  notifyAll()
}

export function addSavedItemIdLocal(id: string) {
  if (cache.has(id)) return
  cache.add(id)
  notifyKey(id)
}

export function removeSavedItemIdLocal(id: string) {
  if (!cache.has(id)) return
  cache.delete(id)
  notifyKey(id)
}

export function clearSavedItemIds() {
  if (cache.size === 0) return
  cache.clear()
  notifyAll()
}

// Global subscription — fires on ANY save/unsave. Use for surfaces that show
// the whole saved set (e.g. dashboard Guardados). Per-card badges should use
// subscribeSavedItem(id, fn) so one toggle doesn't re-render all of them.
export function subscribeSavedItems(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

// Per-item subscription — fires only when `itemId`'s saved state may have
// changed (its own toggle, or a bulk replace). Keeps O(1) badges re-rendering
// per toggle instead of O(n).
export function subscribeSavedItem(itemId: string, fn: () => void): () => void {
  let set = keyedListeners.get(itemId)
  if (!set) {
    set = new Set()
    keyedListeners.set(itemId, set)
  }
  set.add(fn)
  return () => {
    const s = keyedListeners.get(itemId)
    if (!s) return
    s.delete(fn)
    if (s.size === 0) keyedListeners.delete(itemId)
  }
}
