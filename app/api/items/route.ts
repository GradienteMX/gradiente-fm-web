import { NextResponse, type NextRequest } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { contentItemToRow } from '@/lib/data/items'
import type { ContentItem, PollChoice } from '@/lib/types'

// POST /api/items { item: ContentItem }
//
// Promote a composer-built ContentItem into the items table — the publish
// flow's load-bearing endpoint. Behavior:
//
//   1. Upsert by `id` (text PK). Same call covers first-time publish AND
//      re-publishing an already-published item after edits — no separate
//      PATCH route needed for the happy path.
//   2. If `item.poll` is set, upsert the corresponding polls row. Client
//      `pl-xyz`-style poll ids are ignored — the polls table uses a
//      server-generated UUID. Poll uniqueness is per item_id, so a
//      re-publish updates the existing poll row.
//   3. Delete the matching draft row for this user (jsonb path lookup, same
//      shape as /api/drafts/[itemId] DELETE). Idempotent — no draft, no-op.
//
// RLS gates writes via items_staff_write (guide/admin) and polls_authoring_write
// (curator/guide/insider/admin). PostgREST returns "new row violates row-level
// security policy" on a denial — we surface that as a clean 403.

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
  if (!item || typeof item.id !== 'string' || typeof item.slug !== 'string') {
    return NextResponse.json({ error: 'item.id and item.slug required' }, { status: 400 })
  }

  // 1. Upsert the item row. Stamp `created_by` with the current user so the
  //    dashboard's "Publicados" surface can filter to the editor's own work.
  //    Inline cast bypass for `created_by` — added by migration 0012; remove
  //    after `npx supabase gen types typescript` regenerates database.types.ts.
  const row = contentItemToRow(item)
  const { error: itemError } = await supabase
    .from('items')
    .upsert(
      { ...row, created_by: user.id } as unknown as typeof row,
      { onConflict: 'id' }
    )
  if (itemError) {
    const isAuthz =
      itemError.message.includes('row-level security') ||
      itemError.code === '42501'
    return NextResponse.json(
      { error: itemError.message },
      { status: isAuthz ? 403 : 500 }
    )
  }

  // 2. Polls (optional). Look up by item_id (unique constraint) so a
  //    re-publish UPDATEs the existing row instead of inserting a duplicate.
  if (item.poll) {
    const poll = item.poll
    const { data: existingPoll } = await supabase
      .from('polls')
      .select('id')
      .eq('item_id', item.id)
      .maybeSingle()
    if (existingPoll) {
      const { error: pollError } = await supabase
        .from('polls')
        .update({
          kind: poll.kind,
          prompt: poll.prompt,
          choices: (poll.choices ?? []) as unknown as PollChoice[],
          multi_choice: poll.multiChoice ?? false,
          closes_at: poll.closesAt ?? null,
        })
        .eq('id', existingPoll.id)
      if (pollError) {
        return NextResponse.json({ error: pollError.message }, { status: 500 })
      }
    } else {
      const { error: pollError } = await supabase.from('polls').insert({
        id: randomUUID(),
        item_id: item.id,
        kind: poll.kind,
        prompt: poll.prompt,
        choices: (poll.choices ?? []) as unknown as PollChoice[],
        multi_choice: poll.multiChoice ?? false,
        closes_at: poll.closesAt ?? null,
      })
      if (pollError) {
        return NextResponse.json({ error: pollError.message }, { status: 500 })
      }
    }
  }

  // 3. Delete the corresponding draft for this user. Idempotent.
  await supabase
    .from('drafts')
    .delete()
    .eq('author_id', user.id)
    .eq('item_payload->>id', item.id)

  return NextResponse.json({ ok: true, itemId: item.id })
}
