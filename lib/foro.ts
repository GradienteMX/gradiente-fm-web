'use client'

// ── Frontend-only foro store ────────────────────────────────────────────────
//
// Imageboard-style forum. SessionStorage-backed, layered on top of seed data
// in [[mockForo]]. New threads + replies created this session "shadow" the
// merged catalog read.
//
// Bump rules:
//   - New thread: bumpedAt = createdAt; appears at top of catalog.
//   - New reply: parent thread's bumpedAt = reply.createdAt; thread floats up.
//
// No reactions, no likes, no engagement scoring. The only signal is reply
// count, which is computed at read time from the merged reply list.
//
// When the real backend lands (see [[Supabase Migration]]):
//   - Replace `useThreads` / `useThread` / `useReplies` with Supabase selects
//   - Replace `addThread` / `addReply` with insert RPCs (server bumps parent)
//   - Listener pattern → Supabase Realtime subscriptions

import { useEffect, useState } from 'react'
import type { ForoDeletion, ForoReply, ForoThread } from './types'
import {
  MOCK_REPLIES,
  MOCK_THREADS,
  getRepliesForThread,
  getReplyCount,
} from './mockForo'

const STORAGE_KEY = 'gradiente:foro'

// Hard cap on visible threads in the catalog (per spec).
export const FORO_THREAD_CAP = 30

interface SessionState {
  // Threads created this session — appended to MOCK_THREADS for the catalog.
  addedThreads: ForoThread[]
  // Replies created this session — appended to MOCK_REPLIES per thread.
  addedReplies: ForoReply[]
  // Per-thread bumpedAt overrides written when a session reply lands on a
  // mock thread (mock threads are immutable, so we shadow the field).
  bumpOverrides: Record<string, string>
  // Per-post deletion overrides (keyed by thread or reply id). Mods set
  // these via tombstoneThread / tombstoneReply; read-time merge applies
  // them on top of the seed/session record. Tombstoned threads are also
  // hidden from the catalog (but reachable by direct URL).
  tombstones: Record<string, ForoDeletion>
}

function emptyState(): SessionState {
  return { addedThreads: [], addedReplies: [], bumpOverrides: {}, tombstones: {} }
}

