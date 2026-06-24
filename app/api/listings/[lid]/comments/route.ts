import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ListingComment } from '@/lib/types'

// /api/listings/[lid]/comments — marketplace listing comments.
//   GET  → list comments (oldest first) with author + isSeller flag.
//   POST → create a comment ({ body, parentId? }) as the authed user.
//
// Listing comments are public-square within the invite-gated site: any authed
// user can read/post. `isSeller` marks comments by a member of the listing's
// partner team (resolved here so the UI can badge seller replies). RLS on
// listing_comments enforces self-write from the DB side.

type AuthorRow = {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  partner_id: string | null
}

type CommentRow = {
  id: string
  listing_id: string
  parent_id: string | null
  body: string
  created_at: string
  edited_at: string | null
  author: AuthorRow | null
}

function toComment(row: CommentRow, sellerPartnerId: string | null): ListingComment | null {
  if (!row.author) return null
  return {
    id: row.id,
    listingId: row.listing_id,
    parentId: row.parent_id,
    body: row.body,
    createdAt: row.created_at,
    editedAt: row.edited_at ?? undefined,
    author: {
      id: row.author.id,
      username: row.author.username,
      displayName: row.author.display_name,
      avatarUrl: row.author.avatar_url ?? undefined,
    },
    isSeller:
      !!sellerPartnerId && row.author.partner_id === sellerPartnerId,
  }
}

async function sellerPartnerId(
  supabase: ReturnType<typeof createClient>,
  listingId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('marketplace_listings')
    .select('partner_id')
    .eq('id', listingId)
    .maybeSingle()
  return (data as { partner_id?: string | null } | null)?.partner_id ?? null
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { lid: string } },
) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data, error }, partnerId] = await Promise.all([
    supabase
      .from('listing_comments')
      .select(
        'id, listing_id, parent_id, body, created_at, edited_at, author:users(id, username, display_name, avatar_url, partner_id)',
      )
      .eq('listing_id', params.lid)
      .order('created_at', { ascending: true }),
    sellerPartnerId(supabase, params.lid),
  ])
  if (error) {
    console.error('[GET listing comments]', error)
    return NextResponse.json({ error: 'Failed to load comments' }, { status: 500 })
  }
  const comments = ((data ?? []) as unknown as CommentRow[])
    .map((r) => toComment(r, partnerId))
    .filter((c): c is ListingComment => c !== null)
  return NextResponse.json({ comments })
}

export async function POST(
  request: NextRequest,
  { params }: { params: { lid: string } },
) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let raw: { body?: unknown; parentId?: unknown }
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const body = typeof raw.body === 'string' ? raw.body.trim() : ''
  const parentId = typeof raw.parentId === 'string' ? raw.parentId : null
  if (!body) return NextResponse.json({ error: 'body required' }, { status: 400 })
  if (body.length > 1500) {
    return NextResponse.json({ error: 'comment too long' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('listing_comments')
    .insert({
      listing_id: params.lid,
      author_id: user.id,
      parent_id: parentId,
      body,
    })
    .select(
      'id, listing_id, parent_id, body, created_at, edited_at, author:users(id, username, display_name, avatar_url, partner_id)',
    )
    .single()
  if (error) {
    if (error.code === '42501') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    console.error('[POST listing comment]', error)
    return NextResponse.json({ error: 'Failed to post comment' }, { status: 500 })
  }
  const partnerId = await sellerPartnerId(supabase, params.lid)
  return NextResponse.json({
    comment: toComment(data as unknown as CommentRow, partnerId),
  })
}
