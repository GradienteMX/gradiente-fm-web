import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'
import type {
  ArticleBlock,
  ContentItem,
  Footnote,
  MarketplaceListing,
  MixEmbed,
  MixTrack,
  PartnerKind,
  PollAttachment,
  PollChoice,
} from '@/lib/types'

type ItemRow = Database['public']['Tables']['items']['Row']
type PollRow = Database['public']['Tables']['polls']['Row']
type MarketplaceListingRow = Database['public']['Tables']['marketplace_listings']['Row']

// Minimal partner shape resolved via a follow-up query (NOT an embedded
// PostgREST join) when `partner_id` is set. Mirrors the
// `fetchVibeCheckAggregates` pattern below — two-query merge is more
// resilient than PostgREST's self-FK embed, which depends on the schema
// cache being fresh and tends to lag behind migrations. See migration
// 0015 + wiki/90-Decisions/Partner Authoring.md.
type EmbeddedPartner = {
  id: string
  title: string
  slug: string
  partner_kind: string | null
  marketplace_enabled: boolean
}

// Minimal creator shape — same two-query pattern as EmbeddedPartner. Pulled
// per-render from items.created_by → users via `fetchCreatorsByIds`.
type EmbeddedCreator = {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
}

// Embedded join shape — `polls.item_id` is unique so PostgREST returns a
// single object (not an array) for the relation; marketplace_listings is
// 1:N keyed on partner_id, returned as an array. `partner` is resolved
// by `fetchPartnersByIds` after the main query lands.
type ItemRowWithPoll = ItemRow & {
  poll: PollRow | null
  marketplace_listings: MarketplaceListingRow[] | null
}

// Listings are pulled via the same SELECT so consumers don't need a second
// round-trip. The catalog + overlay both render off this one query. Partner
// attribution is resolved separately — see `attachPartner` below.
const ITEMS_SELECT =
  '*, poll:polls(id, kind, prompt, choices, multi_choice, closes_at, created_at), marketplace_listings(*)'

// Map a marketplace_listings row to the camelCase MarketplaceListing
// type the rest of the app consumes. Centralized so each row mapper
// (4 of them — server + 3 hooks) doesn't re-invent it.
function rowToMarketplaceListing(row: MarketplaceListingRow): MarketplaceListing {
  return {
    id: row.id,
    title: row.title,
    category: row.category as MarketplaceListing['category'],
    subcategory: row.subcategory ?? undefined,
    price: Number(row.price),
    condition: row.condition as MarketplaceListing['condition'],
    status: row.status as MarketplaceListing['status'],
    description: row.description ?? undefined,
    tags: row.tags ?? undefined,
    shippingMode: (row.shipping_mode as MarketplaceListing['shippingMode']) ?? undefined,
    images: row.images ?? [],
    embeds: (row.embeds as unknown as MarketplaceListing['embeds']) ?? undefined,
    publishedAt: row.published_at,
  }
}

export { rowToMarketplaceListing }

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

// Form fields for optional timestamps come through as `''` when blank
// (datetime-local inputs return empty strings, not undefined). `??` only
// catches null/undefined, so the empty string used to flow to Postgres and
// fail with `invalid input syntax for type timestamp with time zone: ""`.
function tsOrNull(v: string | undefined | null): string | null {
  return v ? v : null
}

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
    date: tsOrNull(item.date),
    end_date: tsOrNull(item.endDate),
    expires_at: tsOrNull(item.expiresAt),
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
    partner_last_updated: tsOrNull(item.partnerLastUpdated),
    // partner_id added in migration 0015; cast bypasses stale generated
    // types until `npx supabase gen types typescript` regenerates.
    ...(item.partnerId !== undefined ? { partner_id: item.partnerId } : {}),
    marketplace_enabled: item.marketplaceEnabled ?? false,
    marketplace_description: item.marketplaceDescription ?? null,
    marketplace_location: item.marketplaceLocation ?? null,
    marketplace_currency: item.marketplaceCurrency ?? null,
    // marketplace_listings live in their own table since migration 0010 —
    // the publish flow inserts the item row first; listings are managed via
    // /api/partners/[id]/listings endpoints once the partner exists.
    hp: item.hp ?? null,
    hp_last_updated_at: tsOrNull(item.hpLastUpdatedAt),
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
    // partner_id added in migration 0015; cast bypasses stale generated
    // types until `npx supabase gen types typescript` regenerates.
    partnerId: (row as { partner_id?: string | null }).partner_id ?? undefined,
    // created_by added in migration 0012; same cast story as partner_id.
    createdById: (row as { created_by?: string | null }).created_by ?? undefined,
    // partner field is populated by attachPartner() in the consumer fns
    // below (getItems / getItemBySlug). Leave undefined here.
    marketplaceEnabled: row.marketplace_enabled,
    marketplaceDescription: row.marketplace_description ?? undefined,
    marketplaceLocation: row.marketplace_location ?? undefined,
    marketplaceCurrency: row.marketplace_currency ?? undefined,
    marketplaceListings: row.marketplace_listings
      ? row.marketplace_listings.map(rowToMarketplaceListing)
      : undefined,
    hp: row.hp ?? undefined,
    hpLastUpdatedAt: row.hp_last_updated_at ?? undefined,
    // Harvest fields — post-0022, not in generated types until regen.
    harvestedAt:
      (row as { harvested_at?: string | null }).harvested_at ?? undefined,
    harvestedAmount:
      (row as { harvested_amount?: number | null }).harvested_amount ?? undefined,
    hpDecayMultiplier:
      (row as { hp_decay_multiplier?: number | null }).hp_decay_multiplier ??
      undefined,
  }
}

