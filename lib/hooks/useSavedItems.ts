'use client'

// ── useSavedItems — dashboard view of the user's saved items ───────────────
//
// Symmetric with lib/hooks/useSavedComments. The user's saved-item ids
// live in lib/itemSavesCache (loaded once after auth via setSavedItemIds).
// This hook fetches the actual item rows for those ids from the `items`
// table (joined to `polls` so the overlay's poll attachment renders).
//
// Returns ContentItem[] sorted by save-recency (most-recent first). The
// previous in-memory implementation (lib/saves.ts) read from sessionStorage
// — which was always empty after the chunk-3 cache migration — so every
// dashboard counter showed 0 and GuardadosSection showed empty. This hook
// closes that loop.
//
// Re-fetches whenever itemSavesCache changes (subscribeSavedItems).

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  getSavedItemIds,
  subscribeSavedItems,
} from '@/lib/itemSavesCache'
import type { Database } from '@/lib/supabase/database.types'
import type {
  ArticleBlock,
  ContentItem,
  Footnote,
  MarketplaceListing,
  MixEmbed,
  MixTrack,
  PollAttachment,
  PollChoice,
} from '@/lib/types'

type ItemRow = Database['public']['Tables']['items']['Row']
type PollRow = Database['public']['Tables']['polls']['Row']

interface ItemRowWithPoll extends ItemRow {
  poll: PollRow | null
}

export function useSavedItems(): ContentItem[] {
  const [items, setItems] = useState<ContentItem[]>([])

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    async function load() {
      const ids = [...getSavedItemIds()]
      if (ids.length === 0) {
        setItems([])
        return
      }

      const { data } = await supabase
        .from('items')
        .select(
          '*, poll:polls(id, kind, prompt, choices, multi_choice, closes_at, created_at)',
        )
        .in('id', ids)
      if (cancelled) return

      // user_saves stores `saved_at` per (user, item) but the cache only
      // tracks ids — we don't have per-id timestamps locally. Sort by
      // items.created_at desc as a reasonable proxy until the cache
      // carries timestamps (cheap follow-up if user-visible recency
      // ordering matters).
      const list = ((data as ItemRowWithPoll[] | null) ?? [])
        .map(rowToContentItem)
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))

      setItems(list)
    }

    void load()
    const unsub = subscribeSavedItems(load)
    return () => {
      cancelled = true
      unsub()
    }
  }, [])

  return items
}

// ── Row mappers (browser-side, duplicated from server modules) ─────────────

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
    vibeMin: row.vibe_min,
    vibeMax: row.vibe_max,
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
    // Saved-items cards don't render marketplace listings (the count chip
    // sits on MarketplaceCard, not the saved-items grid). Listings live
    // in their own table since 0010 — if a consumer ever needs them here,
    // switch the SELECT to embed marketplace_listings(*) + map via
    // rowToMarketplaceListing.
    marketplaceListings: undefined,
    hp: row.hp ?? undefined,
    hpLastUpdatedAt: row.hp_last_updated_at ?? undefined,
  }
}
