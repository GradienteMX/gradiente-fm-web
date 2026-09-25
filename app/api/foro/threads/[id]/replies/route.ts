import { NextResponse, type NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { WORLD_TAG } from '@/lib/data/tags'

// POST /api/foro/threads/[id]/replies { id?, body, imageUrl?, quotedReplyIds? }
//
// RLS gates via foro_replies_authenticated_insert (any auth'd user, must
// set author_id = auth.uid()). The bump trigger (migration 0014) updates
// the parent's bumped_at on insert — server-side, no extra round-trip.
//
// `id` (optional): the uuid the client minted, so the reply can be quoted
// (`>>id`) or retired before any refresh (lib/store/ids.ts). Only a
// well-formed uuid is taken, and only INSERTED — a collision is a 409.
//
// quotedReplyIds is uuid[] in the schema: only well-formed uuids are kept
// (a quote of something that isn't a post can't be stored, and shouldn't
// fail the reply). The image must already be stored (see the threads route).

interface Body {
  id?: unknown
  body?: unknown
  imageUrl?: unknown
  quotedReplyIds?: unknown
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(
  request: NextRequest,
  { params: paramsP }: { params: Promise<{ id: string }> },
) {
  const params = await paramsP
  const supabase = await createClient()
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

  const id = typeof raw.id === 'string' && UUID_RE.test(raw.id) ? raw.id.toLowerCase() : undefined
  const body = typeof raw.body === 'string' ? raw.body.trim() : ''
  const imageUrl = typeof raw.imageUrl === 'string' && raw.imageUrl.trim().length > 0
    ? raw.imageUrl.trim()
    : null
  const quotedReplyIds = Array.isArray(raw.quotedReplyIds)
    ? [...new Set(raw.quotedReplyIds.filter((q): q is string => typeof q === 'string' && UUID_RE.test(q)).map((q) => q.toLowerCase()))]
    : []

  if (!body) return NextResponse.json({ error: 'body required' }, { status: 400 })
  if (body.length > 4000) return NextResponse.json({ error: 'La respuesta pasa de 4000 caracteres.' }, { status: 400 })
  if (imageUrl?.startsWith('data:')) {
    return NextResponse.json({ error: 'La imagen debe subirse antes de publicar la respuesta.' }, { status: 422 })
  }
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: 'Ese hilo ya no está.' }, { status: 404 })

  const { data, error } = await supabase
    .from('foro_replies')
    .insert({
      ...(id ? { id } : {}),
      thread_id: params.id,
      author_id: user.id,
      body,
      image_url: imageUrl,
      quoted_reply_ids: quotedReplyIds,
    })
    .select('id, created_at')
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Ya existe una respuesta con ese identificador.' }, { status: 409 })
    if (error.code === '23503') return NextResponse.json({ error: 'Ese hilo ya no está.' }, { status: 404 })
    const isAuthz = error.code === '42501' || error.message.includes('row-level security')
    return NextResponse.json(
      { error: error.message },
      { status: isAuthz ? 403 : 500 },
    )
  }
  // The reply and the thread's bump are part of the public world.
  revalidateTag(WORLD_TAG, { expire: 0 })
  return NextResponse.json({ ok: true, reply: data })
}
