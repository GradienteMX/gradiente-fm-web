'use client'

// ── useSavedComments — dashboard view of the user's saved comment list ─────
//
// The user's saved-comment ids live in lib/savedCommentsCache.ts (loaded
// once after auth). This hook fetches the actual comment rows for those
// ids from `comments`, plus the parent items they belong to (so the
// folder grid in SavedCommentsSection can render thumbnail + title + type
// per article without a separate lookup module).
//
// Returns both lists keyed for the section's existing grouping logic:
//
//   - comments:    Comment[] — sorted by createdAt asc to match the
//                  in-overlay order
//   - itemsById:   Map<itemId, ContentItem> — for FolderTile rendering
//   - loading:     true on first load only (re-fetches on cache change
//                  flip back to false when settled)
//
// Re-fetches whenever savedCommentsCache changes (subscribeSavedComments).

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  getSavedCommentIds,
  subscribeSavedComments,
} from '@/lib/savedCommentsCache'
import { setRealUsers } from '@/lib/userOverrides'
import type { Database } from '@/lib/supabase/database.types'
import type {
  ArticleBlock,
  Comment,
  ContentItem,
  Footnote,
  MarketplaceListing,
  MixEmbed,
  MixTrack,
  PollAttachment,
  PollChoice,
  Reaction,
  User,
} from '@/lib/types'

type CommentRow = Database['public']['Tables']['comments']['Row']
type CommentReactionRow = Database['public']['Tables']['comment_reactions']['Row']
type ItemRow = Database['public']['Tables']['items']['Row']
type PollRow = Database['public']['Tables']['polls']['Row']
type UserRow = Database['public']['Tables']['users']['Row']

interface CommentWithReactions extends CommentRow {
  comment_reactions: CommentReactionRow[]
}

interface ItemRowWithPoll extends ItemRow {
  poll: PollRow | null
}

export interface UseSavedCommentsResult {
  comments: Comment[]
  itemsById: Map<string, ContentItem>
  loading: boolean
}

export function useSavedComments(): UseSavedCommentsResult {
  const [comments, setComments] = useState<Comment[]>([])
  const [itemsById, setItemsById] = useState<Map<string, ContentItem>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    async function load() {
      const ids = [...getSavedCommentIds()]
      if (ids.length === 0) {
        setComments([])
        setItemsById(new Map())
        setLoading(false)
        return
      }
      setLoading(true)

      // Comments + their reactions in one round trip.
      const { data: commentRows } = await supabase
        .from('comments')
        .select('*, comment_reactions(*)')
        .in('id', ids)
      if (cancelled) return

      const list = ((commentRows as CommentWithReactions[] | null) ?? []).map(rowToComment)
      // Distinct authors + tombstone moderators for the user batch fetch.
      const userIds = new Set<string>()
      const itemIds = new Set<string>()
      for (const c of list) {
        userIds.add(c.authorId)
        if (c.deletion?.moderatorId) userIds.add(c.deletion.moderatorId)
        itemIds.add(c.contentItemId)
      }

      // Parent items + users in parallel.
      const [usersRes, itemsRes] = await Promise.all([
        userIds.size > 0
          ? supabase.from('users').select('*').in('id', [...userIds])
          : Promise.resolve({ data: [] as UserRow[] }),
        itemIds.size > 0
          ? supabase
              .from('items')
              .select('*, poll:polls(id, kind, prompt, choices, multi_choice, closes_at, created_at)')
              .in('id', [...itemIds])
          : Promise.resolve({ data: [] as ItemRowWithPoll[] }),
      ])
      if (cancelled) return

      const users: User[] = (usersRes.data ?? []).map(rowToUser)
      if (users.length > 0) setRealUsers(users)

      const itemMap = new Map<string, ContentItem>()
      for (const row of (itemsRes.data ?? []) as unknown as ItemRowWithPoll[]) {
        itemMap.set(row.id, rowToContentItem(row))
      }

      // Sort by createdAt asc so the section's `.reverse()` puts most-
      // recent at the top (matches existing SavedCommentsSection ordering).
      list.sort((a, b) => a.createdAt.localeCompare(b.createdAt))

      setComments(list)
      setItemsById(itemMap)
      setLoading(false)
    }

    void load()
    const unsub = subscribeSavedComments(load)
    return () => {
      cancelled = true
      unsub()
    }
  }, [])

  return { comments, itemsById, loading }
}

// ── Row mappers (browser-side, duplicated from server modules) ─────────────
//
// Same reasoning as useComments + useForo: the server data modules can't
// be imported into client bundles because they pull in the cookies-aware
// Supabase client. These mappers stay in sync with their server twins.

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

function rowToPollAttachment(p: PollRow): PollAttachment {
  return {
    id: p.id,
    kind: p.kind,
    prompt: p.prompt,
    choices: (p.choices as PollChoice[] | null) ?? undefined,
    multiChoice: p.multi_choice || undefined,
    closesAt: p.closes_at ?? undefined,
    createdAt: p.created_at,
  }
}

function rowToContentItem(row: ItemRowWithPoll): ContentItem {
  return {
    poll: row.poll ? rowToPollAttachment(row.poll) : undefined,
    id: row.id,
    slug: row.slug,
    type: row.type,
    title: row.title,
    subtitle: row.subtitle ?? undefined,
    excerpt: row.excerpt ?? undefined,
    vibe: row.vibe,
    genres: row.genres,
    tags: row.tags,
    imageUrl: row.image_url ?? undefined,
    publishedAt: row.published_at,
    date: row.date ?? undefined,
    endDate: row.end_date ?? undefined,
    expiresAt: row.expires_at ?? undefined,
    source: row.source ?? undefined,
    externalId: row.external_id ?? undefined,
    elevated: row.elevated,
    venue: row.venue ?? undefined,
    venueCity: row.venue_city ?? undefined,
    artists: row.artists ?? undefined,
    ticketUrl: row.ticket_url ?? undefined,
    price: row.price ?? undefined,
    mixUrl: row.mix_url ?? undefined,
    embeds: (row.embeds as MixEmbed[] | null) ?? [],
    duration: row.duration ?? undefined,
    tracklist: (row.tracklist as MixTrack[] | null) ?? [],
    mixSeries: row.mix_series ?? undefined,
    recordedIn: row.recorded_in ?? undefined,
    mixFormat: row.mix_format ?? undefined,
    bpmRange: row.bpm_range ?? undefined,
    musicalKey: row.musical_key ?? undefined,
    mixStatus: row.mix_status ?? undefined,
    author: row.author ?? undefined,
    readTime: row.read_time ?? undefined,
    editorial: row.editorial,
    pinned: row.pinned,
    bodyPreview: row.body_preview ?? undefined,
    articleBody: (row.article_body as ArticleBlock[] | null) ?? undefined,
    footnotes: (row.footnotes as Footnote[] | null) ?? undefined,
    heroCaption: row.hero_caption ?? undefined,
    partnerKind: row.partner_kind ?? undefined,
    partnerUrl: row.partner_url ?? undefined,
    partnerLastUpdated: row.partner_last_updated ?? undefined,
    marketplaceEnabled: row.marketplace_enabled,
    marketplaceDescription: row.marketplace_description ?? undefined,
    marketplaceLocation: row.marketplace_location ?? undefined,
    marketplaceCurrency: row.marketplace_currency ?? undefined,
    marketplaceListings:
      (row.marketplace_listings as MarketplaceListing[] | null) ?? undefined,
    hp: row.hp ?? undefined,
    hpLastUpdatedAt: row.hp_last_updated_at ?? undefined,
  }
}
