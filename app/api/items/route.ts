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

  // Partner-authoring detection — look up the authenticated user's partnerId
  // from the users table. If set, this is a partner-team member publishing
  // and the row gets server-stamped with partner attribution fields. See
  // wiki/90-Decisions/Partner Authoring.md.
  //
  // The fields are stamped server-side (not trusted from the client payload)
  // so a non-team user can't fake a partner attribution by setting partnerId
  // in their composer state. Single source of truth: who is the auth user.
  const { data: userRow } = await supabase
    .from('users')
    .select('partner_id')
    .eq('id', user.id)
    .maybeSingle()
  const userPartnerId =
    (userRow as { partner_id?: string | null } | null)?.partner_id ?? null

  // 1. Upsert the item row. Stamp `created_by` with the current user so the
  //    dashboard's "Publicados" surface can filter to the editor's own work.
  //    Inline cast bypass for `created_by` — added by migration 0012; remove
  //    after `npx supabase gen types typescript` regenerates database.types.ts.
  //
  //    When the user is a partner-team member AND the item is one of the
  //    scene-voice types (evento/mix/noticia/opinion/listicle), stamp
  //    partner attribution: partner_id, source='manual:partner', editorial=true.
  //    The editorial flag makes partner-authored events appear in BOTH the
  //    EventosRail and the main mosaic by default (see Decision note).
  //    house-voice types (editorial/review/articulo) skip the partner stamp
  //    even if the user has partnerId set — those publish as personal
  //    contributions, gated by insider role (canCreateContent).
  const PARTNER_STAMPED_TYPES: ContentItem['type'][] = [
    'evento', 'mix', 'noticia', 'opinion', 'listicle',
  ]
  // Partner attribution is now an explicit, reversible per-item choice
  // (attributePartner). It used to default ON, which branded EVERYTHING a
  // partner-team member published with their promotora and gave no way to
  // remove it. The three cases:
  //   - attributePartner === true  → stamp it (partner_id + source + editorial).
  //   - attributePartner === false → clear any prior stamp (used to turn a
  //     previously-branded item OFF on re-publish / edit).
  //   - undefined (toggle untouched) → leave as-is. On edit the loaded item
  //     already carries partner_id, so omitting the override preserves it; new
  //     items carry no partner_id, so they stay unbranded (opt-in default).
  const isPartnerStampableType =
    !!userPartnerId && PARTNER_STAMPED_TYPES.includes(item.type)
  const stampAsPartner = isPartnerStampableType && item.attributePartner === true

  const row = contentItemToRow(item)
  const partnerOverrides = stampAsPartner
    ? {
        partner_id: userPartnerId,
        source: 'manual:partner' as const,
        editorial: true,
      }
    : isPartnerStampableType && item.attributePartner === false
      ? { partner_id: null, source: null }
      : {}
  const { error: itemError } = await supabase
    .from('items')
    .upsert(
      { ...row, created_by: user.id, ...partnerOverrides } as unknown as typeof row,
      { onConflict: 'id' }
    )
  if (itemError) {
    const isAuthz =
      itemError.message.includes('row-level security') ||
      itemError.code === '42501'
    console.error('[POST /api/items] upsert failed', {
      code: itemError.code,
      message: itemError.message,
      details: itemError.details,
      hint: itemError.hint,
      stampAsPartner,
      itemId: item.id,
      itemType: item.type,
    })
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

  // 2b. Sync scene-entity links (migration 0029). The composer sends resolved
  //     entities (already created via /api/entities, so each carries an id).
  //     Delete-then-insert keeps re-publish idempotent: an edit that drops an
  //     artist removes its link. Entities themselves are never deleted here —
  //     only the join rows. A failure is non-fatal to the publish (the item is
  //     already saved); we log and continue so a links hiccup can't strand a
  //     published item.
  if (Array.isArray(item.entities)) {
    await supabase.from('item_entities').delete().eq('item_id', item.id)
    const links = item.entities
      .filter((e) => typeof e?.id === 'string' && e.id)
      .map((e) => ({
        item_id: item.id,
        entity_id: e.id,
        relation: e.relation ?? ('subject' as const),
      }))
    if (links.length > 0) {
      const { error: linkError } = await supabase
        .from('item_entities')
        .insert(links)
      if (linkError) {
        console.error('[POST /api/items] item_entities sync failed', {
          code: linkError.code,
          message: linkError.message,
          itemId: item.id,
        })
      }
    }
  }

  // 3. Delete the corresponding draft(s) for this user. Match on id OR slug:
  //    the composer occasionally regenerates the item id between draft-save
  //    and publish, leaving an orphan draft with the same slug as the now-
  //    published row. Without the slug-side match, the orphan persists and
  //    the next publish attempt hits a `items_slug_key` unique-constraint
  //    violation. Idempotent — no matching draft, no-op.
  // Two author-scoped .eq() deletes instead of a single string-interpolated
  // .or(): client-supplied id/slug now flow through PostgREST value-encoding
  // and can no longer inject filter-grammar syntax. Each is idempotent
  // (no matching draft → no-op); the second only runs when slug != id.
  await supabase
    .from('drafts')
    .delete()
    .eq('author_id', user.id)
    .eq('item_payload->>id', item.id)
  if (item.slug !== item.id) {
    await supabase
      .from('drafts')
      .delete()
      .eq('author_id', user.id)
      .eq('item_payload->>slug', item.slug)
  }

  return NextResponse.json({ ok: true, itemId: item.id })
}
