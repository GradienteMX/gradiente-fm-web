import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { contentItemToRow } from '@/lib/data/items'
import type { ContentItem } from '@/lib/types'

// POST /api/admin/events
//
// Admin-only write for the events listing editor (/admin?tab=events). Handles
// BOTH editing an existing event and creating a new one in a single upsert.
//
// Authorization: the caller must be an admin (users.role === 'admin'). We check
// that against the cookie-aware client (the user's own session), THEN do the
// actual writes with the service-role client so the admin can edit events
// authored by anyone — the items_staff_write RLS policy would also allow it,
// but service-role keeps us off the partner-stamping path in /api/items and
// lets us preserve the original author.
//
// Body: { event: ContentItem, venueAddress?: string | null }
//   - event: the full ContentItem (entities[] carries linked DJs/venue/promoter).
//   - venueAddress: written onto the linked venue entity (entities.address,
//     migration 0039) so it's reused across that venue's events.

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { event?: unknown; venueAddress?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const event = body.event as ContentItem | undefined
  if (!event || typeof event.title !== 'string' || !event.title.trim()) {
    return NextResponse.json({ error: 'event.title required' }, { status: 400 })
  }
  if (event.type !== 'evento') {
    return NextResponse.json({ error: 'event.type must be evento' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Resolve id/slug. New rows (no usable id, or the composer's placeholder)
  // get a fresh uuid + a slug derived from the title.
  const isNew = !event.id || event.id === 'draft-evento' || event.id.startsWith('new-')
  const id = isNew ? crypto.randomUUID() : event.id
  const slug = (event.slug && event.slug.trim()) || slugify(event.title)

  const row = contentItemToRow({ ...event, id, slug })

  // Preserve the original author on edits — only stamp created_by on insert.
  const insertExtras = isNew ? { created_by: user.id } : {}

  const { error: itemError } = await admin
    .from('items')
    .upsert({ ...row, ...insertExtras } as never, { onConflict: 'id' })
  if (itemError) {
    console.error('[POST /api/admin/events] upsert failed', {
      code: itemError.code,
      message: itemError.message,
      details: itemError.details,
      id,
    })
    return NextResponse.json({ error: itemError.message }, { status: 500 })
  }

  // Sync scene-entity links (item_entities, migration 0029). Delete-then-insert
  // keeps it idempotent — dropping a DJ removes its link. Entities themselves
  // are never deleted here, only the join rows. Mirrors the block in
  // app/api/items/route.ts.
  if (Array.isArray(event.entities)) {
    await admin.from('item_entities').delete().eq('item_id', id)
    const links = event.entities
      .filter((e) => typeof e?.id === 'string' && e.id)
      .map((e) => ({
        item_id: id,
        entity_id: e.id,
        relation: e.relation ?? ('subject' as const),
      }))
    if (links.length > 0) {
      const { error: linkError } = await admin
        .from('item_entities')
        .insert(links)
      if (linkError) {
        console.error('[POST /api/admin/events] item_entities sync failed', {
          code: linkError.code,
          message: linkError.message,
          id,
        })
      }
    }
  }

  // Venue address → the linked venue entity (entities.address, migration 0039).
  // Reused across every event at that venue. Only the first linked venue is
  // treated as canonical.
  const venue = Array.isArray(event.entities)
    ? event.entities.find((e) => e.kind === 'venue')
    : undefined
  const venueAddress =
    typeof body.venueAddress === 'string' ? body.venueAddress.trim() : null
  if (venue?.id && body.venueAddress !== undefined) {
    const { error: addrError } = await admin
      .from('entities')
      .update({ address: venueAddress || null } as never)
      .eq('id', venue.id)
    if (addrError) {
      console.error('[POST /api/admin/events] venue address update failed', {
        code: addrError.code,
        message: addrError.message,
        venueId: venue.id,
      })
    }
  }

  return NextResponse.json({ ok: true, id, slug })
}
