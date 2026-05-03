'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { recordCommentReactions } from '@/lib/comments'
import {
  clearAllReactionOverrides,
  getReactionOverride,
  subscribeReactions,
} from '@/lib/reactionsCache'
import type { Database } from '@/lib/supabase/database.types'
import type { Comment, Reaction, User } from '@/lib/types'

type CommentRow = Database['public']['Tables']['comments']['Row']
type ReactionRow = Database['public']['Tables']['comment_reactions']['Row']
type UserRow = Database['public']['Tables']['users']['Row']

interface CommentWithReactions extends CommentRow {
  comment_reactions: ReactionRow[]
}

// ── Row mappers (browser-side) ──────────────────────────────────────────────
// Duplicated from lib/data/{comments,users}.ts on purpose — those modules
// can't be imported into client bundles because they pull in the server
// supabase client (which uses next/headers). Tiny duplication, localized to
// the row shape.

function rowToComment(row: CommentWithReactions): Comment {
  const reactions: Reaction[] = (row.comment_reactions ?? []).map((r) => ({
    userId: r.user_id,
    kind: r.kind,
    createdAt: r.created_at,
  }))
  const out: Comment = {
    id: row.id,
    contentItemId: row.item_id,
    parentId: row.parent_id,
    authorId: row.author_id,
    body: row.body,
    createdAt: row.created_at,
    editedAt: row.edited_at ?? undefined,
    reactions,
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

// ── Comment-list invalidation bus ───────────────────────────────────────────
//
// router.refresh() handles SERVER component re-renders, but client-component
// data fetching (like our overlay-mounted comments column) doesn't see it.
// After a successful comment POST / reaction toggle / tombstone, callers
// dispatch `invalidateComments(itemId)`; every `useComments(itemId)` hook
// listening for that itemId re-fetches.
//
// Lightweight EventTarget — no external deps. Realtime channels (Supabase)
// can layer on top later for cross-client live updates.

type Listener = () => void
const listeners = new Map<string, Set<Listener>>()  // itemId → set of refetchers

export function invalidateComments(itemId: string) {
  listeners.get(itemId)?.forEach((fn) => fn())
}

// Broadcast variant — used by handlers that don't know which itemId is
// affected (e.g. toggleReaction, which works off commentId only). At our
// scale ≤1 overlay open at a time, so this re-fetches at most one column.
export function invalidateAllComments() {
  listeners.forEach((set) => set.forEach((fn) => fn()))
}

function subscribe(itemId: string, fn: Listener) {
  let set = listeners.get(itemId)
  if (!set) {
    set = new Set()
    listeners.set(itemId, set)
  }
  set.add(fn)
  return () => {
    set!.delete(fn)
    if (set!.size === 0) listeners.delete(itemId)
  }
}

// ── useComments — fetches comment list + author profiles for an item ───────
//
// Returns { comments, usersById, loading }. Author lookups are batched — we
// gather every distinct authorId across the comments + their tombstone
// moderators, then fetch the matching `users` rows in one query.

export interface UseCommentsResult {
  comments: Comment[]
  usersById: Map<string, User>
  loading: boolean
}

export function useComments(itemId: string): UseCommentsResult {
  const [comments, setComments] = useState<Comment[]>([])
  const [usersById, setUsersById] = useState<Map<string, User>>(new Map())
  const [loading, setLoading] = useState(true)
  // Bumps every time the reactions-override cache changes so the memo
  // below recomputes. Cheap — a counter, no comparison.
  const [reactionsTick, setReactionsTick] = useState(0)
  useEffect(
    () => subscribeReactions(() => setReactionsTick((n) => n + 1)),
    []
  )

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    async function load() {
      setLoading(true)
      const { data: rows } = await supabase
        .from('comments')
        .select('*, comment_reactions(*)')
        .eq('item_id', itemId)
        .order('created_at', { ascending: true })
      if (cancelled) return

      const list = ((rows as CommentWithReactions[] | null) ?? []).map(rowToComment)

      // Collect every user id referenced — authors + deletion moderators.
      const ids = new Set<string>()
      for (const c of list) {
        ids.add(c.authorId)
        if (c.deletion?.moderatorId) ids.add(c.deletion.moderatorId)
      }

      let users = new Map<string, User>()
      if (ids.size > 0) {
        const { data: userRows } = await supabase
          .from('users')
          .select('*')
          .in('id', [...ids])
        for (const r of userRows ?? []) users.set(r.id, rowToUser(r))
      }
      if (cancelled) return

      // Stash latest reactions so toggleReaction (in lib/comments.ts) knows
      // whether the click clears or replaces without an extra round-trip.
      recordCommentReactions(list)

      // Server-fetched reactions are now the latest truth — wipe any
      // outstanding optimistic overrides so we don't mask future updates
      // (e.g. another user's reaction landing via a later refetch).
      clearAllReactionOverrides()

      setComments(list)
      setUsersById(users)
      setLoading(false)
    }

    load()
    const unsub = subscribe(itemId, load)

    // Realtime: refetch on any insert/update/delete to comments for this
    // item, OR any reaction change anywhere (filter not viable since
    // comment_reactions has no item_id). The fan-out cost of unrelated
    // reaction events is small — refetch is item-scoped.
    const channel = supabase
      .channel(`comments:${itemId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comments', filter: `item_id=eq.${itemId}` },
        () => load(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comment_reactions' },
        () => load(),
      )
      .subscribe()

    return () => {
      cancelled = true
      unsub()
      supabase.removeChannel(channel)
    }
  }, [itemId])

  // Apply optimistic reaction overrides. The override Map is consulted on
  // every comment in the list; if an entry exists, it replaces that
  // comment's reactions. Falls through to server-fetched reactions when
  // no override is present (post-confirmation, post-refetch).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const merged = useMemo(() => {
    return comments.map((c) => {
      const override = getReactionOverride(c.id)
      return override ? { ...c, reactions: override } : c
    })
  }, [comments, reactionsTick])

  return { comments: merged, usersById, loading }
}
