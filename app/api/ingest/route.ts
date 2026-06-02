import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
      p_image_url: raw.imageUrl ?? '',
      p_genres: raw.genres ?? [],
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