// ── Vibe-check aggregate join ──────────────────────────────────────────────
//
// `vibe_check_aggregates` is a view (no FK), so we can't embed it via the
// PostgREST select. Pull all aggregate rows in a single follow-up query and
// merge them per item-id. Only items with at least one check appear in the
// view, so missing keys → leave the fields undefined (callers fall through
// to the author band).

type VibeCheckAggregateRow = {
  item_id: string
  check_count: number
  median_min: number
  median_max: number
}

async function fetchVibeCheckAggregates(
  itemIds: string[],
): Promise<Map<string, VibeCheckAggregateRow>> {
  const out = new Map<string, VibeCheckAggregateRow>()
  if (itemIds.length === 0) return out
  const supabase = createClient()
  const { data, error } = await supabase
    .from('vibe_check_aggregates')
    .select('item_id, check_count, median_min, median_max')
    .in('item_id', itemIds)
  if (error) {
    console.error('[fetchVibeCheckAggregates] Supabase error:', error)
    return out
  }
  for (const row of (data ?? []) as VibeCheckAggregateRow[]) {
    out.set(row.item_id, row)
  }
  return out
}

function attachAggregate(
  item: ContentItem,
  agg: VibeCheckAggregateRow | undefined,
): ContentItem {
  if (!agg) return item
  return {
    ...item,
    vibeCheckCount: agg.check_count,
    vibeCheckMedianMin: agg.median_min,
    vibeCheckMedianMax: agg.median_max,
  }
}

// ── Partner attribution merge ──────────────────────────────────────────────
//
// Mirrors fetchVibeCheckAggregates: a second query pulls the partner rows
// referenced by any item's `partner_id`, then `attachPartner` merges the
// minimal shape onto each item.
//
// Done this way instead of a PostgREST self-FK embed because the embed
// depends on PostgREST's schema cache having seen the FK — which lags
// behind migrations (PGRST200 errors on first deploy). The two-query
// approach is cache-agnostic.

async function fetchPartnersByIds(ids: string[]): Promise<Map<string, EmbeddedPartner>> {
  const out = new Map<string, EmbeddedPartner>()
  if (ids.length === 0) return out
  const supabase = createClient()
  const { data, error } = await supabase
    .from('items')
    .select('id, title, slug, partner_kind, marketplace_enabled')
    .in('id', ids)
  if (error) {
    console.error('[fetchPartnersByIds] Supabase error:', error)
    return out
  }
  for (const row of (data ?? []) as EmbeddedPartner[]) {
    out.set(row.id, row)
  }
  return out
}

function attachPartner(
  item: ContentItem,
  partner: EmbeddedPartner | undefined,
): ContentItem {
  if (!partner) return item
  return {
    ...item,
    partner: {
      id: partner.id,
      title: partner.title,
      slug: partner.slug,
      kind: (partner.partner_kind ?? 'venue') as PartnerKind,
      marketplaceEnabled: partner.marketplace_enabled,
    },
  }
}

// ── Public read API ────────────────────────────────────────────────────────