function readSession(): SessionState {
  if (typeof window === 'undefined') return emptyState()
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw)
    return {
      addedThreads: Array.isArray(parsed?.addedThreads) ? parsed.addedThreads : [],
      addedReplies: Array.isArray(parsed?.addedReplies) ? parsed.addedReplies : [],
      bumpOverrides:
        parsed?.bumpOverrides && typeof parsed.bumpOverrides === 'object'
          ? parsed.bumpOverrides
          : {},
      tombstones:
        parsed?.tombstones && typeof parsed.tombstones === 'object'
          ? parsed.tombstones
          : {},
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

const listeners = new Set<() => void>()
function notify() {
  listeners.forEach((fn) => fn())
}

// ── Read API ────────────────────────────────────────────────────────────────

function applyThreadTombstone(t: ForoThread, s: SessionState): ForoThread {
  const stone = s.tombstones[t.id]
  return stone ? { ...t, deletion: stone } : t
}

function applyReplyTombstone(r: ForoReply, s: SessionState): ForoReply {
  const stone = s.tombstones[r.id]
  return stone ? { ...r, deletion: stone } : r
}

// Returns the merged thread list (mock + session) sorted by bumpedAt desc,
// truncated to FORO_THREAD_CAP. Mock threads have their bumpedAt shadowed by
// session bumpOverrides so a reply lands the parent at the top. Tombstoned
// threads are excluded from the catalog so the moderator's pruning is
// visible in the list view (the thread URL still resolves and renders the
// tombstone).
function getMergedThreads(): ForoThread[] {
  const s = readSession()
  const merged = [
    ...MOCK_THREADS.map((t) => ({
      ...t,
      bumpedAt: s.bumpOverrides[t.id] ?? t.bumpedAt,
    })),
    ...s.addedThreads,
  ]
    .map((t) => applyThreadTombstone(t, s))
    .filter((t) => !t.deletion)
  merged.sort((a, b) => b.bumpedAt.localeCompare(a.bumpedAt))
  return merged.slice(0, FORO_THREAD_CAP)
}

function getMergedReplies(): ForoReply[] {
  const s = readSession()
  return [...MOCK_REPLIES, ...s.addedReplies].map((r) => applyReplyTombstone(r, s))
}

export function getThreadById(id: string): ForoThread | null {
  const s = readSession()
  const mock = MOCK_THREADS.find((t) => t.id === id)
  if (mock) {
    return applyThreadTombstone(
      { ...mock, bumpedAt: s.bumpOverrides[id] ?? mock.bumpedAt },
      s,
    )
  }
  const session = s.addedThreads.find((t) => t.id === id)
  return session ? applyThreadTombstone(session, s) : null
}

export function getRepliesForThreadId(threadId: string): ForoReply[] {
  return getRepliesForThread(threadId, getMergedReplies())
}

export function getReplyCountForThread(threadId: string): number {
  return getReplyCount(threadId, getMergedReplies())
}

// ── Write API ───────────────────────────────────────────────────────────────

export function addThread(thread: ForoThread) {
  const s = readSession()
  s.addedThreads = [...s.addedThreads, thread]
  writeSession(s)
  notify()
}

export function addReply(reply: ForoReply) {
  const s = readSession()
  s.addedReplies = [...s.addedReplies, reply]
  // Bump the parent thread.
  s.bumpOverrides = { ...s.bumpOverrides, [reply.threadId]: reply.createdAt }
  // If the parent is a session thread, mutate it in place too so its
  // bumpedAt stays consistent across reads.
  s.addedThreads = s.addedThreads.map((t) =>
    t.id === reply.threadId ? { ...t, bumpedAt: reply.createdAt } : t,
  )
  writeSession(s)
  notify()
}

// ── Moderation (tombstones) ─────────────────────────────────────────────────
//
// Soft-delete only. Body is preserved in storage so quote-links still
// resolve; the UI replaces the body with a `//ELIMINADO·POR·MODERACIÓN`
// stub showing the moderator's stated reason. Catalog hides tombstoned
// threads, but `?thread=<id>` still resolves and renders the tombstone.
//
// Callers MUST gate via canModerate(currentUser) — this writer doesn't
// re-check; the storage layer trusts the UI to enforce the role check.
// Real backend will enforce in RLS.

export function tombstoneThread(
  threadId: string,
  moderatorId: string,
  reason: string,
) {
  const s = readSession()
  s.tombstones = {
    ...s.tombstones,
    [threadId]: {
      moderatorId,
      reason,
      deletedAt: new Date().toISOString(),
    },
  }
  writeSession(s)
  notify()
}

export function tombstoneReply(
  replyId: string,
  moderatorId: string,
  reason: string,
) {
  const s = readSession()
  s.tombstones = {
    ...s.tombstones,
    [replyId]: {
      moderatorId,
      reason,
      deletedAt: new Date().toISOString(),
    },
  }
  writeSession(s)
  notify()
}

// Revert a tombstone — drops the deletion record so the post reappears.
// Catalog re-includes the thread; reply body restores. Same gating model
// as the writers above: caller must hold canModerate. Real backend will
// enforce in RLS.
//
// One function works for both threads and replies because the tombstone map
// is keyed by post id, not type.
export function clearTombstone(postId: string) {
  const s = readSession()
  if (!(postId in s.tombstones)) return
  const { [postId]: _, ...rest } = s.tombstones
  s.tombstones = rest
  writeSession(s)
  notify()
}

// ── Session id generation ───────────────────────────────────────────────────
//
// Mirrors the mock id format so quote-links read the same in posts the user
// authors as in seed posts. Mock threads use `fr-NNN` (e.g. `fr-003`); mock
// replies use `fp-{threadShort}-NN` (e.g. `fp-003-02`). Session-authored ids
// substitute the trailing number with `s{NN}` so they never collide with
// seeds even if seed numbering is extended later.

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

// Strip the `fr-` prefix to get the short thread reference used in reply ids.
// Works for both mock threads (`fr-003` → `003`) and session threads
// (`fr-s01` → `s01`).
function threadShortRef(threadId: string): string {
  return threadId.replace(/^fr-/, '')
}

// Reads the current store to determine the next session number. Callers
// don't need to pass a count — the store is the source of truth.
export function newThreadId(): string {
  const s = readSession()
  return `fr-s${pad2(s.addedThreads.length + 1)}`
}

export function newReplyId(threadId: string): string {
  const existing = getRepliesForThreadId(threadId).length
  return `fp-${threadShortRef(threadId)}-s${pad2(existing + 1)}`
}

// ── React hooks ─────────────────────────────────────────────────────────────

export function useThreads(): ForoThread[] {
  const [items, setItems] = useState<ForoThread[]>([])
  useEffect(() => {
    const refresh = () => setItems(getMergedThreads())
    refresh()
    listeners.add(refresh)
    return () => {
      listeners.delete(refresh)
    }
  }, [])
  return items
}

export function useThread(threadId: string | null): ForoThread | null {
  const [thread, setThread] = useState<ForoThread | null>(null)
  useEffect(() => {
    if (!threadId) {
      setThread(null)
      return
    }
    const refresh = () => setThread(getThreadById(threadId))
    refresh()
    listeners.add(refresh)
    return () => {
      listeners.delete(refresh)
    }
  }, [threadId])
  return thread
}

export function useReplies(threadId: string | null): ForoReply[] {
  const [items, setItems] = useState<ForoReply[]>([])
  useEffect(() => {
    if (!threadId) {
      setItems([])
      return
    }
    const refresh = () => setItems(getRepliesForThreadId(threadId))
    refresh()
    listeners.add(refresh)
    return () => {
      listeners.delete(refresh)
    }
  }, [threadId])
  return items
}

export function useReplyCount(threadId: string): number {
  const [count, setCount] = useState(0)
  useEffect(() => {
    const refresh = () => setCount(getReplyCountForThread(threadId))
    refresh()
    listeners.add(refresh)
    return () => {
      listeners.delete(refresh)
    }
  }, [threadId])
  return count
}
