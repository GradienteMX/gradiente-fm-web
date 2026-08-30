import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ContentType } from '@/lib/types'

// GET /api/search?q=<term> → { items: SearchHit[] }
//
// Real search over the items table for the SearchOverlay (the MOCK_ITEMS
// substring scan is retired). Scope mirrors getItems() in lib/data/items.ts:
// published rows only, explicitly filtered (RLS alone would leak a franja
// member's own unpublished drafts — see the note on getItems). Unlike the
// home feed, franjas ARE included: their overlays resolve, and finding a
// franja by name is a legitimate search intent.
//
// Matching is a plain ilike over title / venue / venue_city — no ranking, no
// engagement weighting (No-Algorithm: order is published_at desc, same for
// every viewer). The client caps + debounces; we cap at 30 server-side too.
//
// Auth-gated like every other route here: anon → 401.
//
// NOTE: route.ts may only export HTTP methods as values (next build enforces
// this); SearchHit is a type-only export, erased at compile time.

// Lean row shape the overlay renders — a deliberate subset of ContentItem
// (camelCase, same field names) rather than the full 60-column row.
export interface SearchHit {
  id: string
  slug: string
  title: string
  type: ContentType
  imageUrl?: string
  vibeMin: number
  vibeMax: number
  publishedAt: string
  venue?: string
  venueCity?: string
}

// Keep in lockstep with RESULT_CAP in components/search/SearchOverlay.tsx
// (not exported — route.ts value exports break next build).
const RESULT_CAP = 30

// Allowlisted columns — never `select('*')` here; search is the one endpoint
// an anon-adjacent surface hammers, so it returns only what the rows render.
// `venue_city` is the items column (there is no bare `city` on items).
const SEARCH_SELECT =
  'id, slug, title, type, image_url, vibe_min, vibe_max, published_at, venue, venue_city'

type SearchRowFromDb = {
  id: string
  slug: string
  title: string
  type: ContentType
  image_url: string | null
  vibe_min: number
  vibe_max: number
  published_at: string
  venue: string | null
  venue_city: string | null
}

// The user's term is interpolated into a PostgREST `or=(...ilike...)` filter,
// where `,` separates conditions, `(`/`)` group them, and `%`/`_`/`\` are
// LIKE wildcards/escapes. Strip all of them (→ space) so a query can never
// inject filter syntax or wildcard-scan; collapse the leftover whitespace.
function sanitizeQuery(raw: string): string {
  return raw
    .replace(/[%_\\,()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const raw = (request.nextUrl.searchParams.get('q') ?? '').trim()
  if (raw.length < 2) return NextResponse.json({ items: [] })
  const q = sanitizeQuery(raw)
  if (q.length < 2) return NextResponse.json({ items: [] })

  const pattern = `%${q}%`
  const { data, error } = await supabase
    .from('items')
    .select(SEARCH_SELECT)
    .eq('published', true)
    .or(
      `title.ilike.${pattern},venue.ilike.${pattern},venue_city.ilike.${pattern}`
    )
    .order('published_at', { ascending: false })
    .limit(RESULT_CAP)

  if (error) {
    console.error('[GET /api/search] Supabase error:', error)
    return NextResponse.json({ error: 'search_failed' }, { status: 500 })
  }

  const items: SearchHit[] = ((data ?? []) as unknown as SearchRowFromDb[]).map(
    (row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      type: row.type,
      imageUrl: row.image_url ?? undefined,
      vibeMin: row.vibe_min,
      vibeMax: row.vibe_max,
      publishedAt: row.published_at,
      venue: row.venue ?? undefined,
      venueCity: row.venue_city ?? undefined,
    })
  )
  return NextResponse.json({ items })
}
