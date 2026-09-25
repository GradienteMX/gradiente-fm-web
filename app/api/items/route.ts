import { requiredFields, errorsFrom } from '@/lib/contentReadiness'
import { NextResponse, type NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'
import { randomUUID } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { WORLD_TAG } from '@/lib/data/tags'
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
//   2. If `item.poll` is set, upsert the corresponding polls row. Poll
//      uniqueness is per item_id, so a re-publish updates the existing poll
//      row (and keeps its id). A NEW poll keeps the uuid the client minted —
//      so a vote cast a second after publishing names the right poll — and
//      only a non-uuid client id (`pl-xyz`, older drafts) gets a
//      server-generated one. The id actually stored is answered as `pollId`.
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
//     member of the row's franja; otherwise 403. On the edit path the row's
//     original `created_by` is PRESERVED (never reassigned to the editor).
// RLS remains the backstop: items_author/staff/franja_team policies re-check
// every write, and a denial surfaces as a clean 403.

type PublishMode = 'create' | 'edit'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  const supabase = await createClient()
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
  // Hard readiness only (title, slug, vibe range, classification, event date).
  // Soft recommendations are the composer's business — they are never
  // enforced here, so pieces published under older rules stay editable.
  if (item.type !== 'franja') {
    const missing = errorsFrom(requiredFields(item.type, item), 'hard')
    if (missing.length) return NextResponse.json({ error: 'incomplete', message: `Revisa: ${missing.join(', ')}` }, { status: 422 })
  }
  // Default to 'edit' so any caller that predates the guard keeps working
  // (the ownership check below still applies to every existing-row write).
  const mode: PublishMode = body.mode === 'create' ? 'create' : 'edit'

  // Franja-authoring detection — look up the authenticated user's franjaId
  // from the users table. If set, this is a franja-team member publishing
  // and the row gets server-stamped with franja attribution fields. See
  // wiki/90-Decisions/Franja Authoring.md.
  //
  // The fields are stamped server-side (not trusted from the client payload)
  // so a non-team user can't fake a franja attribution by setting franjaId
  // in their composer state. Single source of truth: who is the auth user.
  const { data: userRow } = await supabase
    .from('users')
    .select('franja_id, role')
    .eq('id', user.id)
    .maybeSingle()
  const typedUserRow =
    userRow as { franja_id?: string | null; role?: string | null } | null
  const userFranjaId = typedUserRow?.franja_id ?? null
  const userRole = typedUserRow?.role ?? null

  // 1. Upsert the item row. Stamp `created_by` with the current user so the
  //    dashboard's "Publicados" surface can filter to the editor's own work.
  //    Inline cast bypass for `created_by` — added by migration 0012; remove
  //    after `npx supabase gen types typescript` regenerates database.types.ts.
  //
  //    When the user is a franja-team member AND the item is one of the
  //    scene-voice types (evento/mix/noticia/opinion/listicle), stamp
  //    franja attribution: franja_id, source='manual:franja', editorial=true.
  //    The editorial flag makes franja-authored events appear in BOTH the
  //    EventosRail and the main mosaic by default (see Decision note).
  //    house-voice types (editorial/review/articulo) skip the franja stamp
  //    even if the user has franjaId set — those publish as personal
  //    contributions, gated by insider role (canCreateContent).
  const FRANJA_STAMPED_TYPES: ContentItem['type'][] = [
    'evento', 'mix', 'noticia', 'opinion', 'listicle',
  ]
  // Franja attribution is now an explicit, reversible per-item choice
  // (attributeFranja). It used to default ON, which branded EVERYTHING a
  // franja-team member published with their promotora and gave no way to
  // remove it. The three cases:
  //   - attributeFranja === true  → stamp it (franja_id + source + editorial).
  //   - attributeFranja === false → clear any prior stamp (used to turn a
  //     previously-branded item OFF on re-publish / edit).
  //   - undefined (toggle untouched) → leave as-is. On edit the loaded item
  //     already carries franja_id, so omitting the override preserves it; new
  //     items carry no franja_id, so they stay unbranded (opt-in default).
  const isFranjaStampableType =
    !!userFranjaId && FRANJA_STAMPED_TYPES.includes(item.type)
  const stampAsFranja = isFranjaStampableType && item.attributeFranja === true

  // The editorial spawn-HP boost is an editor/guide lever. A non-staff
  // authoring role (curator/insider) publishing their OWN personal (non-
  // franja) item must not self-set it: RLS items_author_insert (migration
  // 0042) enforces editorial=false, so stamp it here in lockstep — otherwise a
  // composer-defaulted editorial:true would 403 the whole publish. Staff
  // (guide/admin) keep the lever via items_staff_insert; franja-stamped items
  // get editorial=true from franjaOverrides below (stampAsFranja short-circuits
  // this, so the two overrides never collide).
  const isStaff = userRole === 'guide' || userRole === 'admin'
  const forceEditorialOff = !stampAsFranja && !isStaff

  // type='franja' rows back franja orgs and are admin-managed (RLS enforces
  // this via items_staff_insert since migration 0044); reject early with a
  // clean message rather than leaking a generic RLS violation.
  if (item.type === 'franja' && userRole !== 'admin') {
    return NextResponse.json(
      { error: 'forbidden', message: 'Solo un administrador puede crear franjas.' },
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
    .select('id, created_by, franja_id')
    .eq('id', item.id)
    .maybeSingle()
  const existingRow = existing as
    | { id: string; created_by: string | null; franja_id: string | null }
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
    // team member of the row's franja. RLS enforces the same set, but a
    // pre-emptive check gives a clean 403 (vs a generic RLS violation) and
    // stops us from stamping over a row we have no business touching.
    const isOwner = existingRow.created_by === user.id
    const isFranjaTeammate =
      !!existingRow.franja_id && userFranjaId === existingRow.franja_id
    if (!isOwner && !isStaff && !isFranjaTeammate) {
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

  // create → stamp published_at=now, seed=false, published=true. `hp` is NOT
  //          sent: the column has no default, so the row still lands with
  //          hp NULL (→ curation spawn default). Sending `hp: null` put hp in
  //          PostgREST's ON CONFLICT DO UPDATE SET list, and Postgres checks
  //          UPDATE privilege on every SET column up front — even when no
  //          conflict happens. 0049 §6 revoked UPDATE on the HP columns from
  //          `authenticated`, so every NEW publish failed 42501 → 403.
  // edit   → omit hp / hp_last_updated_at / published_at / seed / published so
  //          the existing row KEEPS its accrued HP, decay clock, harvest state,
  //          original publish time (no feed bump), and seed flag (a seed row
  //          stays a seed instead of being flipped public by an edit).
  const timingAndState = existingRow
    ? {}
    : {
        published_at: new Date().toISOString(),
        published: true,
        seed: false,
      }

  const franjaOverrides = stampAsFranja
    ? {
        franja_id: userFranjaId,
        source: 'manual:franja' as const,
        editorial: true,
      }
    : isFranjaStampableType && item.attributeFranja === false
      ? { franja_id: null, source: null }
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
        ...franjaOverrides,
        ...editorialOverride,
      } as unknown as typeof row,
      { onConflict: 'id' }
    )
  if (itemError) {
    // 23505: another row already has this slug (items_slug_key) — or, racing
    // a concurrent create, this id. Either way nothing was overwritten.
    if (itemError.code === '23505') {
      const slug = /slug/i.test(`${itemError.message} ${itemError.details ?? ''}`)
      return NextResponse.json(
        {
          error: slug ? 'slug_conflict' : 'id_conflict',
          message: slug
            ? 'Ya existe una pieza con esa dirección (slug). Cámbiala y publica de nuevo.'
            : 'Ya existe un ítem con este id.',
        },
        { status: 409 }
      )
    }
    const isAuthz =
      itemError.message.includes('row-level security') ||
      itemError.code === '42501'
    console.error('[POST /api/items] upsert failed', {
      code: itemError.code,
      message: itemError.message,
      details: itemError.details,
      hint: itemError.hint,
      stampAsFranja,
      itemId: item.id,
      itemType: item.type,
    })
    return NextResponse.json(
      { error: itemError.message },
      { status: isAuthz ? 403 : 500 }
    )
  }

  // Note: `pinned` is no longer single-slot — every pinned item rotates
  // through the HeroCarousel — so nothing is unpinned here.

  // 2. Polls (optional). Look up by item_id (unique constraint) so a
  //    re-publish UPDATEs the existing row instead of inserting a duplicate.
  //
  //    NON-FATAL, like the entity-link sync below: the item row is ALREADY
  //    saved at this point, so a poll hiccup (RLS, stale choice shape, …) must
  //    NOT turn a successful publish into a failure response. Doing so produced
  //    the false-positive "no se pudo publicar" the editor saw on re-publishing
  //    a mix whose change had actually landed. We log it, surface a `warning`
  //    in the 200 body, and let the publish succeed.
  let pollWarning: string | null = null
  let pollId: string | null = null
  if (item.poll) {
    const poll = item.poll
    const { data: existingPoll } = await supabase
      .from('polls')
      .select('id')
      .eq('item_id', item.id)
      .maybeSingle()
    const newPollId = typeof poll.id === 'string' && UUID_RE.test(poll.id) ? poll.id.toLowerCase() : randomUUID()
    const { error: pollError } = existingPoll
      ? await supabase
          .from('polls')
          .update({
            kind: poll.kind,
            prompt: poll.prompt,
            choices: (poll.choices ?? []) as unknown as PollChoice[],
            multi_choice: poll.multiChoice ?? false,
            closes_at: poll.closesAt ?? null,
          })
          .eq('id', existingPoll.id)
      : await supabase.from('polls').insert({
          id: newPollId,
          item_id: item.id,
          kind: poll.kind,
          prompt: poll.prompt,
          choices: (poll.choices ?? []) as unknown as PollChoice[],
          multi_choice: poll.multiChoice ?? false,
          closes_at: poll.closesAt ?? null,
        })
    if (pollError) {
      pollWarning = pollError.message
      console.error('[POST /api/items] poll upsert failed (non-fatal)', {
        code: pollError.code,
        message: pollError.message,
        itemId: item.id,
      })
    } else {
      pollId = existingPoll ? existingPoll.id : newPollId
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
    // Only real entity rows (uuid ids): one composer-side placeholder
    // (`ent-<kind>-<slug>`) would fail the whole batch insert below.
    const links = item.entities
      .filter((e) => typeof e?.id === 'string' && UUID_RE.test(e.id))
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

  // 2c. Sync franja subject links (migration 0051, table item_franjas). Same
  //     delete-then-insert shape as item_entities and equally non-fatal. Ids
  //     are verified against real franja rows with the RLS-blind client so a
  //     stale ref from a renamed/deleted franja is dropped rather than 500ing;
  //     the write itself goes through the user's RLS-scoped client.
  if (Array.isArray(item.franjaRefs)) {
    const wanted = Array.from(new Set(item.franjaRefs
      .map((f) => (typeof f?.id === 'string' ? f.id : ''))
      .filter((id) => id && id !== item.id)))
    let valid: string[] = []
    if (wanted.length > 0) {
      const { data: franjaRows } = await admin
        .from('items')
        .select('id')
        .eq('type', 'franja')
        .in('id', wanted)
      valid = ((franjaRows ?? []) as { id: string }[]).map((r) => r.id)
    }
    const { error: unlinkError } = await supabase.from('item_franjas').delete().eq('item_id', item.id)
    if (unlinkError) {
      console.error('[POST /api/items] item_franjas clear failed', {
        code: unlinkError.code,
        message: unlinkError.message,
        itemId: item.id,
      })
    } else if (valid.length > 0) {
      const { error: linkError } = await supabase
        .from('item_franjas')
        .insert(valid.map((franja_id) => ({ item_id: item.id, franja_id })))
      if (linkError) {
        console.error('[POST /api/items] item_franjas sync failed', {
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

  // The piece (new or edited), its poll, links and attribution are all part
  // of the public world every member reads.
  revalidateTag(WORLD_TAG, { expire: 0 })
  return NextResponse.json({ ok: true, itemId: item.id, pollId, warning: pollWarning })
}
