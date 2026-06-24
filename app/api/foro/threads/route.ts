import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  FORO_THREAD_GENRES_MAX,
  FORO_THREAD_GENRES_MIN,
  FORO_THREAD_IMAGES_MAX,
  FORO_THREAD_TAGS_MAX,
  FORO_THREAD_TAGS_MIN,
} from '@/lib/types'

// POST /api/foro/threads { subject, body, imageUrls[], genres[], tags[] }
//
// At least one image is mandatory on OP (per spec). imageUrls[0] is the
// cover, mirrored into the legacy `image_url not null` column for cheap tile
// reads; the full ordered gallery goes into `image_urls` (migration 0036).
// Genres enforced 1–5; tags enforced 1–5 (metadata keywords). RLS gates via
// foro_threads_authenticated_insert (any auth'd user, must set author_id =
// auth.uid()).
//
// Back-compat: an older client sending a single `imageUrl` string still works
// — it's folded into a one-element gallery.

interface Body {
  subject?: unknown
  body?: unknown
  imageUrl?: unknown
  imageUrls?: unknown
  genres?: unknown
  tags?: unknown
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim())
    : []
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let raw: Body
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const subject = typeof raw.subject === 'string' ? raw.subject.trim() : ''
  const body = typeof raw.body === 'string' ? raw.body.trim() : ''
  // Prefer the gallery array; fall back to the legacy single field.
  const imageUrls = asStringArray(raw.imageUrls)
  if (imageUrls.length === 0 && typeof raw.imageUrl === 'string' && raw.imageUrl.trim()) {
    imageUrls.push(raw.imageUrl.trim())
  }
  const genres = asStringArray(raw.genres)
  const tags = asStringArray(raw.tags)

  if (!subject) return NextResponse.json({ error: 'subject required' }, { status: 400 })
  if (!body) return NextResponse.json({ error: 'body required' }, { status: 400 })
  if (imageUrls.length === 0) {
    return NextResponse.json({ error: 'at least one image required' }, { status: 400 })
  }
  if (imageUrls.length > FORO_THREAD_IMAGES_MAX) {
    return NextResponse.json(
      { error: `max ${FORO_THREAD_IMAGES_MAX} images` },
      { status: 400 },
    )
  }
  if (genres.length < FORO_THREAD_GENRES_MIN || genres.length > FORO_THREAD_GENRES_MAX) {
    return NextResponse.json(
      { error: `genres must be ${FORO_THREAD_GENRES_MIN}–${FORO_THREAD_GENRES_MAX}` },
      { status: 400 },
    )
  }
  if (tags.length < FORO_THREAD_TAGS_MIN || tags.length > FORO_THREAD_TAGS_MAX) {
    return NextResponse.json(
      { error: `tags must be ${FORO_THREAD_TAGS_MIN}–${FORO_THREAD_TAGS_MAX}` },
      { status: 400 },
    )
  }

  const { data, error } = await supabase
    .from('foro_threads')
    .insert({
      author_id: user.id,
      subject,
      body,
      image_url: imageUrls[0],
      image_urls: imageUrls,
      genres,
      tags,
    })
    .select('id, created_at, bumped_at')
    .single()

  if (error) {
    const isAuthz = error.code === '42501' || error.message.includes('row-level security')
    return NextResponse.json(
      { error: error.message },
      { status: isAuthz ? 403 : 500 },
    )
  }
  return NextResponse.json({ ok: true, thread: data })
}
