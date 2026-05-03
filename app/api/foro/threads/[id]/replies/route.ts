import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/foro/threads/[id]/replies { body, imageUrl?, quotedReplyIds? }
//
// RLS gates via foro_replies_authenticated_insert (any auth'd user, must
// set author_id = auth.uid()). The bump trigger (migration 0014) updates
// the parent's bumped_at on insert — server-side, no extra round-trip.
//
// quotedReplyIds is uuid[] in the schema. We pass it through as strings
// (Supabase serializes correctly); invalid uuids would surface as a
// constraint error, but the only writer is the composer which only ever
// quotes ids it just rendered, so this stays clean in practice.

interface Body {
  body?: unknown
  imageUrl?: unknown
  quotedReplyIds?: unknown
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
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

  const body = typeof raw.body === 'string' ? raw.body.trim() : ''
  const imageUrl = typeof raw.imageUrl === 'string' && raw.imageUrl.trim().length > 0
    ? raw.imageUrl.trim()
    : null
  const quotedReplyIds = Array.isArray(raw.quotedReplyIds)
    ? raw.quotedReplyIds.filter((q): q is string => typeof q === 'string')
    : []

  if (!body) return NextResponse.json({ error: 'body required' }, { status: 400 })

  const { data, error } = await supabase
    .from('foro_replies')
    .insert({
      thread_id: params.id,
      author_id: user.id,
      body,
      image_url: imageUrl,
      quoted_reply_ids: quotedReplyIds,
    })
    .select('id, created_at')
    .single()

  if (error) {
    const isAuthz = error.code === '42501' || error.message.includes('row-level security')
    return NextResponse.json(
      { error: error.message },
      { status: isAuthz ? 403 : 500 },
    )
  }
  return NextResponse.json({ ok: true, reply: data })
}
