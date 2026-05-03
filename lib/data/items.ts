import { createClient } from '@/lib/supabase/server'
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

// Embedded join shape — `polls.item_id` is unique so PostgREST returns a
// single object (not an array) for the relation.
type ItemRowWithPoll = ItemRow & { poll: PollRow | null }

const ITEMS_SELECT =
  '*, poll:polls(id, kind, prompt, choices, multi_choice, closes_at, created_at)'

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

// ── ContentItem → row (insert/upsert payload) ──────────────────────────────
//
// The inverse of rowToContentItem. Used by the publish route handler when
// promoting a draft into the items table. Mirrors `itemToRow` in
// scripts/seed.ts but defaults `seed=false` (these are real user items, not
// seeded mocks). Caller controls `published` (defaults to true — the publish
// flow always lands rows in the visible state).
//
// Polls are NOT mapped here — they live in their own table. The route
// handler upserts the polls row separately after the item lands.
type ItemInsert = Database['public']['Tables']['items']['Insert']
export function contentItemToRow(item: ContentItem, opts?: { published?: boolean }): ItemInsert {
  return {
    id: item.id,
    slug: item.slug,
    type: item.type,
    title: item.title,
    subtitle: item.subtitle ?? null,
    excerpt: item.excerpt ?? null,
    vibe_min: item.vibeMin,
    vibe_max: item.vibeMax,
    genres: item.genres ?? [],
    tags: item.tags ?? [],
    image_url: item.imageUrl ?? null,
    published_at: item.publishedAt,
    date: item.date ?? null,
    end_date: item.endDate ?? null,
    expires_at: item.expiresAt ?? null,
    source: item.source ?? null,
    external_id: item.externalId ?? null,
    elevated: item.elevated ?? false,
    venue: item.venue ?? null,
    venue_city: item.venueCity ?? null,
    artists: item.artists ?? null,
    ticket_url: item.ticketUrl ?? null,
    price: item.price ?? null,
    mix_url: item.mixUrl ?? null,
    embeds: (item.embeds ?? []) as unknown as ItemInsert['embeds'],
    duration: item.duration ?? null,
    tracklist: (item.tracklist ?? []) as unknown as ItemInsert['tracklist'],
    mix_series: item.mixSeries ?? null,
    recorded_in: item.recordedIn ?? null,
    mix_format: item.mixFormat ?? null,
    bpm_range: item.bpmRange ?? null,
    musical_key: item.musicalKey ?? null,
    mix_status: item.mixStatus ?? null,
    author: item.author ?? null,
    read_time: item.readTime ?? null,
    editorial: item.editorial ?? false,
    pinned: item.pinned ?? false,
    body_preview: item.bodyPreview ?? null,
    article_body: (item.articleBody ?? []) as unknown as ItemInsert['article_body'],
    footnotes: (item.footnotes ?? []) as unknown as ItemInsert['footnotes'],
    hero_caption: item.heroCaption ?? null,
    partner_kind: item.partnerKind ?? null,
    partner_url: item.partnerUrl ?? null,
    partner_last_updated: item.partnerLastUpdated ?? null,
    marketplace_enabled: item.marketplaceEnabled ?? false,
    marketplace_description: item.marketplaceDescription ?? null,
    marketplace_location: item.marketplaceLocation ?? null,
    marketplace_currency: item.marketplaceCurrency ?? null,
    marketplace_listings: (item.marketplaceListings ?? []) as unknown as ItemInsert['marketplace_listings'],
    hp: item.hp ?? null,
    hp_last_updated_at: item.hpLastUpdatedAt ?? null,
    published: opts?.published ?? true,
    seed: false,
  }
}

// ── Row → ContentItem ──────────────────────────────────────────────────────
//
// snake_case (Postgres) → camelCase (frontend ContentItem). One central place
// for the mapping so the rest of the app keeps consuming `ContentItem` as it
// always has. Optional columns become `undefined` (matching the existing
// shape) rather than `null` so existing filters / `if (item.x)` checks work.
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
    marketplaceListings:
      (row.marketplace_listings as MarketplaceListing[] | null) ?? undefined,
    hp: row.hp ?? undefined,
    hpLastUpdatedAt: row.hp_last_updated_at ?? undefined,
  }
}

// ── Public read API ────────────────────────────────────────────────────────

// Fetch every item the calling user can see, in `published_at` desc order.
// RLS narrows the visible set: anon / unauthenticated → published items only;
// admin / guide → all items (including unpublished + seeded).
//
// Pages still apply their own filters (filterForHome, getEventDates, etc.) on
// the result. Centralizing the read here means we're one swap away from
// adding pagination, FTS, or denormalized aggregates later without touching
// any pages.
export async function getItems(): Promise<ContentItem[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('items')
    .select(ITEMS_SELECT)
    .order('published_at', { ascending: false })

  if (error) {
    console.error('[getItems] Supabase error:', error)
    return []
  }
  return ((data ?? []) as unknown as ItemRowWithPoll[]).map(rowToContentItem)
}

// Single item by slug — used by overlay deep-links and `/[type]/[slug]` pages.
export async function getItemBySlug(slug: string): Promise<ContentItem | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('items')
    .select(ITEMS_SELECT)
    .eq('slug', slug)
    .maybeSingle()

  if (error) {
    console.error(`[getItemBySlug] ${slug}:`, error)
    return null
  }
  return data ? rowToContentItem(data as unknown as ItemRowWithPoll) : null
}
