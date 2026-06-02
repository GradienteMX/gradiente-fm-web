-- 0026_event_ingest.sql
-- The source-agnostic ingest backbone for scraped events (RA + Instagram).
-- Every scraping run — manual/agentic for now — lands here: idempotent upsert
-- keyed on (source, external_id) so re-runs never duplicate. RA publishes
-- directly (the editorial firehose, as today); Instagram lands as the partner's
-- PENDING event (published=false) for a team member to verify + publish from
-- their dashboard (MiPartnerSection → BORRADORES).

-- ── Instagram source value ──────────────────────────────────────────────────
-- 'scraper:instagram' was reserved in the pipeline docs but never added to the
-- content_source enum. Add it (idempotent). It is only USED at function-call
-- time (the function body casts a text variable), never as a literal during
-- this migration, so there's no same-transaction "unsafe use of new value".
alter type content_source add value if not exists 'scraper:instagram';

-- ── Dedup key ────────────────────────────────────────────────────────────────
-- Non-partial composite unique so PostgREST/ON CONFLICT can infer it cleanly
-- (a PARTIAL index can't be inferred from a bare ON CONFLICT — see
-- feedback memory partial_index_on_conflict). NULL external_id rows (manual
-- editor content) stay distinct because NULLs never collide in a unique index,
-- so this never fires on non-scraped items.
create unique index if not exists items_source_external_idx
  on items (source, external_id);

-- ── ingest_scraped_event — one event, idempotent, authz-gated ────────────────
-- SECURITY DEFINER so it can write items regardless of the caller's items
-- RLS (partner-team members don't have staff write). Authz enforced in-body:
--   * admins ingest any source.
--   * partner-team members ingest ONLY 'scraper:instagram' for THEIR partner.
-- On insert: RA → published=true (direct firehose); Instagram → published=false
-- (the partner verifies + publishes from their dashboard). Neutral vibe (5/5),
-- no editorial flags. On conflict: refresh ONLY the source-of-truth fields and PRESERVE all
-- editor-owned columns (vibe_min/max, editorial, elevated, pinned, hp,
-- published, harvested_*) — re-running the scraper never un-approves or resets
-- a curated event. Returns { ok, id } or { ok:false, error }.
create or replace function ingest_scraped_event(
  p_source       text,
  p_external_id  text,
  p_partner_id   text,
  p_id           text,
  p_slug         text,
  p_title        text,
  p_subtitle     text,
  p_excerpt      text,
  p_date         timestamptz,
  p_end_date     timestamptz,
  p_venue        text,
  p_venue_city   text,
  p_artists      text[],
  p_ticket_url   text,
  p_price        text,
  p_image_url    text,
  p_genres       text[]
) returns jsonb
language plpgsql security definer set search_path = 'public'
as $$
declare
  caller uuid;
  caller_role text;
  caller_partner text;
  result_id text;
begin
  caller := auth.uid();
  if caller is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;
  if p_source not in ('scraper:ra', 'scraper:instagram') then
    return jsonb_build_object('ok', false, 'error', 'bad_source');
  end if;
  if p_external_id is null or length(p_external_id) = 0 then
    return jsonb_build_object('ok', false, 'error', 'external_id_required');
  end if;

  select role::text, partner_id into caller_role, caller_partner
  from users where id = caller;

  -- Partner-team members: Instagram-only, own partner only. Admins: anything.
  if coalesce(caller_role, '') <> 'admin' then
    if p_source <> 'scraper:instagram'
       or p_partner_id is null
       or caller_partner is distinct from p_partner_id then
      return jsonb_build_object('ok', false, 'error', 'forbidden');
    end if;
  end if;

  insert into items (
    id, slug, type, title, subtitle, excerpt,
    vibe_min, vibe_max,
    date, end_date, venue, venue_city, artists, ticket_url, price, image_url,
    genres, source, external_id, partner_id,
    published, editorial, elevated, published_at
  ) values (
    p_id, p_slug, 'evento', p_title, nullif(p_subtitle, ''), nullif(p_excerpt, ''),
    5, 5,
    p_date, p_end_date, nullif(p_venue, ''), nullif(p_venue_city, ''),
    coalesce(p_artists, '{}'), nullif(p_ticket_url, ''), nullif(p_price, ''), nullif(p_image_url, ''),
    coalesce(p_genres, '{}'), p_source::content_source, p_external_id, p_partner_id,
    (p_source = 'scraper:ra'), false, false, now()  -- RA live; Instagram pending
  )
  on conflict (source, external_id) do update set
    title       = excluded.title,
    subtitle    = excluded.subtitle,
    excerpt     = excluded.excerpt,
    date        = excluded.date,
    end_date    = excluded.end_date,
    venue       = excluded.venue,
    venue_city  = excluded.venue_city,
    artists     = excluded.artists,
    ticket_url  = excluded.ticket_url,
    price       = excluded.price,
    image_url   = excluded.image_url,
    genres      = excluded.genres,
    partner_id  = coalesce(items.partner_id, excluded.partner_id),
    updated_at  = now()
  returning id into result_id;

  return jsonb_build_object('ok', true, 'id', result_id);
end;
$$;

grant execute on function ingest_scraped_event(
  text, text, text, text, text, text, text, text,
  timestamptz, timestamptz, text, text, text[], text, text, text, text[]
) to authenticated;

comment on function ingest_scraped_event(text, text, text, text, text, text, text, text, timestamptz, timestamptz, text, text, text[], text, text, text, text[]) is
  'Idempotent ingest for scraped events. Dedups on (source, external_id). RA → published=true; Instagram → published=false (partner-reviewed). On conflict refreshes only source-of-truth fields, preserving editor-owned columns. Authz: admin any source; partner-team Instagram-only for own partner. See wiki/70-Roadmap/Scraper Pipeline.md.';

-- ── Partner pending visibility ──────────────────────────────────────────────
-- Partner-team members can SELECT their own partner's items (including the
-- unpublished Instagram drafts), so the BORRADORES surface in MiPartnerSection
-- can list them. Combines (OR) with items_authed_read (published=true for all).
create policy items_partner_team_read on items
  for select
  to authenticated
  using (
    partner_id is not null
    and exists (
      select 1 from public.users
       where id = auth.uid() and partner_id = items.partner_id
    )
  );

