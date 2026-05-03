'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  clearPublishedItemsCache,
  setAllPublishedItems,
} from '@/lib/publishedItemsCache'
import type { ContentItem } from '@/lib/types'

// ── useMyPublishedItems ─────────────────────────────────────────────────────
//
// Fetches items the current user has published — drives the dashboard's
// "Publicados" surface. Filters by `items.created_by = userId`, the column
// added in migration 0012.
//
// Returns `[]` when userId is null (logged out) or while the fetch is in
// flight. The dashboard merges this with `useDraftItems()` to compose the
// full list of editor work.
//
// Intentionally minimal: no cache, no listener bus, no realtime. The
// dashboard is a low-traffic surface and a fresh fetch on mount is fine
// for now. Add a refresh trigger if the publish flow needs to surface
// new items without a navigation.

export function useMyPublishedItems(userId: string | null): ContentItem[] {
  const [items, setItems] = useState<ContentItem[]>([])

  useEffect(() => {
    if (!userId) {
      setItems([])
      clearPublishedItemsCache()
      return
    }
    let cancelled = false
    const supabase = createClient()
    // `created_by` is a post-0012 column; cast to bypass stale generated
    // types until `npx supabase gen types typescript` regenerates.
    void supabase
      .from('items')
      .select('*, poll:polls(id, kind, prompt, choices, multi_choice, closes_at, created_at)')
      .eq('created_by' as never, userId as never)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('[useMyPublishedItems]', error)
          setItems([])
          return
        }
        const mapped = (data ?? []).map(rowToContentItem)
        setItems(mapped)
        // Prime the published-items cache so `getItemById` (lib/drafts.ts)
        // can resolve published rows synchronously when the editor opens
        // them from "Publicados". Without this the composer hydrates as
        // empty and a publish mints a NEW row instead of upserting.
        setAllPublishedItems(mapped)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  return items
}

// Minimal duplicate of lib/data/items.ts rowToContentItem — that module is
// server-only (cookies-aware client). Browser side we re-do the mapping
// against the typed row. Keep in sync.
function rowToContentItem(row: any): ContentItem {
  const poll = row.poll
    ? {
        id: row.poll.id,
        kind: row.poll.kind,
        prompt: row.poll.prompt,
        choices: row.poll.choices ?? undefined,
        multiChoice: row.poll.multi_choice || undefined,
        closesAt: row.poll.closes_at ?? undefined,
        createdAt: row.poll.created_at,
      }
    : undefined
  return {
    poll,
    id: row.id,
    slug: row.slug,
    type: row.type,
    title: row.title,
    subtitle: row.subtitle ?? undefined,
    excerpt: row.excerpt ?? undefined,
    vibeMin: row.vibe_min,
    vibeMax: row.vibe_max,
    genres: row.genres ?? [],
    tags: row.tags ?? [],
    imageUrl: row.image_url ?? undefined,
    publishedAt: row.published_at,
    date: row.date ?? undefined,
    endDate: row.end_date ?? undefined,
    expiresAt: row.expires_at ?? undefined,
    source: row.source ?? undefined,
    externalId: row.external_id ?? undefined,
    elevated: row.elevated ?? false,
    venue: row.venue ?? undefined,
    venueCity: row.venue_city ?? undefined,
    artists: row.artists ?? undefined,
    ticketUrl: row.ticket_url ?? undefined,
    price: row.price ?? undefined,
    mixUrl: row.mix_url ?? undefined,
    embeds: row.embeds ?? [],
    duration: row.duration ?? undefined,
    tracklist: row.tracklist ?? [],
    mixSeries: row.mix_series ?? undefined,
    recordedIn: row.recorded_in ?? undefined,
    mixFormat: row.mix_format ?? undefined,
    bpmRange: row.bpm_range ?? undefined,
    musicalKey: row.musical_key ?? undefined,
    mixStatus: row.mix_status ?? undefined,
    author: row.author ?? undefined,
    readTime: row.read_time ?? undefined,
    editorial: row.editorial ?? false,
    pinned: row.pinned ?? false,
    bodyPreview: row.body_preview ?? undefined,
    articleBody: row.article_body ?? undefined,
    footnotes: row.footnotes ?? undefined,
    heroCaption: row.hero_caption ?? undefined,
    partnerKind: row.partner_kind ?? undefined,
    partnerUrl: row.partner_url ?? undefined,
    partnerLastUpdated: row.partner_last_updated ?? undefined,
    marketplaceEnabled: row.marketplace_enabled ?? false,
    marketplaceDescription: row.marketplace_description ?? undefined,
    marketplaceLocation: row.marketplace_location ?? undefined,
    marketplaceCurrency: row.marketplace_currency ?? undefined,
    marketplaceListings: row.marketplace_listings ?? undefined,
    hp: row.hp ?? undefined,
    hpLastUpdatedAt: row.hp_last_updated_at ?? undefined,
  }
}
