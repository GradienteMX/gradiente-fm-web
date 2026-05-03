'use client'

// ── Reactions — optimistic-update cache ────────────────────────────────────
//
// `comment.reactions` comes from the server fetch (lib/hooks/useComments).
// When the user toggles `!` or `?`, we update this cache immediately and
// notify subscribers — so the UI flips at click time, not after the
// round-trip. lib/comments.ts toggleReaction then calls the API in the
// background; rollback on failure.
//
// Mirrors lib/savedCommentsCache exactly. Same listener pattern; same
// optimistic-then-confirm shape.

import type { Reaction } from './types'

// commentId → optimistic reactions array (overrides the server's value
// while the entry is present). Cleared on successful API confirmation OR
// on next full refetch.
const overrides = new Map<string, Reaction[]>()
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((fn) => fn())
}

export function getReactionOverride(commentId: string): Reaction[] | undefined {
  return overrides.get(commentId)
}

export function setReactionOverride(commentId: string, reactions: Reaction[]) {
  overrides.set(commentId, reactions)
  notify()
}

export function clearReactionOverride(commentId: string) {
  if (!overrides.has(commentId)) return
  overrides.delete(commentId)
  notify()
}

// Wipe every override — called by useComments after a full refetch lands,
// since server-fetched reactions are now the latest truth and any
// outstanding overrides could only mask other users' updates.
export function clearAllReactionOverrides() {
  if (overrides.size === 0) return
  overrides.clear()
  notify()
}

export function subscribeReactions(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
