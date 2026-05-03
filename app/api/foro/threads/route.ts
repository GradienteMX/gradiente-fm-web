import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { FORO_THREAD_GENRES_MAX, FORO_THREAD_GENRES_MIN } from '@/lib/types'

// POST /api/foro/threads { subject, body, imageUrl, genres }
//
// Image is mandatory on OP (per spec, mirrored as `image_url not null` in
// the schema). Genres array enforced 1–5 by the table check constraint;
// we validate up front for clean 400s. RLS gates via
// foro_threads_authenticated_insert (any auth'd user, must set author_id =
// auth.uid()).

interface Body {
  subject?: unknown
  body?: unknown
  imageUrl?: unknown
  genres?: unknown
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
  const imageUrl = typeof raw.imageUrl === 'string' ? raw.imageUrl.trim() : ''
  const genres = Array.isArray(raw.genres)
    ? raw.genres.filter((g): g is string => typeof g === 'string' && g.length > 0)
    : []

  if (!subject) return NextResponse.json({ error: 'subject required' }, { status: 400 })
  if (!body) return NextResponse.json({ error: 'body required' }, { status: 400 })
  if (!imageUrl) return NextResponse.json({ error: 'imageUrl required' }, { status: 400 })
  if (genres.length < FORO_THREAD_GENRES_MIN || genres.length > FORO_THREAD_GENRES_MAX) {
    return NextResponse.json(
      { error: `genres must be ${FORO_THREAD_GENRES_MIN}–${FORO_THREAD_GENRES_MAX}` },
      { status: 400 },
    )
  }

  const { data, error } = await supabase
    .from('foro_threads')
    .insert({
      author_id: user.id,
      subject,
      body,
      image_url: imageUrl,
      genres,
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
