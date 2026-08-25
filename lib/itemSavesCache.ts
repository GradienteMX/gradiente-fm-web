'use client'

// ── Saved items — module-level cache ────────────────────────────────────────
//
// The user's saved-item IDs are loaded once after auth (AuthProvider →
// `setSavedItemEntries(...)`) and kept in this module-scoped Map so
// synchronous queries (`isItemSaved(id)` from lib/saves.ts) stay fast and
// hookless rendering works.
//
// The Map carries `saved_at` per id (ISO timestamptz, or null when unknown)
// so surfaces that order by save-recency (dashboard GUARDADOS) are truthful
// instead of proxying publishedAt. The historical Set-style API
// (setSavedItemIds / getSavedItemIds / add / remove) is preserved unchanged
// for existing consumers.
//
// Notifications are PER-KEY: saving/unsaving item X notifies only the
// subscribers watching X (plus any global "any-change" subscribers), so one
// toggle re-renders ~1 SavedBadge instead of every badge on the page (the home
// grid mounts ~140). Bulk changes (auth swap / clear) notify everyone.
//
// Symmetric with lib/savedCommentsCache.ts.

// itemId → saved_at (ISO string from user_saves.saved_at; null = unknown,
// e.g. seeded through the legacy ids-only setter).
const cache = new Map<string, string | null>()
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

export interface SavedItemEntry {
  itemId: string
  savedAt: string | null
}

export function getSavedItemIds(): ReadonlySet<string> {
  return new Set(cache.keys())
}

// Full id → saved_at view for recency-aware consumers.
export function getSavedItemEntries(): ReadonlyMap<string, string | null> {
  return cache
}

export function getSavedItemSavedAt(itemId: string): string | null {
  return cache.get(itemId) ?? null
}

export function isItemSavedSync(itemId: string): boolean {
  return cache.has(itemId)
}

// Replace the entire set with timestamped entries — used by AuthProvider on
// auth-state change (selects `item_id, saved_at`).
export function setSavedItemEntries(entries: Iterable<SavedItemEntry>) {
  cache.clear()
  for (const { itemId, savedAt } of entries) cache.set(itemId, savedAt)
  notifyAll()
}

// Legacy ids-only bulk replace (savedAt unknown). Kept for back-compat.
export function setSavedItemIds(ids: Iterable<string>) {
  cache.clear()
  for (const id of ids) cache.set(id, null)
  notifyAll()
}

// Optimistic local save. Stamps client "now" — indistinguishable in practice
// from the server's `saved_at default now()`, and honest for recency ordering.
export function addSavedItemIdLocal(id: string) {
  if (cache.has(id)) return
  cache.set(id, new Date().toISOString())
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
