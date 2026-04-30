'use client'

// ── Frontend-only comment store ─────────────────────────────────────────────
//
// Visual-prototype scaffolding for the comment system. Mirrors the shape of
// `drafts.ts`: sessionStorage-backed, survives reloads, dies when the tab
// closes. Layered ON TOP of MOCK_COMMENTS — the user's session "shadows" the
// seed data with their own additions and reaction toggles.
//
// When the real backend (see [[Supabase Migration]]) lands:
//   - Replace `getCommentsForItemMerged` with a Supabase select
//   - Replace `addComment` / `toggleReaction` with insert/upsert RPC calls
//   - Replace listener pattern with Supabase Realtime subscriptions
// Consumers use `useComments` / `addComment` / `toggleReaction` and won't change.

import { useEffect, useState } from 'react'
import type {
  Comment,
  CommentDeletion,
  Reaction,
  ReactionKind,
  UserRank,
} from './types'
import { MOCK_COMMENTS } from './mockComments'
import { getUserRank } from './permissions'

const STORAGE_KEY = 'gradiente:comments'

interface SessionState {
  // Comments authored this session — appended to the merged list per item.
  added: Comment[]
  // Per-comment reaction lists that override the seed data. Keyed by comment id.
  reactionOverrides: Record<string, Reaction[]>
  // Per-mock-comment deletion records (author self-delete or mod delete).
  // Session-added comments carry their own `deletion` field directly; this
  // map shadows the immutable seed comments.
  deletionOverrides?: Record<string, CommentDeletion>
  // Saved comment ids — surfaced in the dashboard's saved-comments section.
  // Per-user keying lands with the real backend; for prototype these are
  // session-scoped and shared across logins within the tab.
  savedIds: string[]
}

function emptyState(): SessionState {
  return { added: [], reactionOverrides: {}, deletionOverrides: {}, savedIds: [] }
}

function readSession(): SessionState {
  if (typeof window === 'undefined') return emptyState()
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw)
    return {
      added: Array.isArray(parsed?.added) ? parsed.added : [],
      reactionOverrides:
        parsed?.reactionOverrides && typeof parsed.reactionOverrides === 'object'
          ? parsed.reactionOverrides
          : {},
      deletionOverrides:
        parsed?.deletionOverrides && typeof parsed.deletionOverrides === 'object'
          ? parsed.deletionOverrides
          : {},
      savedIds: Array.isArray(parsed?.savedIds) ? parsed.savedIds : [],
    }
  } catch {
    return emptyState()
  }
}

function writeSession(s: SessionState) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {}
}

// ── Listener registry — components subscribed via useComments() refresh
// when any session write happens. Cheap because state is small.
const listeners = new Set<() => void>()
function notify() {
  listeners.forEach((fn) => fn())
}

// ── Read API ────────────────────────────────────────────────────────────────

function findBaseReactions(commentId: string, session: SessionState): Reaction[] {
  const inMock = MOCK_COMMENTS.find((c) => c.id === commentId)
  if (inMock) return inMock.reactions
  const inSession = session.added.find((c) => c.id === commentId)
  return inSession?.reactions ?? []
}

function applyOverrides(c: Comment, session: SessionState): Comment {
  const next: Comment = {
    ...c,
    reactions: session.reactionOverrides[c.id] ?? c.reactions,
  }
  // Deletion override: only mock comments need the merge; session-added
  // comments carry `deletion` on the record itself.
  const stone = session.deletionOverrides?.[c.id]
  if (stone && !next.deletion) {
    next.deletion = stone
  }
  return next
}

export function getCommentsForItemMerged(itemId: string): Comment[] {
  const session = readSession()
  const base = MOCK_COMMENTS.filter((c) => c.contentItemId === itemId)
  const added = session.added.filter((c) => c.contentItemId === itemId)
  return [...base, ...added].map((c) => applyOverrides(c, session))
}

// Cross-item merged view — used by getUserRank to count all !/? reactions a
// user has received across the entire comment surface (any content item +
// session-added comments). Heavier than getCommentsForItemMerged but still
// in-memory; cheap for prototype scale.
export function getAllCommentsMerged(): Comment[] {
  const session = readSession()
  return [...MOCK_COMMENTS, ...session.added].map((c) => applyOverrides(c, session))
}

// ── Write API ───────────────────────────────────────────────────────────────

export function addComment(comment: Comment) {
  const s = readSession()
  s.added = [...s.added, comment]
  writeSession(s)
  notify()
}

// Toggle a reaction with mutual exclusivity: a user has at most one reaction
// (! or ?) per comment. Clicking the same kind clears it. Clicking the other
// kind replaces the previous one. This enforces the "pick a side" rule from
// the reaction-palette decision (see lib/types.ts ReactionKind comment).
export function toggleReaction(
  commentId: string,
  userId: string,
  kind: ReactionKind,
) {
  const s = readSession()
  const base = s.reactionOverrides[commentId] ?? findBaseReactions(commentId, s)
  const existing = base.find((r) => r.userId === userId)
  let next: Reaction[]
  if (existing && existing.kind === kind) {
    // Toggling same kind clears it.
    next = base.filter((r) => r.userId !== userId)
  } else {
    // Replace any prior reaction (different kind) with the new one.
    next = [
      ...base.filter((r) => r.userId !== userId),
      { userId, kind, createdAt: new Date().toISOString() },
    ]
  }
  s.reactionOverrides[commentId] = next
  writeSession(s)
  notify()
}

