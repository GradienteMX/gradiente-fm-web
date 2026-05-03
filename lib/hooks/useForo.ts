'use client'

// ── useForo — browser-side foro reads ──────────────────────────────────────
//
// Mirrors lib/hooks/useComments.ts in shape. Three hooks:
//
//   - useThreads()            → catalog list (DB-ordered by bumped_at desc,
//                               capped at FORO_THREAD_CAP client-side).
//   - useThread(threadId)     → single thread.
//   - useReplies(threadId)    → all replies for a thread, ordered created_at.
//
// Each subscribes to a per-key invalidation bus so a successful POST/PATCH
// elsewhere (NewThreadOverlay, ReplyComposer, tombstone routes) can fire
// `invalidateThreadList()` / `invalidateThread(threadId)` and the relevant
// hooks refetch.
//
// Authors fetched alongside posts get pushed into `realUserCache` so
// `useResolvedUser(authorId)` resolves real DB users in PostHeader / etc.
// without prop drilling — same pattern as useComments.

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { setRealUsers } from '@/lib/userOverrides'
import type { Database } from '@/lib/supabase/database.types'
import type { ForoReply, ForoThread, User } from '@/lib/types'

type ThreadRow = Database['public']['Tables']['foro_threads']['Row']
type ReplyRow = Database['public']['Tables']['foro_replies']['Row']
type UserRow = Database['public']['Tables']['users']['Row']

// ── Row mappers (browser-side) ─────────────────────────────────────────────
// Duplicated from lib/data/foro.ts on purpose — server module imports the
// cookies-aware Supabase client which can't be bundled for the browser.

function rowToThread(row: ThreadRow): ForoThread {
  const out: ForoThread = {
    id: row.id,
    authorId: row.author_id,
    subject: row.subject,
    body: row.body,
    imageUrl: row.image_url,
    genres: row.genres,
    createdAt: row.created_at,
    bumpedAt: row.bumped_at,
  }
  if (row.deletion_at && row.deletion_moderator_id) {
    out.deletion = {
      moderatorId: row.deletion_moderator_id,
      reason: row.deletion_reason ?? '',
      deletedAt: row.deletion_at,
    }
  }
  return out
}

function rowToReply(row: ReplyRow): ForoReply {
  const out: ForoReply = {
    id: row.id,
    threadId: row.thread_id,
    authorId: row.author_id,
    body: row.body,
    imageUrl: row.image_url ?? undefined,
    createdAt: row.created_at,
    quotedReplyIds: (row.quoted_reply_ids as string[] | null) ?? undefined,
  }
  if (row.deletion_at && row.deletion_moderator_id) {
    out.deletion = {
      moderatorId: row.deletion_moderator_id,
      reason: row.deletion_reason ?? '',
      deletedAt: row.deletion_at,
    }
  }
  return out
}

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    isMod: row.is_mod || undefined,
    isOG: row.is_og || undefined,
    partnerId: row.partner_id ?? undefined,
    partnerAdmin: row.partner_admin || undefined,
    joinedAt: row.joined_at,
  }
}

// ── Invalidation bus ───────────────────────────────────────────────────────
//
// Two channels: a single broadcast for the catalog (any thread mutation
// can change ordering via the bump trigger), and per-thread for replies +
// tombstones.

type Listener = () => void
const catalogListeners = new Set<Listener>()
const threadListeners = new Map<string, Set<Listener>>()

export function invalidateThreadList() {
  catalogListeners.forEach((fn) => fn())
}

export function invalidateThread(threadId: string) {
  threadListeners.get(threadId)?.forEach((fn) => fn())
  // Bumping a thread also reorders the catalog, so refresh that too.
  invalidateThreadList()
}

// Per-thread broadcast WITHOUT the implicit catalog refresh — used by the
// Realtime channel handler in useThreads, which calls load() for the
// catalog directly. Avoids double-fetching the catalog on every event.
export function invalidateThreadOnly(threadId: string) {
  threadListeners.get(threadId)?.forEach((fn) => fn())
}

function subscribeCatalog(fn: Listener) {
  catalogListeners.add(fn)
  return () => {
    catalogListeners.delete(fn)
  }
}

