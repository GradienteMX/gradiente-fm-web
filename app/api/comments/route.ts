import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/comments
// Body: { itemId, parentId?, body }
//
// RLS gates writing — `comments_authenticated_insert` policy requires
// `auth.uid() is not null and author_id = auth.uid()`. We let the policy do
// the work; we only need to attach the calling user's id as author_id.

interface CreateBody {
  itemId: string
  parentId?: string | null
  body: string
}

export async function POST(request: NextRequest) {
  const supabase = createClient()

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

  if (!itemId || !body) {
    return NextResponse.json({ error: 'itemId + body required' }, { status: 400 })
  }
  if (body.length > 4000) {
    return NextResponse.json({ error: 'comment too long (max 4000 chars)' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('comments')
    .insert({
      item_id: itemId,
      parent_id: parentId,
      author_id: user.id,
      body,
    })
    .select('*, comment_reactions(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ comment: data })
}
