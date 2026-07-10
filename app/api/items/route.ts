import { NextResponse, type NextRequest } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { contentItemToRow } from '@/lib/data/items'
import type { ContentItem, PollChoice } from '@/lib/types'

// POST /api/items { item: ContentItem, mode?: 'create' | 'edit' }
//
// Promote a composer-built ContentItem into the items table — the publish
// flow's load-bearing endpoint. Behavior:
//
//   0. Create-vs-edit guard (see below). The upsert-by-id happy path used to
//      trust the client-supplied id blindly, so a "new" publish carrying a
//      stale/leaked id silently OVERWROTE the existing row in place — keeping
//      its HP and bumping it to the top of the feed. The guard makes intent
//      explicit and verifies ownership before any write.
//   1. Upsert by `id` (text PK). Covers first-time publish AND re-publishing
//      an already-published item after edits — no separate PATCH route needed.
//   2. If `item.poll` is set, upsert the corresponding polls row. Client
//      `pl-xyz`-style poll ids are ignored — the polls table uses a
//      server-generated UUID. Poll uniqueness is per item_id, so a
//      re-publish updates the existing poll row.
//   3. Delete the matching draft row for this user (jsonb path lookup, same
//      shape as /api/drafts/[itemId] DELETE). Idempotent — no draft, no-op.
//
// ── Create-vs-edit guard ────────────────────────────────────────────────────
// `mode` declares the caller's intent (default 'edit' for back-compat):
//   - 'create' → this is meant to be a brand-new item. If the id already
//     exists we 409 rather than overwrite it. The client mints a fresh id and
//     retries, so a genuinely-new publish still lands — as a NEW row.
//   - 'edit'   → knowingly editing an existing item. If a row exists, the
//     caller must own it (created_by), be staff (guide/admin), or be a team
//     member of the row's partner; otherwise 403. On the edit path the row's
//     original `created_by` is PRESERVED (never reassigned to the editor).
// RLS remains the backstop: items_author/staff/partner_team policies re-check
// every write, and a denial surfaces as a clean 403.