-- ── publish_partner_event — partner verifies an IG draft → live ─────────────
-- SECURITY DEFINER: any team member of the event's partner may publish a PENDING
-- partner event. Sets published=true + editorial=true (partner events show in
-- both the rail and the mosaic). Source stays 'scraper:instagram' so the
-- (source, external_id) dedup key remains stable across future re-scrapes.
create or replace function publish_partner_event(p_item_id text) returns jsonb
language plpgsql security definer set search_path = 'public'
as $$
declare
  caller uuid;
  rec record;
begin
  caller := auth.uid();
  if caller is null then return jsonb_build_object('ok', false, 'error', 'unauthorized'); end if;

  select id, partner_id, published into rec from items where id = p_item_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if rec.partner_id is null
     or not exists (select 1 from public.users where id = caller and partner_id = rec.partner_id) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if rec.published then return jsonb_build_object('ok', false, 'error', 'already_published'); end if;

  update items
  set published = true, editorial = true, published_at = now()
  where id = p_item_id;
  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function publish_partner_event(text) to authenticated;

-- ── discard_partner_event — partner rejects an IG draft → delete ────────────
-- Only PENDING (published=false) partner events can be discarded, so a live
-- event can never be deleted through this path.
create or replace function discard_partner_event(p_item_id text) returns jsonb
language plpgsql security definer set search_path = 'public'
as $$
declare
  caller uuid;
  rec record;
begin
  caller := auth.uid();
  if caller is null then return jsonb_build_object('ok', false, 'error', 'unauthorized'); end if;

  select id, partner_id, published into rec from items where id = p_item_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if rec.partner_id is null
     or not exists (select 1 from public.users where id = caller and partner_id = rec.partner_id) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if rec.published then return jsonb_build_object('ok', false, 'error', 'already_published'); end if;

  delete from items where id = p_item_id;
  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function discard_partner_event(text) to authenticated;
