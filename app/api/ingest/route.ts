import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mapScrapedGenres, seedVibeFromGenreIds } from '@/lib/scrapedGenres'

// POST /api/ingest { events: ScrapedEventInput[] }
//
// Source-agnostic ingest for scraped events (RA + Instagram) — the landing
// point for a scraping run (manual/agentic for now). Each event upserts via the
// ingest_scraped_event RPC (migration 0026): idempotent on (source, external_id)
// so re-runs never duplicate, lands published=false (pending review),
// partner-stamped for Instagram. Authz is enforced INSIDE the RPC (admin → any
// source; partner-team → Instagram-only for their own partner), so this route
// only gates on authentication.

interface ScrapedEventInput {
  source: 'scraper:ra' | 'scraper:instagram'
  externalId: string
  partnerId?: string | null
  title: string
  subtitle?: string
  excerpt?: string
  date: string
  endDate?: string | null
  venue?: string
  venueCity?: string
  artists?: string[]
  ticketUrl?: string
  price?: string
  imageUrl?: string
  genres?: string[]
}

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '') // strip combining accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

function sanitizeId(s: string): string {
  return s.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 40)
}

// Rehost an external (e.g. Instagram CDN) image into our own public `uploads`
// bucket so it persists — IG signed URLs expire (~weeks) and can hotlink-fail.
// Server-side fetch (no CORS) → upload as the calling user (storage RLS gates
// writes to their own folder) → return the permanent public URL. Deterministic
// path keyed on the post id so re-ingest overwrites instead of orphaning.
// Best-effort: on any failure, falls back to the original URL.
async function rehostImage(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  externalId: string,
  srcUrl: string,
): Promise<string> {
  try {
    const res = await fetch(srcUrl)
    if (!res.ok) return srcUrl
    const contentType = res.headers.get('content-type') || 'image/jpeg'
    if (!contentType.startsWith('image/')) return srcUrl
    const bytes = await res.arrayBuffer()
    if (bytes.byteLength === 0 || bytes.byteLength > 8_000_000) return srcUrl
    const ext = contentType.includes('png')
      ? 'png'
      : contentType.includes('webp')
        ? 'webp'
        : contentType.includes('gif')
          ? 'gif'
          : 'jpg'
    const path = `${userId}/ig/${sanitizeId(externalId)}.${ext}`
    const { error } = await supabase.storage
      .from('uploads')
      .upload(path, bytes, { contentType, upsert: true, cacheControl: '3600' })
    if (error) return srcUrl
    return supabase.storage.from('uploads').getPublicUrl(path).data.publicUrl
  } catch {
    return srcUrl
  }
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { events?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const events = body.events
  if (!Array.isArray(events) || events.length === 0) {
    return NextResponse.json({ error: 'events[] required' }, { status: 400 })
  }
  if (events.length > 100) {
    return NextResponse.json({ error: 'max 100 events per batch' }, { status: 400 })
  }

  const results: { externalId: string; ok: boolean; id?: string; error?: string }[] = []
  for (const raw of events as ScrapedEventInput[]) {
    if (
      !raw ||
      (raw.source !== 'scraper:ra' && raw.source !== 'scraper:instagram') ||
      typeof raw.externalId !== 'string' ||
      typeof raw.title !== 'string' ||
      typeof raw.date !== 'string'
    ) {
      results.push({
        externalId: String(raw?.externalId ?? '?'),
        ok: false,
        error: 'missing/invalid required fields (source, externalId, title, date)',
      })
      continue
    }

    const ext = sanitizeId(raw.externalId)
    const id = `${raw.source === 'scraper:instagram' ? 'ev-ig-' : 'ev-ra-'}${ext}`
    const slug = `${slugify(raw.title) || 'evento'}-${ext}`.slice(0, 80)

    // Save the flyer into our own bucket. Skip if already a storage URL
    // (idempotent re-ingest) or not an http(s) image.
    const rawImage = (raw.imageUrl ?? '').trim()
    const imageUrl =
      rawImage && /^https?:\/\//i.test(rawImage) && !rawImage.includes('/storage/v1/object/public/')
        ? await rehostImage(supabase, user.id, raw.externalId, rawImage)
        : rawImage

    // Map coarse scraper genres (e.g. RA's "Tech House") onto our taxonomy ids,
    // then derive a provisional vibe band from them. Both are starting points:
    // the ingest RPC seeds vibe on insert and only re-seeds while the row is
    // still ungraded — an editor regrade or crowd Vibe Check takes over. See
    // lib/scrapedGenres.ts.
    const genres = mapScrapedGenres(raw.genres)
    const seed = seedVibeFromGenreIds(genres)

    const { data, error } = await supabase.rpc('ingest_scraped_event', {
      p_source: raw.source,
      p_external_id: raw.externalId,
      p_partner_id: raw.partnerId ?? null,
      p_id: id,
      p_slug: slug,
      p_title: raw.title,
      p_subtitle: raw.subtitle ?? '',
      p_excerpt: raw.excerpt ?? '',
      p_date: raw.date,
      p_end_date: raw.endDate ?? null,
      p_venue: raw.venue ?? '',
      p_venue_city: raw.venueCity ?? '',
      p_artists: raw.artists ?? [],
      p_ticket_url: raw.ticketUrl ?? '',
      p_price: raw.price ?? '',
      p_image_url: imageUrl,
      p_genres: genres,
      p_vibe_min: seed?.vibeMin ?? 5,
      p_vibe_max: seed?.vibeMax ?? 5,
    })

    if (error) {
      results.push({ externalId: raw.externalId, ok: false, error: error.message })
      continue
    }
    const r = data as unknown as { ok: boolean; id?: string; error?: string }
    results.push({
      externalId: raw.externalId,
      ok: r.ok,
      id: r.id,
      error: r.ok ? undefined : r.error,
    })
  }

  const ingested = results.filter((r) => r.ok).length
  return NextResponse.json({
    ok: true,
    ingested,
    failed: results.length - ingested,
    results,
  })
}
