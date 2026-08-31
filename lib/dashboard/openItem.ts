'use client'

// ── openItem — in-place overlay resolution for /dashboard (FINAL_SPEC §3.11) ─
//
// The dashboard opens content in the EXISTING overlay stack without leaving
// /dashboard. OverlayRouter resolves `?item=<slug>` against lib/itemsCache,
// which is only warm after a grid page streamed items — a direct /dashboard
// load (deep link, hard refresh) has a cold cache and the overlay would
// silently fail to open. This module closes that gap: fetch-by-slug into
// itemsCache when cold, then `useOverlay().open` in place.
//
// Every dashboard click-through goes through `useOpenItem()` so the recipe
// is greppable in one place (Judge graft). Foro rows are the sanctioned
// exception (`/foro?thread=` — foro is a page, not an overlay) and do NOT
// use this module.

import { useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getItemBySlugSync, recordItems } from '@/lib/itemsCache'
import { useOverlay, type OverlayOrigin } from '@/components/overlay/useOverlay'
import type { ContentItem } from '@/lib/types'

// Same embed shape as lib/hooks/useMyPublishedItems — proven browser-side.
// vibe_check_aggregates is a view without a FK, so it can't ride this select;
// it's merged in a follow-up query below (mirrors lib/data/items.ts).
export const ITEM_ROW_SELECT =
  '*, poll:polls(id, kind, prompt, choices, multi_choice, closes_at, created_at), item_entities(relation, entity:entities(id, kind, name, slug))'

// Browser-side duplicate of lib/data/items.ts rowToContentItem — that module
// is server-only (cookies-aware client). Full-fidelity on purpose: overlays
// render straight from this object, and a dropped field here is a field the
// deep-linked overlay silently loses. Keep in sync with the
// useMyPublishedItems mapper.
export function mapItemRowToContentItem(row: any): ContentItem {
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
  const entities = Array.isArray(row.item_entities)
    ? row.item_entities
        .filter((l: any) => l?.entity)
        .map((l: any) => ({
          id: l.entity.id,
          kind: l.entity.kind,
          name: l.entity.name,
          slug: l.entity.slug,
          relation: l.relation ?? 'subject',
        }))
    : []
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
    format: row.format ?? undefined,
    subjectKind: row.subject_kind ?? undefined,
    country: row.country ?? undefined,
    year: row.year ?? undefined,
    links: row.links ?? undefined,
    entities,
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
    franjaKind: row.franja_kind ?? undefined,
    franjaUrl: row.franja_url ?? undefined,
    franjaLastUpdated: row.franja_last_updated ?? undefined,
    verified: row.verified ?? undefined,
    featuredItemId: row.featured_item_id ?? undefined,
    franjaId: row.franja_id ?? undefined,
    createdById: row.created_by ?? undefined,
    marketplaceEnabled: row.marketplace_enabled ?? false,
    marketplaceDescription: row.marketplace_description ?? undefined,
    marketplaceLocation: row.marketplace_location ?? undefined,
    marketplaceCurrency: row.marketplace_currency ?? undefined,
    marketplaceListings: row.marketplace_listings ?? undefined,
    hp: row.hp ?? undefined,
    hpLastUpdatedAt: row.hp_last_updated_at ?? undefined,
    harvestedAt: row.harvested_at ?? undefined,
    harvestedAmount: row.harvested_amount ?? undefined,
    hpDecayMultiplier: row.hp_decay_multiplier ?? undefined,
  }
}

// In-flight dedupe: N widgets resolving the same slug in one frame share one
// fetch (pollVotesCache idiom).
const inflight = new Map<string, Promise<ContentItem | null>>()

// Resolve a slug into lib/itemsCache. Warm cache → synchronous hit; cold →
// one published-only fetch (+ vibe aggregate merge) recorded via
// recordItems() so OverlayRouter and getRelatedByVibe both see it.
export async function ensureItemBySlug(slug: string): Promise<ContentItem | null> {
  const cached = getItemBySlugSync(slug)
  if (cached) return cached
  const pending = inflight.get(slug)
  if (pending) return pending

  const fetchOne = (async (): Promise<ContentItem | null> => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('items')
      .select(ITEM_ROW_SELECT)
      .eq('slug', slug)
      // RLS lets franja teams read their own unpublished rows — filter
      // explicitly, same law as getItems() (a leak occurred before).
      .eq('published', true)
      .maybeSingle()
    if (error || !data) {
      if (error) console.error('[openItem] fetch-by-slug', error)
      return null
    }
    const item = mapItemRowToContentItem(data)
    // Crowd vibe aggregate — the view has no FK, so merge separately. A miss
    // just leaves the author band in charge (same fall-through as the grid).
    try {
      const { data: agg } = await supabase
        .from('vibe_check_aggregates')
        .select('item_id, check_count, median_min, median_max')
        .eq('item_id', item.id)
        .maybeSingle()
      if (agg) {
        const a = agg as { check_count: number; median_min: number; median_max: number }
        item.vibeCheckCount = a.check_count
        item.vibeCheckMedianMin = a.median_min as ContentItem['vibeCheckMedianMin']
        item.vibeCheckMedianMax = a.median_max as ContentItem['vibeCheckMedianMax']
      }
    } catch {
      // aggregate is decorative here — never block the open
    }
    recordItems([item])
    return item
  })()

  inflight.set(slug, fetchOne)
  try {
    return await fetchOne
  } finally {
    inflight.delete(slug)
  }
}

// `?comment=<id>` rides next to `?item=` so ACTIVIDAD rows land with the
// comments column open. Written with the same history.replaceState idiom as
// useOverlay's slug sync, BEFORE open() so the shell's useSearchParams
// mirror sees both params in one entry.
function writeCommentParam(commentId: string | null) {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (commentId) url.searchParams.set('comment', commentId)
  else url.searchParams.delete('comment')
  window.history.replaceState(window.history.state, '', url.toString())
}

export interface OpenItemOptions {
  origin?: OverlayOrigin
  commentId?: string
}

// The one dashboard click-to-open recipe. Returns false on an unresolvable
// slug (deleted / unpublished) so callers can show an honest error instead
// of a dead click.
export function useOpenItem(): (slug: string, opts?: OpenItemOptions) => Promise<boolean> {
  const { open } = useOverlay()
  return useCallback(
    async (slug: string, opts?: OpenItemOptions) => {
      const item = await ensureItemBySlug(slug)
      if (!item) return false
      writeCommentParam(opts?.commentId ?? null)
      open(slug, opts?.origin)
      return true
    },
    [open],
  )
}
