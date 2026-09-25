import { NextResponse, type NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { WORLD_TAG } from '@/lib/data/tags'
import type { ListingComment } from '@/lib/types'

// /api/listings/[lid]/comments — marketplace listing comments.
//   GET  → list comments (oldest first) with author + isSeller flag.
//   POST → create a comment ({ body, parentId? }) as the authed user.
//
// Listing comments are public-square within the invite-gated site: any authed
// user can read/post. `isSeller` marks comments by a member of the listing's
// franja team (resolved here so the UI can badge seller replies). RLS on
// listing_comments enforces self-write from the DB side.
//
// POST takes an optional `id`: the uuid the client minted, so an answer to a
// question asked a second ago (parent_id) or its deletion names the right
// row before any refresh (lib/store/ids.ts). Only a well-formed uuid, only
// INSERTED — a collision is a 409, never an overwrite.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type AuthorRow = {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  franja_id: string | null
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

function toComment(row: CommentRow, sellerFranjaId: string | null): ListingComment | null {
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
      !!sellerFranjaId && row.author.franja_id === sellerFranjaId,
  }
}

async function sellerFranjaId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  listingId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('marketplace_listings')
    .select('franja_id')
    .eq('id', listingId)
    .maybeSingle()
  return (data as { franja_id?: string | null } | null)?.franja_id ?? null
}

export async function GET(
  _request: NextRequest,
  { params: paramsP }: { params: Promise<{ lid: string }> },
) {
  const params = await paramsP
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data, error }, franjaId] = await Promise.all([
    supabase
      .from('listing_comments')
      .select(
        'id, listing_id, parent_id, body, created_at, edited_at, author:users(id, username, display_name, avatar_url, franja_id)',
      )
      .eq('listing_id', params.lid)
      .order('created_at', { ascending: true }),
    sellerFranjaId(supabase, params.lid),
  ])
  if (error) {
    console.error('[GET listing comments]', error)
    return NextResponse.json({ error: 'Failed to load comments' }, { status: 500 })
  }
  const comments = ((data ?? []) as unknown as CommentRow[])
    .map((r) => toComment(r, franjaId))
    .filter((c): c is ListingComment => c !== null)
  return NextResponse.json({ comments })
}

export async function POST(
  request: NextRequest,
  { params: paramsP }: { params: Promise<{ lid: string }> },
) {
  const params = await paramsP
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let raw: { id?: unknown; body?: unknown; parentId?: unknown }
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const id = typeof raw.id === 'string' && UUID_RE.test(raw.id) ? raw.id.toLowerCase() : undefined
  const body = typeof raw.body === 'string' ? raw.body.trim() : ''
  const parentId = typeof raw.parentId === 'string' ? raw.parentId : null
  if (!body) return NextResponse.json({ error: 'body required' }, { status: 400 })
  if (body.length > 1500) {
    return NextResponse.json({ error: 'El mensaje pasa de 1500 caracteres.' }, { status: 400 })
  }
  if (parentId && !UUID_RE.test(parentId)) {
    return NextResponse.json({ error: 'La pregunta que respondes ya no está.' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('listing_comments')
    .insert({
      ...(id ? { id } : {}),
      listing_id: params.lid,
      author_id: user.id,
      parent_id: parentId,
      body,
    })
    .select(
      'id, listing_id, parent_id, body, created_at, edited_at, author:users(id, username, display_name, avatar_url, franja_id)',
    )
    .single()
  if (error) {
    if (error.code === '42501') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Ya existe un mensaje con ese identificador.' }, { status: 409 })
    }
    // 23503: the listing (or the question answered) is gone.
    if (error.code === '23503') {
      return NextResponse.json({ error: 'Ese anuncio (o la pregunta que respondes) ya no está.' }, { status: 404 })
    }
    console.error('[POST listing comment]', error)
    return NextResponse.json({ error: 'Failed to post comment' }, { status: 500 })
  }
  // Questions and answers under listings are part of the public world.
  revalidateTag(WORLD_TAG, { expire: 0 })
  const franjaId = await sellerFranjaId(supabase, params.lid)
  return NextResponse.json({
    comment: toComment(data as unknown as CommentRow, franjaId),
  })
}