function subscribeThread(threadId: string, fn: Listener) {
  let set = threadListeners.get(threadId)
  if (!set) {
    set = new Set()
    threadListeners.set(threadId, set)
  }
  set.add(fn)
  return () => {
    set!.delete(fn)
    if (set!.size === 0) threadListeners.delete(threadId)
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function fetchUsersForIds(
  supabase: ReturnType<typeof createClient>,
  ids: Set<string>,
): Promise<User[]> {
  if (ids.size === 0) return []
  const { data } = await supabase
    .from('users')
    .select('*')
    .in('id', [...ids])
  return (data ?? []).map(rowToUser)
}

// ── Hooks ──────────────────────────────────────────────────────────────────

export function useThreads(): ForoThread[] {
  const [threads, setThreads] = useState<ForoThread[]>([])

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    async function load() {
      const { data } = await supabase
        .from('foro_threads')
        .select('*')
        .eq('archived', false)
        .order('bumped_at', { ascending: false })
      if (cancelled) return
      const list = (data ?? []).map(rowToThread)
      // Push thread authors into the user cache so ThreadTile / PostHeader
      // resolve them without per-tile fetches.
      const authorIds = new Set(list.map((t) => t.authorId))
      const users = await fetchUsersForIds(supabase, authorIds)
      if (cancelled) return
      if (users.length > 0) setRealUsers(users)
      setThreads(list)
    }

    void load()
    const unsub = subscribeCatalog(load)

    // Realtime: one channel covers the whole foro from the catalog.
    //   - foro_threads INSERT/UPDATE/DELETE → catalog reorders (the bump
    //     trigger UPDATEs threads, so reply-driven reordering lands here).
    //   - foro_replies INSERT/UPDATE/DELETE → broadcast to the per-thread
    //     bus so ThreadTile reply counts and any open thread overlay all
    //     refresh without each mounting their own websocket. ~1 catalog
    //     channel covers N tiles' worth of reply-count updates.
    const channel = supabase
      .channel('foro:all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'foro_threads' }, (payload) => {
        load()
        // Also bump the per-thread bus so an open ThreadOverlay (useThread)
        // refetches its own row. Use the *Only variant — load() above has
        // already refreshed the catalog; invalidateThread would double it.
        const newId = (payload.new as { id?: string } | null)?.id
        const oldId = (payload.old as { id?: string } | null)?.id
        const id = newId ?? oldId
        if (id) invalidateThreadOnly(id)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'foro_replies' }, (payload) => {
        // Both `new` and `old` carry thread_id depending on event type.
        const newThreadId = (payload.new as { thread_id?: string } | null)?.thread_id
        const oldThreadId = (payload.old as { thread_id?: string } | null)?.thread_id
        const threadId = newThreadId ?? oldThreadId
        // Reply changes get their own catalog bump via the foro_threads
        // event handler above (the bump trigger fires an UPDATE on the
        // parent), so we only need the per-thread broadcast here.
        if (threadId) invalidateThreadOnly(threadId)
      })
      .subscribe()

    return () => {
      cancelled = true
      unsub()
      supabase.removeChannel(channel)
    }
  }, [])

  return threads
}

export function useThread(threadId: string | null): ForoThread | null {
  const [thread, setThread] = useState<ForoThread | null>(null)

  useEffect(() => {
    if (!threadId) {
      setThread(null)
      return
    }
    let cancelled = false
    const supabase = createClient()

    async function load() {
      const { data } = await supabase
        .from('foro_threads')
        .select('*')
        .eq('id', threadId)
        .maybeSingle()
      if (cancelled) return
      const t = data ? rowToThread(data) : null
      if (t) {
        const ids = new Set<string>([t.authorId])
        if (t.deletion?.moderatorId) ids.add(t.deletion.moderatorId)
        const users = await fetchUsersForIds(supabase, ids)
        if (cancelled) return
        if (users.length > 0) setRealUsers(users)
      }
      setThread(t)
    }

    void load()
    const unsub = subscribeThread(threadId, load)

    // Realtime arrives via the foro:all channel in useThreads — its
    // foro_threads handler calls invalidateThreadOnly(id) for the affected
    // row, which fires our per-thread bus subscription above.
    return () => {
      cancelled = true
      unsub()
    }
  }, [threadId])

  return thread
}

export function useReplies(threadId: string | null): ForoReply[] {
  const [replies, setReplies] = useState<ForoReply[]>([])

  useEffect(() => {
    if (!threadId) {
      setReplies([])
      return
    }
    let cancelled = false
    const supabase = createClient()

    async function load() {
      const { data } = await supabase
        .from('foro_replies')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true })
      if (cancelled) return
      const list = (data ?? []).map(rowToReply)
      const ids = new Set<string>()
      for (const r of list) {
        ids.add(r.authorId)
        if (r.deletion?.moderatorId) ids.add(r.deletion.moderatorId)
      }
      const users = await fetchUsersForIds(supabase, ids)
      if (cancelled) return
      if (users.length > 0) setRealUsers(users)
      setReplies(list)
    }

    void load()
    const unsub = subscribeThread(threadId, load)

    // Realtime arrives via the foro:all channel in useThreads, which
    // broadcasts foro_replies events to invalidateThread(threadId) — the
    // bus we're already subscribed to. No extra channel needed here.
    return () => {
      cancelled = true
      unsub()
    }
  }, [threadId])

  return replies
}

// ── Reply count, derived from useReplies — same shape consumers expect ────
//
// Catalog tiles call this per-thread; rather than mounting a full
// useReplies on every tile (N round-trips), we fetch a count via head:true
// + count: 'exact'. Only one query per thread; result subscribes to the
// same per-thread invalidation key.

export function useReplyCount(threadId: string): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    async function load() {
      const { count: c } = await supabase
        .from('foro_replies')
        .select('*', { count: 'exact', head: true })
        .eq('thread_id', threadId)
      if (cancelled) return
      setCount(c ?? 0)
    }

    void load()
    const unsub = subscribeThread(threadId, load)

    // Realtime arrives via the foro:all channel — see comment in
    // useReplies. ~30 tiles share that single websocket instead of each
    // opening their own.
    return () => {
      cancelled = true
      unsub()
    }
  }, [threadId])

  return count
}
