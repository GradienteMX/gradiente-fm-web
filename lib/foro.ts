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
import type { ForoReply, ForoThread } from './types'
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
}

function emptyState(): SessionState {
  return { addedThreads: [], addedReplies: [], bumpOverrides: {} }
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

// Returns the merged thread list (mock + session) sorted by bumpedAt desc,
// truncated to FORO_THREAD_CAP. Mock threads have their bumpedAt shadowed by
// session bumpOverrides so a reply lands the parent at the top.
function getMergedThreads(): ForoThread[] {
  const s = readSession()
  const merged = [
    ...MOCK_THREADS.map((t) => ({
      ...t,
      bumpedAt: s.bumpOverrides[t.id] ?? t.bumpedAt,
    })),
    ...s.addedThreads,
  ]
  merged.sort((a, b) => b.bumpedAt.localeCompare(a.bumpedAt))
  return merged.slice(0, FORO_THREAD_CAP)
}

function getMergedReplies(): ForoReply[] {
  const s = readSession()
  return [...MOCK_REPLIES, ...s.addedReplies]
}

export function getThreadById(id: string): ForoThread | null {
  const s = readSession()
  const mock = MOCK_THREADS.find((t) => t.id === id)
  if (mock) {
    return { ...mock, bumpedAt: s.bumpOverrides[id] ?? mock.bumpedAt }
  }
  return s.addedThreads.find((t) => t.id === id) ?? null
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
