import { NextResponse, type NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { WORLD_TAG } from '@/lib/data/tags'

// POST /api/comments
// Body: { id?, itemId, parentId?, body }
//
// RLS gates writing — `comments_authenticated_insert` policy requires
// `auth.uid() is not null and author_id = auth.uid()`. We let the policy do
// the work; we only need to attach the calling user's id as author_id.
//
// `id` (optional): the uuid the client minted for this comment, so an edit,
// a reaction or a reply to it can be sent before any refresh (V2's world
// names rows client-side — lib/store/ids.ts). Only a well-formed uuid is
// taken, and only ever INSERTED: a collision is a 409, never an overwrite.
// Without it the column default mints one.

interface CreateBody {
  id?: unknown
  itemId: string
  parentId?: string | null
  body: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let payload: CreateBody
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const itemId = payload.itemId?.trim()
  const body = payload.body?.trim()
  const parentId = payload.parentId?.trim() || null
  const id = typeof payload.id === 'string' && UUID_RE.test(payload.id) ? payload.id.toLowerCase() : undefined

  if (!itemId || !body) {
    return NextResponse.json({ error: 'itemId + body required' }, { status: 400 })
  }
  if (body.length > 4000) {
    return NextResponse.json({ error: 'El comentario pasa de 4000 caracteres.' }, { status: 400 })
  }
  if (parentId && !UUID_RE.test(parentId)) {
    return NextResponse.json({ error: 'El comentario al que respondes no existe.' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('comments')
    .insert({
      ...(id ? { id } : {}),
      item_id: itemId,
      parent_id: parentId,
      author_id: user.id,
      body,
    })
    .select('*, comment_reactions(*)')
    .single()

  if (error) {
    // 23505: that id is taken (never overwritten). 23503: the piece or the
    // comment answered is gone. 42501: RLS.
    if (error.code === '23505') return NextResponse.json({ error: 'Ya existe un comentario con ese identificador.' }, { status: 409 })
    if (error.code === '23503') return NextResponse.json({ error: 'La pieza o el comentario al que respondes ya no está.' }, { status: 404 })
    if (error.code === '42501') return NextResponse.json({ error: 'No puedes comentar aquí.' }, { status: 403 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Comments are part of the public world every member reads.
  revalidateTag(WORLD_TAG, { expire: 0 })
  return NextResponse.json({ comment: data })
}
