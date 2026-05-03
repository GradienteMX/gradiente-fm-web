'use client'

// ── Comment store (transitional) ────────────────────────────────────────────
//
// MIGRATION STATE (2026-05-03):
//   - Reads (`useComments`, getCommentsForItemMerged) → moved to
//     [[useComments]] in lib/hooks/useComments.ts (Supabase reads).
//   - Writes (toggleReaction, toggleSavedComment) → migrated to API calls.
//   - Tombstones (tombstoneComment, clearCommentDeletion) → API
//     (POST/DELETE /api/comments/[id]/tombstone), then invalidateAllComments
//     to trigger refetch. RLS gates self-only-within-15min OR mod/admin
//     any-time via comments_author_edit_window + comments_mod_edit.
//   - Saves cache → lib/savedCommentsCache.ts (module-scoped Set).
//   - addComment → DEAD on the new write path (CommentComposer POSTs
//     directly). Kept for any stragglers; sessionStorage shim returns its
//     own writes only.
//
// `getCommentsForItemMerged` / `useComments` / `useSavedComments` /
// `getSavedComments` exports below STILL read MOCK + session for the
// dashboard saved-comments surface; they'll move to DB in the same
// follow-up. No new callers should use them.

import { useEffect, useState } from 'react'
import type {
  Comment,
  CommentDeletion,
  Reaction,
  ReactionKind,
} from './types'
import { MOCK_COMMENTS } from './mockComments'
import { invalidateAllComments } from './hooks/useComments'
import {
  addSavedCommentIdLocal,
  isCommentSavedSync,
  removeSavedCommentIdLocal,
  subscribeSavedComments,
} from './savedCommentsCache'
import {
  clearReactionOverride,
  setReactionOverride,
} from './reactionsCache'

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
//
// Migrated to API call (2026-05-03). Server-side route handler enforces
// mutual exclusivity by deleting any existing reaction by this user before
// inserting the new one. Optimistic write happens server-side; we
// invalidate the comments column on success so UI re-fetches the truth.
//
// `userId` parameter retained for back-compat — the server uses auth.uid()
// regardless. Caller doesn't need to await; fire-and-forget is fine.
export async function toggleReaction(
  commentId: string,
  _userId: string,
  kind: ReactionKind,
) {
  const uid = currentAuthUid()
  if (!uid) return

  const cached = lastFetchedReactions.get(commentId) ?? []
  const existing = cached.find((r) => r.userId === uid)
  const action: 'clear' | 'set' = existing && existing.kind === kind ? 'clear' : 'set'

  // Optimistic local update — UI flips at click time.
  const optimistic: Reaction[] =
    action === 'clear'
      ? cached.filter((r) => r.userId !== uid)
      : [
          ...cached.filter((r) => r.userId !== uid),
          { userId: uid, kind, createdAt: new Date().toISOString() },
        ]
  setReactionOverride(commentId, optimistic)
  // Keep our local cached truth in sync so a follow-up toggle on the same
  // comment computes against the right baseline.
  lastFetchedReactions.set(commentId, optimistic)

  try {
    const res =
      action === 'clear'
        ? await fetch(`/api/comments/${commentId}/reactions`, { method: 'DELETE' })
        : await fetch(`/api/comments/${commentId}/reactions`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ kind }),
          })
    if (!res.ok) throw new Error('reaction api failed')
    // On success, KEEP the override. The local `comments` React state
    // still has the pre-toggle reactions (we don't refetch), so clearing
    // the override would let the merged view fall back to stale data.
    // The override persists until the next full refetch (load() in
    // useComments), at which point server-fetched data is fresh and the
    // override gets wiped clean — see clearAllReactionOverrides() in load.
  } catch {
    // Rollback: drop the override. The merged view falls back to
    // `comments[i].reactions` which is still the pre-toggle baseline.
    lastFetchedReactions.set(commentId, cached)
    clearReactionOverride(commentId)
  }
}