// Helper for callers building new comment objects: returns a stable id with
// a session-only prefix so we never collide with seed ids.
export function newCommentId(): string {
  return `cm-session-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`
}

// ── Tombstones (author self-delete + mod delete) ───────────────────────────
//
// One writer covers both flows. The actor id is stored in `moderatorId`
// regardless of whether they're a mod or the post's author; the rendering
// branch in [[CommentList]]'s Tombstone reads `actorId === comment.authorId`
// to decide between "ELIMINADO POR AUTOR" and "ELIMINADO POR MODERACIÓN +
// reason".
//
// Author self-delete: caller passes the author's id and an empty reason.
// Mod delete: caller passes the moderator's id and a non-empty reason.
//
// The writer trusts the UI to gate (canDeleteOwnComment for self-delete,
// canModerateComment for mod-delete). Real backend enforces in RLS.

// Revert a tombstone — restores the comment body. Mirrors the foro
// `clearTombstone` writer. Caller must hold canModerate OR be the actor
// who set the deletion (so authors can undo their own self-delete).
// Real backend will enforce in RLS.
export function clearCommentDeletion(commentId: string) {
  const s = readSession()
  // Mock-comment override path.
  if (s.deletionOverrides && commentId in s.deletionOverrides) {
    const { [commentId]: _drop, ...rest } = s.deletionOverrides
    s.deletionOverrides = rest
    writeSession(s)
    notify()
    return
  }
  // Session-added comment path — clear the `deletion` field on the record.
  const idx = s.added.findIndex((c) => c.id === commentId)
  if (idx === -1) return
  if (!s.added[idx].deletion) return
  s.added = s.added.map((c, i) =>
    i === idx ? { ...c, deletion: undefined } : c,
  )
  writeSession(s)
  notify()
}

export function tombstoneComment(
  commentId: string,
  actorId: string,
  reason: string,
) {
  const s = readSession()
  // Tombstone overrides the comment via reactionOverrides? No — the comment
  // store doesn't have a deletion-override field today. We add one shaped
  // exactly like reactionOverrides: a per-comment patch applied at read time.
  // To keep churn minimal, store the deletion record directly on the
  // session-added comment when applicable, or in a parallel deletionOverrides
  // map for mock comments.
  const inSession = s.added.findIndex((c) => c.id === commentId)
  if (inSession !== -1) {
    s.added = s.added.map((c, i) =>
      i === inSession
        ? {
            ...c,
            deletion: {
              moderatorId: actorId,
              reason,
              deletedAt: new Date().toISOString(),
            },
          }
        : c,
    )
  } else {
    // Mock comment — write to the override map (added on demand below).
    s.deletionOverrides = {
      ...(s.deletionOverrides ?? {}),
      [commentId]: {
        moderatorId: actorId,
        reason,
        deletedAt: new Date().toISOString(),
      },
    }
  }
  writeSession(s)
  notify()
}

// ── Saved comments ──────────────────────────────────────────────────────────

export function isCommentSaved(commentId: string): boolean {
  return readSession().savedIds.includes(commentId)
}

export function toggleSavedComment(commentId: string) {
  const s = readSession()
  s.savedIds = s.savedIds.includes(commentId)
    ? s.savedIds.filter((id) => id !== commentId)
    : [...s.savedIds, commentId]
  writeSession(s)
  notify()
}

// Returns the merged Comment objects (with reaction + deletion overrides
// applied) for every saved id, in save-order (most-recent saves last in
// storage).
export function getSavedComments(): Comment[] {
  const s = readSession()
  const found: Comment[] = []
  for (const id of s.savedIds) {
    const base =
      MOCK_COMMENTS.find((c) => c.id === id) ??
      s.added.find((c) => c.id === id)
    if (!base) continue
    found.push(applyOverrides(base, s))
  }
  return found
}

// ── React hooks ─────────────────────────────────────────────────────────────

export function useComments(itemId: string): Comment[] {
  const [items, setItems] = useState<Comment[]>([])
  useEffect(() => {
    const refresh = () => setItems(getCommentsForItemMerged(itemId))
    refresh()
    listeners.add(refresh)
    return () => {
      listeners.delete(refresh)
    }
  }, [itemId])
  return items
}

// Tracks whether `commentId` is in the session's saved set. Re-renders on
// any session change. Cheap because savedIds is a small array.
export function useIsCommentSaved(commentId: string): boolean {
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    const refresh = () => setSaved(isCommentSaved(commentId))
    refresh()
    listeners.add(refresh)
    return () => {
      listeners.delete(refresh)
    }
  }, [commentId])
  return saved
}

export function useSavedComments(): Comment[] {
  const [items, setItems] = useState<Comment[]>([])
  useEffect(() => {
    const refresh = () => setItems(getSavedComments())
    refresh()
    listeners.add(refresh)
    return () => {
      listeners.delete(refresh)
    }
  }, [])
  return items
}

// Live-data hook for a user's derived rank. Recomputes when any reaction
// toggles. Returns 'normie' on the server (and pre-hydration) so badges
// don't flash a wrong rank during SSR.
export function useUserRank(userId: string): UserRank {
  const [rank, setRank] = useState<UserRank>('normie')
  useEffect(() => {
    const refresh = () => setRank(getUserRank(userId, getAllCommentsMerged()))
    refresh()
    listeners.add(refresh)
    return () => {
      listeners.delete(refresh)
    }
  }, [userId])
  return rank
}
