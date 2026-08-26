// ============================================================================
// scripts/seedNocheNegra.ts — land the Noche Negra catalogue as real DB rows
// ============================================================================
// Promotes lib/nocheNegraSeed.ts from a dev-only /mapa demo into real rows:
// 24 content items (seed=true) + 8 marketplace listings, and ENRICHES the
// already-existing `pa-noche-negra` franja row in place.
//
//   npx tsx scripts/seedNocheNegra.ts            # dry run — report only
//   npx tsx scripts/seedNocheNegra.ts --apply    # write to prod
//   npx tsx scripts/seedNocheNegra.ts --revert   # remove everything it wrote
//
// Requires .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
//
// ── Why not scripts/seed.ts or POST /api/items ─────────────────────────────
//   · scripts/seed.ts DELETES all seed rows (items, users, comments, foro) and
//     re-inserts MOCK_ITEMS wholesale. Destructive against prod. Never run it
//     there — even though MOCK_ITEMS now spreads NOCHE_NEGRA_SEED.
//   · POST /api/items stamps published_at = now() on create, which would
//     flatten every historical date (2017-2026) to today and dump 24 items on
//     top of the feed as brand-new. This catalogue is an ARCHIVE: the
//     backdated publishedAt is what makes HP decay leave it already-matured.
//
// ── Design notes ────────────────────────────────────────────────────────────
//   · Content items carry seed=true — provenance marker for a backfilled
//     batch, consistent with the other 160 seed rows, and makes --revert a
//     precise scoped delete. Seed rows are fully public; the flag only hides
//     them from an author's own "Publicados" surface (lib/data/items.ts).
//   · The franja row is UPDATEd, never deleted/reinserted: it is a real
//     prod row (created 2026-06-23, seed=false, accrued HP). We add the
//     dossier + marketplace fields and leave id/slug/title/image_url/
//     published_at/hp/seed/created_at untouched.
//   · marketplace_listings live in their own table since migration 0010, so
//     they are a second pass (same split as scripts/seed.ts).
//   · No migration needed — every column already exists.
//   · marketplace_enabled is the storefront kill-switch: flip it false to
//     hide the 8 listings without touching a row.
// ============================================================================

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { resolve } from 'node:path'

import { NOCHE_NEGRA_ITEMS, NOCHE_NEGRA_FRANJA } from '../lib/nocheNegraSeed'
import type { ContentItem } from '../lib/types'
import type { Database } from '../lib/supabase/database.types'