// Public content read — drives the home feed + every type page. Returns
// PUBLISHED items only, and the SAME set for every viewer (No-Algorithm: the
// feed must not vary by who's logged in). We filter `published=true` EXPLICITLY
// rather than lean on RLS: the items_partner_team_read policy (migration 0026)
// lets a partner member read their OWN partner's unpublished drafts so BORRADORES
// can list them — and without this filter those drafts leaked into the partner's
// home feed + events rail. Unpublished drafts live only in dashboard surfaces,
// which query them directly (drafts table, BORRADORES, etc.).
//
// Pages still apply their own filters (filterForHome, etc.) on the result.
export async function getItems(): Promise<ContentItem[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('items')
    .select(ITEMS_SELECT)
    .eq('published', true)
    .order('published_at', { ascending: false })

  if (error) {
    console.error('[getItems] Supabase error:', error)
    return []
  }
  const items = ((data ?? []) as unknown as ItemRowWithPoll[]).map(rowToContentItem)
  // Parallel fetches: vibe-check aggregates, partner-attribution, AND
  // creator-attribution rows. All three look up by ids drawn from the items
  // array; can run concurrently.
  const partnerIds = Array.from(
    new Set(items.map((i) => i.partnerId).filter((id): id is string => !!id)),
  )
  const creatorIds = Array.from(
    new Set(items.map((i) => i.createdById).filter((id): id is string => !!id)),
  )
  const [aggregates, partners, creators] = await Promise.all([
    fetchVibeCheckAggregates(items.map((i) => i.id)),
    fetchPartnersByIds(partnerIds),
    fetchCreatorsByIds(creatorIds),
  ])
  return items
    .map((i) => attachAggregate(i, aggregates.get(i.id)))
    .map((i) => attachPartner(i, i.partnerId ? partners.get(i.partnerId) : undefined))
    .map((i) => attachCreator(i, i.createdById ? creators.get(i.createdById) : undefined))
}

// Items authored by a specific user — drives `/u/[username]`'s PUBLICADOS
// grid. Mirrors `getItems` minus filters/order tweaks for the profile
// surface: own published, non-seed items, newest first. RLS lets any
// logged-in viewer read published rows, so this works for the public
// profile page without an auth context.
export async function getItemsByCreatedBy(userId: string): Promise<ContentItem[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('items')
    .select(ITEMS_SELECT)
    // `created_by` is a post-0012 column; cast to bypass stale generated types.
    .eq('created_by' as never, userId as never)
    .eq('published', true)
    .eq('seed', false)
    .order('published_at', { ascending: false })

  if (error) {
    console.error('[getItemsByCreatedBy] Supabase error:', error)
    return []
  }
  const items = ((data ?? []) as unknown as ItemRowWithPoll[]).map(rowToContentItem)
  if (items.length === 0) return items

  const partnerIds = Array.from(
    new Set(items.map((i) => i.partnerId).filter((id): id is string => !!id)),
  )
  // All items here share the same creator (`userId`), so resolve once.
  const [aggregates, partners, creators] = await Promise.all([
    fetchVibeCheckAggregates(items.map((i) => i.id)),
    fetchPartnersByIds(partnerIds),
    fetchCreatorsByIds([userId]),
  ])
  return items
    .map((i) => attachAggregate(i, aggregates.get(i.id)))
    .map((i) => attachPartner(i, i.partnerId ? partners.get(i.partnerId) : undefined))
    .map((i) => attachCreator(i, i.createdById ? creators.get(i.createdById) : undefined))
}

// ── Creator attribution merge ──────────────────────────────────────────────
//
// Same shape as fetchPartnersByIds: pull all referenced users in one query,
// attach to each item. Powers the @username chip + link to /u/[username]
// rendered by ContentCard / overlays.

async function fetchCreatorsByIds(ids: string[]): Promise<Map<string, EmbeddedCreator>> {
  const out = new Map<string, EmbeddedCreator>()
  if (ids.length === 0) return out
  const supabase = createClient()
  const { data, error } = await supabase
    .from('users')
    .select('id, username, display_name, avatar_url')
    .in('id', ids)
  if (error) {
    console.error('[fetchCreatorsByIds] Supabase error:', error)
    return out
  }
  // `avatar_url` is a post-0017 column; cast through unknown for the same
  // stale-generated-types reason as partner / created_by handling.
  for (const row of (data ?? []) as unknown as EmbeddedCreator[]) {
    out.set(row.id, row)
  }
  return out
}

function attachCreator(
  item: ContentItem,
  creator: EmbeddedCreator | undefined,
): ContentItem {
  if (!creator) return item
  return {
    ...item,
    creator: {
      id: creator.id,
      username: creator.username,
      displayName: creator.display_name,
      avatarUrl: creator.avatar_url ?? undefined,
    },
  }
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
  if (!data) return null
  const item = rowToContentItem(data as unknown as ItemRowWithPoll)
  const [aggregates, partners, creators] = await Promise.all([
    fetchVibeCheckAggregates([item.id]),
    item.partnerId ? fetchPartnersByIds([item.partnerId]) : Promise.resolve(new Map()),
    item.createdById ? fetchCreatorsByIds([item.createdById]) : Promise.resolve(new Map()),
  ])
  const withAgg = attachAggregate(item, aggregates.get(item.id))
  const withPartner = attachPartner(withAgg, item.partnerId ? partners.get(item.partnerId) : undefined)
  return attachCreator(withPartner, item.createdById ? creators.get(item.createdById) : undefined)
}
