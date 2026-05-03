'use client'

// ── Saved comments — module-level cache ─────────────────────────────────────
//
// The user's saved-comment IDs are loaded once after auth (AuthProvider →
// `loadSavedCommentIds()`) and kept in this module-scoped Set so synchronous
// queries (`isCommentSaved(id)` from lib/comments.ts) stay fast and
// hookless rendering works.
//
// Writers (toggleSavedComment) update the cache optimistically, then the API
// confirms; subscribers (useIsCommentSaved) re-render via the listener
// pattern below.

const cache = new Set<string>()
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((fn) => fn())
}

export function getSavedCommentIds(): ReadonlySet<string> {
  return cache
}

export function isCommentSavedSync(commentId: string): boolean {
  return cache.has(commentId)
}

// Replace the entire set — used by AuthProvider on auth-state change.
export function setSavedCommentIds(ids: Iterable<string>) {
  cache.clear()
  for (const id of ids) cache.add(id)
  notify()
}

export function addSavedCommentIdLocal(id: string) {
  if (cache.has(id)) return
  cache.add(id)
  notify()
}

export function removeSavedCommentIdLocal(id: string) {
  if (!cache.has(id)) return
  cache.delete(id)
  notify()
}

export function clearSavedCommentIds() {
  if (cache.size === 0) return
  cache.clear()
  notify()
}

export function subscribeSavedComments(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