config({ path: resolve(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

type ItemInsert = Database['public']['Tables']['items']['Insert']
type ListingInsert = Database['public']['Tables']['marketplace_listings']['Insert']

const FRANJA_ID = NOCHE_NEGRA_FRANJA.id
const APPLY = process.argv.includes('--apply')
const REVERT = process.argv.includes('--revert')

// ── Mapping ─────────────────────────────────────────────────────────────────
//
// Extends the local itemToRow in scripts/seed.ts with the columns this
// catalogue actually uses that the older mapper predates: franja_id (0015),
// links (0041), verified / featured_item_id (0040), and the review subject
// fields format / subject_kind / country / year. Keep in lockstep with
// contentItemToRow in lib/data/items.ts — that one can't be imported here
// because it pulls @/lib/supabase/server (next/headers), which has no
// meaning outside a request.

function itemToRow(item: ContentItem): ItemInsert {
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
    source: item.source === 'archive:wayback' ? null : item.source ?? null,
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
    franja_kind: item.franjaKind ?? null,
    franja_url: item.franjaUrl ?? null,
    franja_last_updated: item.franjaLastUpdated ?? null,
    marketplace_enabled: item.marketplaceEnabled ?? false,
    marketplace_description: item.marketplaceDescription ?? null,
    marketplace_location: item.marketplaceLocation ?? null,
    marketplace_currency: item.marketplaceCurrency ?? null,
    hp: item.hp ?? null,
    hp_last_updated_at: item.hpLastUpdatedAt ?? null,
    published: true,
    seed: true,
    // Columns the seed.ts mapper predates — cast where the generated types
    // are still stale (same pattern as contentItemToRow).
    ...(item.franjaId !== undefined ? { franja_id: item.franjaId } : {}),
    links: (item.links ?? []) as unknown as object,
    format: item.format ?? null,
    subject_kind: item.subjectKind ?? null,
    country: item.country ?? null,
    year: item.year ?? null,
    verified: item.verified ?? false,
    featured_item_id: item.featuredItemId ?? null,
  } as ItemInsert
}

function listingToRow(franjaId: string, l: NonNullable<ContentItem['marketplaceListings']>[number]): ListingInsert {
  return {
    id: l.id,
    franja_id: franjaId,
    title: l.title,
    category: l.category,
    subcategory: l.subcategory ?? null,
    price: l.price,
    condition: l.condition,
    status: l.status,
    description: l.description ?? null,
    tags: l.tags ?? [],
    shipping_mode: l.shippingMode ?? null,
    images: l.images ?? [],
    embeds: (l.embeds ?? []) as unknown as ListingInsert['embeds'],
    published_at: l.publishedAt,
    sale_url: l.saleUrl ?? null,
    whatsapp: l.whatsapp ?? null,
    contact_email: l.email ?? null,
    related_links: (l.relatedLinks ?? []) as unknown as ListingInsert['related_links'],
  } as ListingInsert
}

// Dossier + marketplace fields added to the EXISTING franja row. Deliberately
// omits id/slug/title/image_url/published_at/hp/seed/created_by — those belong
// to the real prod row and must survive this import untouched.
const franjaPatch = {
  subtitle: NOCHE_NEGRA_FRANJA.subtitle ?? null,
  franja_kind: NOCHE_NEGRA_FRANJA.franjaKind ?? null,
  franja_url: NOCHE_NEGRA_FRANJA.franjaUrl ?? null,
  franja_last_updated: NOCHE_NEGRA_FRANJA.franjaLastUpdated ?? null,
  links: (NOCHE_NEGRA_FRANJA.links ?? []) as unknown as object,
  vibe_min: NOCHE_NEGRA_FRANJA.vibeMin,
  vibe_max: NOCHE_NEGRA_FRANJA.vibeMax,
  marketplace_enabled: NOCHE_NEGRA_FRANJA.marketplaceEnabled ?? false,
  marketplace_description: NOCHE_NEGRA_FRANJA.marketplaceDescription ?? null,
  marketplace_location: NOCHE_NEGRA_FRANJA.marketplaceLocation ?? null,
  marketplace_currency: NOCHE_NEGRA_FRANJA.marketplaceCurrency ?? null,
}

const itemRows = NOCHE_NEGRA_ITEMS.map(itemToRow)
const listingRows = (NOCHE_NEGRA_FRANJA.marketplaceListings ?? []).map((l) =>
  listingToRow(FRANJA_ID, l),
)
const itemIds = itemRows.map((r) => r.id)
const listingIds = listingRows.map((r) => r.id as string)

// ── Report ──────────────────────────────────────────────────────────────────

function report() {
  const byType = itemRows.reduce<Record<string, number>>((acc, r) => {
    acc[r.type as string] = (acc[r.type as string] ?? 0) + 1
    return acc
  }, {})
  console.log('Noche Negra → real rows')
  console.log(`  content items : ${itemRows.length}  (${Object.entries(byType).map(([t, n]) => `${t} ${n}`).join(', ')})`)
  console.log(`  listings      : ${listingRows.length}`)
  console.log(`  franja row   : ${FRANJA_ID} (UPDATE in place, marketplace_enabled=${franjaPatch.marketplace_enabled})`)
  const noBody = itemRows.filter(
    (r) =>
      ['noticia', 'review', 'opinion', 'listicle', 'articulo', 'editorial'].includes(r.type as string) &&
      (!r.article_body || (r.article_body as unknown[]).length === 0),
  )
  if (noBody.length > 0) {
    console.log(`  ⚠ ${noBody.length} longform items have no articleBody (bodyPreview only):`)
    console.log(`    ${noBody.map((r) => r.id).join(', ')}`)
  }
}

// ── Phases ──────────────────────────────────────────────────────────────────

async function clearPrevious() {
  // Scoped strictly to this catalogue's own ids — never a broad delete.
  const { error: le } = await supabase.from('marketplace_listings').delete().in('id', listingIds)
  if (le) throw le
  const { error: ie } = await supabase.from('items').delete().in('id', itemIds)
  if (ie) throw ie
}

async function apply() {
  console.log('\n▸ Clearing any previous import (scoped to these ids)…')
  await clearPrevious()

  console.log(`▸ Inserting ${itemRows.length} content items…`)
  const { error: itemErr } = await supabase.from('items').insert(itemRows)
  if (itemErr) throw itemErr

  console.log(`▸ Inserting ${listingRows.length} marketplace listings…`)
  const { error: listErr } = await supabase.from('marketplace_listings').insert(listingRows)
  if (listErr) throw listErr

  console.log('▸ Enriching the franja row…')
  const { error: franjaErr } = await supabase
    .from('items')
    .update(franjaPatch as never)
    .eq('id', FRANJA_ID)
  if (franjaErr) throw franjaErr

  console.log('\n✓ Applied.')
}

async function revert() {
  console.log('\n▸ Removing imported rows…')
  await clearPrevious()
  console.log('▸ Resetting the franja row to its pre-import stub…')
  const { error } = await supabase
    .from('items')
    .update({
      subtitle: null,
      franja_url: null,
      links: [] as unknown as object,
      vibe_min: 5,
      vibe_max: 5,
      marketplace_enabled: false,
      marketplace_description: null,
      marketplace_location: null,
      marketplace_currency: null,
    } as never)
    .eq('id', FRANJA_ID)
  if (error) throw error
  console.log('\n✓ Reverted.')
}

async function main() {
  report()
  if (REVERT) return revert()
  if (!APPLY) {
    console.log('\nDry run — nothing written. Re-run with --apply to write to prod.')
    return
  }
  await apply()

  const { count: items } = await supabase
    .from('items')
    .select('*', { count: 'exact', head: true })
    .eq('franja_id', FRANJA_ID)
  const { count: listings } = await supabase
    .from('marketplace_listings')
    .select('*', { count: 'exact', head: true })
    .eq('franja_id', FRANJA_ID)
  console.log(`  verified in DB → ${items} items attributed, ${listings} listings`)
}

main().catch((err) => {
  console.error('\n✗ Failed:', err)
  process.exit(1)
})
