'use client'

// ── Foro store (DB-backed) ─────────────────────────────────────────────────
//
// MIGRATION STATE (2026-05-03):
//   - Reads (`useThreads` / `useThread` / `useReplies` / `useReplyCount`)
//     re-exported from lib/hooks/useForo.ts (Supabase reads + invalidation
//     bus + realUserCache push).
//   - Writes (`createThread` / `createReply`) POST to /api/foro/* and call
//     invalidateThreadList() / invalidateThread(threadId) on success.
//   - Tombstones (`tombstoneThread` / `tombstoneReply` /
//     `clearThreadTombstone` / `clearReplyTombstone`) hit the symmetric
//     POST/DELETE routes; RLS gates author-edit-window OR mod-edit.
//
// The composer surfaces (NewThreadOverlay, ReplyComposer) used to author
// full ForoThread / ForoReply objects with synthetic ids. With real DB
// inserts the id comes back from the server — composers POST input shapes
// instead, get the new id, and route to the thread.

import type { Tag } from './types'
import {
  invalidateThread,
  invalidateThreadList,
  useReplies,
  useReplyCount,
  useThread,
  useThreads,
} from './hooks/useForo'

// Hard cap on visible threads in the catalog (per spec). Enforced
// client-side in ForoCatalog — the DB query returns more, the catalog
// truncates. Kept in this module for back-compat with existing imports.
export const FORO_THREAD_CAP = 30

// Re-export the read hooks so existing consumers (`from '@/lib/foro'`)
// don't change.
export { useThreads, useThread, useReplies, useReplyCount }

// ── Create thread ──────────────────────────────────────────────────────────

export interface CreateThreadInput {
  subject: string
  body: string
  // Ordered gallery — at least one. imageUrls[0] becomes the cover.
  imageUrls: string[]
  genres: string[]
  tags: string[]
}

export type CreateResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

export async function createThread(input: CreateThreadInput): Promise<CreateResult> {
  try {
    const res = await fetch('/api/foro/threads', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return { ok: false, error: body?.error ?? `HTTP ${res.status}` }
    }
    const json = await res.json()
    invalidateThreadList()
    return { ok: true, id: json.thread?.id ?? '' }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'network error' }
  }
}

// ── Custom tags ────────────────────────────────────────────────────────────
//
// The composer's tag list is the static catalog (lib/genres.ts TAGS) unioned
// with whatever users have created (table `foro_tags`, migración 0047).
// Both calls fail soft: if the registry is unavailable the composer still
// works off the static catalog, and a tag the user just typed can still be
// attached to their thread (foro_threads.tags is free-form text[]).

export async function fetchCustomTags(): Promise<Tag[]> {
  try {
    const res = await fetch('/api/foro/tags')
    if (!res.ok) return []
    const json = await res.json()
    const rows: unknown = json?.tags
    if (!Array.isArray(rows)) return []
    return rows
      .filter(
        (t): t is { id: string; name: string } =>
          !!t && typeof t.id === 'string' && typeof t.name === 'string',
      )
      .map((t) => ({ id: t.id, name: t.name, custom: true }))
  } catch {
    return []
  }
}

export type CreateTagResult =
  | { ok: true; tag: Tag }
  | { ok: false; error: string }

export async function createTag(name: string): Promise<CreateTagResult> {
  try {
    const res = await fetch('/api/foro/tags', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: json?.error ?? `HTTP ${res.status}` }
    const tag = json?.tag
    if (!tag || typeof tag.id !== 'string') {
      return { ok: false, error: 'respuesta inválida del servidor' }
    }
    return { ok: true, tag: { id: tag.id, name: tag.name ?? name, custom: true } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'network error' }
  }
}

// ── Create reply ───────────────────────────────────────────────────────────

export interface CreateReplyInput {
  threadId: string
  body: string
  imageUrl?: string
  quotedReplyIds?: string[]
}

export async function createReply(input: CreateReplyInput): Promise<CreateResult> {
  try {
    const res = await fetch(`/api/foro/threads/${input.threadId}/replies`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        body: input.body,
        imageUrl: input.imageUrl,
        quotedReplyIds: input.quotedReplyIds ?? [],
      }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return { ok: false, error: body?.error ?? `HTTP ${res.status}` }
    }
    const json = await res.json()
    // The bump trigger reorders the catalog AND mutates the parent thread —
    // invalidate both. invalidateThread() also broadcasts the catalog.
    invalidateThread(input.threadId)
    return { ok: true, id: json.reply?.id ?? '' }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'network error' }
  }
}

// ── Tombstones ─────────────────────────────────────────────────────────────

export async function tombstoneThread(threadId: string, reason: string) {
  try {
    const res = await fetch(`/api/foro/threads/${threadId}/tombstone`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
    if (res.ok) invalidateThread(threadId)
  } catch {
    // No optimistic state to roll back; surface noise in console only.
  }
}

export async function clearThreadTombstone(threadId: string) {
  try {
    const res = await fetch(`/api/foro/threads/${threadId}/tombstone`, {
      method: 'DELETE',
    })
    if (res.ok) invalidateThread(threadId)
  } catch {}
}

export async function tombstoneReply(replyId: string, threadId: string, reason: string) {
  try {
    const res = await fetch(`/api/foro/replies/${replyId}/tombstone`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
    if (res.ok) invalidateThread(threadId)
  } catch {}
}

export async function clearReplyTombstone(replyId: string, threadId: string) {
  try {
    const res = await fetch(`/api/foro/replies/${replyId}/tombstone`, {
      method: 'DELETE',
    })
    if (res.ok) invalidateThread(threadId)
  } catch {}
}

// ── Back-compat shim ───────────────────────────────────────────────────────
//
// Existing consumers call `clearTombstone(postId)` without distinguishing
// thread vs reply. With separate DB tables we need the kind; if a caller
// can't easily provide it (e.g. inside a generic Tombstone component),
// they can call this and it'll try thread first, then reply. Less efficient
// than the typed variants — prefer those when the kind is known.

export async function clearTombstone(postId: string) {
  try {
    const a = await fetch(`/api/foro/threads/${postId}/tombstone`, { method: 'DELETE' })
    if (a.ok) {
      invalidateThread(postId)
      return
    }
    // Fall through to reply if the thread DELETE failed (e.g. not found
    // because the id is actually a reply). We don't know the parent thread
    // id from the reply alone, so broadcast the catalog as a safety net.
    const b = await fetch(`/api/foro/replies/${postId}/tombstone`, { method: 'DELETE' })
    if (b.ok) invalidateThreadList()
  } catch {}
}