// Tracks the current authenticated user's id so toggleReaction can decide
// whether the click clears or replaces. Populated by AuthProvider on every
// auth-state change.
let _currentAuthUid: string | null = null
export function setCurrentAuthUidForComments(id: string | null) {
  _currentAuthUid = id
}
function currentAuthUid(): string | null {
  return _currentAuthUid
}

// Last fetched reactions per comment. Populated by useComments() after each
// fetch so toggleReaction can compute whether to POST or DELETE without an
// extra round-trip. Best-effort cache; conservative behaviour on miss.
const lastFetchedReactions = new Map<string, Reaction[]>()
export function recordCommentReactions(comments: Comment[]) {
  for (const c of comments) lastFetchedReactions.set(c.id, c.reactions)
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

// Tombstone a comment (mod-delete OR author self-delete with empty reason).
// Server enforces gating via RLS:
//   - author within 15 min of post (comments_author_edit_window)
//   - mod/admin any time (comments_mod_edit)
// `actorId` is unused on the new path — server sets deletion_moderator_id
// from auth.uid(). Kept in the signature so existing callers don't change.
//
// On success, invalidates all mounted comment columns so the new deletion
// fields are fetched and the Tombstone replaces the body.
export async function tombstoneComment(
  commentId: string,
  _actorId: string,
  reason: string,
) {
  try {
    const res = await fetch(`/api/comments/${commentId}/tombstone`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
    if (!res.ok) return
    invalidateAllComments()
  } catch {
    // Network failure — no UI change to roll back. The user-facing affordance
    // (the BORRAR button) stays in its pre-click state.
  }
}

// Revert a tombstone — clears deletion_at / deletion_moderator_id /
// deletion_reason. RLS allows mods + admins; non-mod authors who self-deleted
// will get a 403 from the policy (USING `deletion_at is null` excludes
// already-deleted rows from the author edit window). UI shows the affordance
// for the actor regardless — the click silently no-ops on RLS denial.
export async function clearCommentDeletion(commentId: string) {
  try {
    const res = await fetch(`/api/comments/${commentId}/tombstone`, {
      method: 'DELETE',
    })
    if (!res.ok) return
    invalidateAllComments()
  } catch {
    // see above
  }
}

// ── Saved comments ──────────────────────────────────────────────────────────

export function isCommentSaved(commentId: string): boolean {
  return isCommentSavedSync(commentId)
}

// Optimistic: update local cache first so the UI flips instantly, then call
// the API. Rollback on failure.
export async function toggleSavedComment(commentId: string) {
  const wasSaved = isCommentSavedSync(commentId)
  if (wasSaved) {
    removeSavedCommentIdLocal(commentId)
    try {
      const res = await fetch(`/api/saves/comments/${commentId}`, { method: 'DELETE' })
      if (!res.ok) addSavedCommentIdLocal(commentId)  // rollback
    } catch {
      addSavedCommentIdLocal(commentId)
    }
  } else {
    addSavedCommentIdLocal(commentId)
    try {
      const res = await fetch(`/api/saves/comments/${commentId}`, { method: 'POST' })
      if (!res.ok) removeSavedCommentIdLocal(commentId)  // rollback
    } catch {
      removeSavedCommentIdLocal(commentId)
    }
  }
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

// Tracks whether `commentId` is in the user's saved set. Subscribes to the
// shared cache (lib/savedCommentsCache) — re-renders when any save/unsave
// fires, including those triggered elsewhere in the tree.
export function useIsCommentSaved(commentId: string): boolean {
  const [saved, setSaved] = useState(() => isCommentSavedSync(commentId))
  useEffect(() => {
    const refresh = () => setSaved(isCommentSavedSync(commentId))
    refresh()
    return subscribeSavedComments(refresh)
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

// useUserRank moved to lib/hooks/useUserRank.ts — backed by the
// `user_rank_signals` SQL view (migration 0005) + a batched
// browser-side cache (lib/userRanksCache.ts). The old in-memory
// implementation read MOCK_COMMENTS + session and always returned
// 'normie' once the comment surface migrated to real DB.
