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
import type { Comment, Reaction, ReactionKind } from './types'
import { MOCK_COMMENTS } from './mockComments'

const STORAGE_KEY = 'gradiente:comments'

interface SessionState {
  // Comments authored this session — appended to the merged list per item.
  added: Comment[]
  // Per-comment reaction lists that override the seed data. Keyed by comment id.
  reactionOverrides: Record<string, Reaction[]>
  // Saved comment ids — surfaced in the dashboard's saved-comments section.
  // Per-user keying lands with the real backend; for prototype these are
  // session-scoped and shared across logins within the tab.
  savedIds: string[]
}

function emptyState(): SessionState {
  return { added: [], reactionOverrides: {}, savedIds: [] }
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

export function getCommentsForItemMerged(itemId: string): Comment[] {
  const session = readSession()
  const base = MOCK_COMMENTS.filter((c) => c.contentItemId === itemId)
  const added = session.added.filter((c) => c.contentItemId === itemId)
  return [...base, ...added].map((c) => ({
    ...c,
    reactions: session.reactionOverrides[c.id] ?? c.reactions,
  }))
}

// ── Write API ───────────────────────────────────────────────────────────────

export function addComment(comment: Comment) {
  const s = readSession()
  s.added = [...s.added, comment]
  writeSession(s)
  notify()
}

// Toggle: if (userId, kind) reaction exists on comment, remove it; else add.
// All reaction kinds count toward engagement equally — no kind cancels another.
// See [[No Algorithm]] / "controversy as discussion".
export function toggleReaction(
  commentId: string,
  userId: string,
  kind: ReactionKind,
) {
  const s = readSession()
  const base = s.reactionOverrides[commentId] ?? findBaseReactions(commentId, s)
  const has = base.some((r) => r.userId === userId && r.kind === kind)
  const next: Reaction[] = has
    ? base.filter((r) => !(r.userId === userId && r.kind === kind))
    : [...base, { userId, kind, createdAt: new Date().toISOString() }]
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

// Returns the merged Comment objects (with reactionOverrides applied) for
// every saved id, in save-order (most-recent saves last in storage).
export function getSavedComments(): Comment[] {
  const s = readSession()
  const found: Comment[] = []
  for (const id of s.savedIds) {
    const base =
      MOCK_COMMENTS.find((c) => c.id === id) ??
      s.added.find((c) => c.id === id)
    if (!base) continue
    found.push({
      ...base,
      reactions: s.reactionOverrides[id] ?? base.reactions,
    })
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