type PublishMode = 'create' | 'edit'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { item?: unknown; mode?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const item = body.item as ContentItem | undefined
  if (!item || typeof item.id !== 'string' || typeof item.slug !== 'string') {
    return NextResponse.json({ error: 'item.id and item.slug required' }, { status: 400 })
  }
  // Default to 'edit' so any caller that predates the guard keeps working
  // (the ownership check below still applies to every existing-row write).
  const mode: PublishMode = body.mode === 'create' ? 'create' : 'edit'

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
    .select('partner_id, role')
    .eq('id', user.id)
    .maybeSingle()
  const typedUserRow =
    userRow as { partner_id?: string | null; role?: string | null } | null
  const userPartnerId = typedUserRow?.partner_id ?? null
  const userRole = typedUserRow?.role ?? null

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

  // The editorial spawn-HP boost is an editor/guide lever. A non-staff
  // authoring role (curator/insider) publishing their OWN personal (non-
  // partner) item must not self-set it: RLS items_author_insert (migration
  // 0042) enforces editorial=false, so stamp it here in lockstep — otherwise a
  // composer-defaulted editorial:true would 403 the whole publish. Staff
  // (guide/admin) keep the lever via items_staff_insert; partner-stamped items
  // get editorial=true from partnerOverrides below (stampAsPartner short-circuits
  // this, so the two overrides never collide).
  const isStaff = userRole === 'guide' || userRole === 'admin'
  const forceEditorialOff = !stampAsPartner && !isStaff

  // type='partner' rows back partner orgs and are admin-managed (RLS enforces
  // this via items_staff_insert since migration 0044); reject early with a
  // clean message rather than leaking a generic RLS violation.
  if (item.type === 'partner' && userRole !== 'admin') {
    return NextResponse.json(
      { error: 'forbidden', message: 'Solo un administrador puede crear partners.' },
      { status: 403 }
    )
  }

  // ── Create-vs-edit guard ──────────────────────────────────────────────────
  // Look the row up with a service-role (RLS-blind) client so a collision is
  // ALWAYS detected — even against a row the caller couldn't otherwise SELECT.
  // This lookup is read-only; the actual write still goes through the user's
  // RLS-scoped client below.
  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('items')
    .select('id, created_by, partner_id')
    .eq('id', item.id)
    .maybeSingle()
  const existingRow = existing as
    | { id: string; created_by: string | null; partner_id: string | null }
    | null

  if (mode === 'create' && existingRow) {
    // A "new" publish must never overwrite an existing item. The client
    // retries with a freshly-minted id, so the new content still publishes —
    // as its own row — instead of clobbering whatever this id points at.
    return NextResponse.json(
      { error: 'id_conflict', message: 'Ya existe un ítem con este id.' },
      { status: 409 }
    )
  }

  if (existingRow) {
    // Editing an existing row: the caller must own it, be staff, or be a
    // team member of the row's partner. RLS enforces the same set, but a
    // pre-emptive check gives a clean 403 (vs a generic RLS violation) and
    // stops us from stamping over a row we have no business touching.
    const isOwner = existingRow.created_by === user.id
    const isPartnerTeammate =
      !!existingRow.partner_id && userPartnerId === existingRow.partner_id
    if (!isOwner && !isStaff && !isPartnerTeammate) {
      return NextResponse.json(
        { error: 'forbidden', message: 'No puedes editar este ítem.' },
        { status: 403 }
      )
    }
  }

  const row = contentItemToRow(item)

  // ── Server-authoritative columns ──────────────────────────────────────────
  // HP, publish timing, seed, and the pinned/elevated prominence levers must
  // NOT be client-authoritative. Trusting them from the payload let a
  // same-id republish reset the decay clock (max-freshness feed bump) while
  // keeping accrued HP, refund harvested HP, defeat the harvest fade-stigma,
  // or pin the single hero slot outright. Strip them from the client row and
  // re-derive server-side.
  const {
    hp: _hp,
    hp_last_updated_at: _hpTs,
    published_at: _pubAt,
    pinned: _clientPinned,
    elevated: _clientElevated,
    seed: _seed,
    published: _published,
    ...rowSansAuthority
  } = row

  // pinned/elevated are editor levers — only guide/admin may set them. On a
  // non-staff edit we omit them so existing values persist; on a non-staff
  // create they default off.
  const prominenceLevers = isStaff
    ? { pinned: row.pinned ?? false, elevated: row.elevated ?? false }
    : existingRow
      ? {}
      : { pinned: false, elevated: false }

  // create → stamp published_at=now + spawn HP (null → curation spawn default),
  //          seed=false, published=true.
  // edit   → omit hp / hp_last_updated_at / published_at / seed / published so
  //          the existing row KEEPS its accrued HP, decay clock, harvest state,
  //          original publish time (no feed bump), and seed flag (a seed row
  //          stays a seed instead of being flipped public by an edit).
  const timingAndState = existingRow
    ? {}
    : {
        published_at: new Date().toISOString(),
        hp: null,
        published: true,
        seed: false,
      }

  const partnerOverrides = stampAsPartner
    ? {
        partner_id: userPartnerId,
        source: 'manual:partner' as const,
        editorial: true,
      }
    : isPartnerStampableType && item.attributePartner === false
      ? { partner_id: null, source: null }
      : {}
  const editorialOverride = forceEditorialOff ? { editorial: false as const } : {}
  const { error: itemError } = await supabase
    .from('items')
    .upsert(
      {
        ...rowSansAuthority,
        ...prominenceLevers,
        ...timingAndState,
        // Preserve the original author on an edit; only stamp the current
        // user when creating the row. Prevents a staff/teammate edit from
        // silently reassigning ownership (which would drop the item off the
        // real author's "Publicados" surface and their delete permission).
        created_by: existingRow ? existingRow.created_by : user.id,
        ...partnerOverrides,
        ...editorialOverride,
      } as unknown as typeof row,
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

  // 3. Delete the corresponding draft for this user, keyed on the item id
  //    ONLY. We used to ALSO delete by slug to sweep orphan drafts, but slugs
  //    are auto-generated from titles and collide across a user's unrelated
  //    drafts, so the slug-side delete silently destroyed other in-progress
  //    work (two drafts titled the same → publishing one deleted the other).
  //    Orphan drafts are handled by the composer id lifecycle, not here.
  //    Non-fatal (the item is already saved) but logged so a stale draft that
  //    survives doesn't go unnoticed.
  const { error: draftDelError } = await supabase
    .from('drafts')
    .delete()
    .eq('author_id', user.id)
    .eq('item_payload->>id', item.id)
  if (draftDelError) {
    console.error('[POST /api/items] draft cleanup failed', {
      code: draftDelError.code,
      message: draftDelError.message,
      itemId: item.id,
    })
  }

  return NextResponse.json({ ok: true, itemId: item.id })
}
