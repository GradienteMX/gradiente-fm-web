import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ContentItem } from '@/lib/types'

// POST /api/drafts { item: ContentItem } → upsert
//
// One row per (author, ContentItem.id). The drafts.id PK is uuid auto-gen
// and stays internal; the natural key from the composer's perspective is
// the ContentItem.id stored inside item_payload jsonb. Every save resends
// the full ContentItem, so item_payload is replaced wholesale on update —
// no field-level merge.
//
// RLS gates self-only via drafts_self_only (using/with-check on
// author_id = auth.uid()). The lookup also filters by author_id explicitly
// for clarity / a clean 0-row condition.

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { item?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const item = body.item as ContentItem | undefined
  if (!item || typeof item.id !== 'string') {
    return NextResponse.json({ error: 'item.id required' }, { status: 400 })
  }

  // Look up an existing draft for this (author, ContentItem.id). jsonb path
  // lookup is unindexed but the per-author drafts list is small (50-row cap
  // in the prototype), so a sequential scan over the user's own rows is fine.
  const { data: existing } = await supabase
    .from('drafts')
    .select('id')
    .eq('author_id', user.id)
    .eq('item_payload->>id', item.id)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('drafts')
      .update({ item_payload: item as unknown as object })
      .eq('id', existing.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, draftId: existing.id, action: 'updated' })
  }

  const { data: inserted, error } = await supabase
    .from('drafts')
    .insert({ author_id: user.id, item_payload: item as unknown as object })
    .select('id, created_at, updated_at')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    ok: true,
    draftId: inserted.id,
    action: 'created',
    createdAt: inserted.created_at,
    updatedAt: inserted.updated_at,
  })
}
