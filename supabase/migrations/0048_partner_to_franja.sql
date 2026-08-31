-- ============================================================================
-- 0048_partner_to_franja.sql — rename the Partner concept to Franja, in full
-- ============================================================================
-- "Partner" asserted a two-sided arrangement that only 1 of 78 rows actually
-- had. "Franja" names what the entity OCCUPIES — a band on the dial — which is
-- true regardless of relationship. Commercial arrangement moves out of the
-- taxonomy and becomes an attribute (`items.sponsored`).
--
-- APPLY VIA THE SUPABASE SQL EDITOR — never `supabase db push` (prod migration
-- history is drifted; see the migration-history-drift note). Every definition
-- below was pulled from the LIVE database with pg_get_functiondef, not from the
-- migration files, which are behind prod (`discard_partner_event` exists in the
-- database and in no migration at all).
--
-- ── WHY THE FUNCTION SECTIONS ARE LONG ──────────────────────────────────────
-- Postgres stores objects two ways and only one survives a rename:
--
--   · RLS policies + index predicates are parsed node trees — they reference
--     the enum by OID and columns by attnum. All 9 policies, 4 indexes and 4
--     FKs follow RENAME VALUE / RENAME COLUMN automatically. Nothing to do.
--
--   · plpgsql bodies are stored as SOURCE TEXT, parsed only at execution. A
--     literal 'partner' stops casting to content_type the moment the value is
--     renamed — and throws from whatever hot path calls it. Five functions
--     carry that literal, including the emit_user_hp_on_publish TRIGGER (every
--     publish would fail) and the apply_hp_rollup pg_cron job (which fails
--     SILENTLY into the cron log). None of it is visible to tsc or the tests.
--
-- Second trap: CREATE OR REPLACE cannot rename an input parameter ("cannot
-- change name of input parameter") or a RETURNS TABLE output column. Those
-- functions must be DROPped and CREATEd — and PostgREST calls them with NAMED
-- arguments, so the parameter name is part of the client contract.
--
-- ── CUTOVER ORDER ───────────────────────────────────────────────────────────
-- The app is broken between this commit and the Vercel deploy going green.
-- Run this, then deploy the `rename/franja` branch immediately. Off-peak.
-- ============================================================================

begin;

-- ── 1. Enum values ──────────────────────────────────────────────────────────
-- OID-stable, so policies and index predicates that reference these keep
-- working untouched.

alter type content_type   rename value 'partner'        to 'franja';
alter type content_source rename value 'manual:partner' to 'manual:franja';

-- ── 2. Column renames ───────────────────────────────────────────────────────
-- Metadata-only and instant. `partner_kind` is deliberately NOT renamed here —
-- it is rebuilt in section 3.

alter table items                rename column partner_url            to franja_url;
alter table items                rename column partner_last_updated   to franja_last_updated;
alter table items                rename column partner_id             to franja_id;
alter table users                rename column partner_id             to franja_id;
alter table users                rename column partner_admin          to franja_admin;
alter table invite_codes         rename column intended_partner_id    to intended_franja_id;
alter table invite_codes         rename column intended_partner_admin to intended_franja_admin;
alter table marketplace_listings rename column partner_id             to franja_id;

-- ── 3. Rebuild the kind enum ────────────────────────────────────────────────
-- `promo` and `sponsored` leave the taxonomy. Postgres has no DROP VALUE, so
-- the type is built fresh and swapped rather than renamed.
--
-- Kind now answers ONE question — what IS this franja — and the new `sponsored`
-- flag answers the other: does money change hands. Exactly one row (Passline)
-- carries the flag today.

create type franja_kind as enum (
  'label','promoter','venue','dealer','colectivo',
  'festival','club','medios','mix-series','plataforma'
);

-- cer0 x cient0 and Unos Quantos are collectives, filed under `promo` before a
-- better kind existed (confirmed by Iker, 2026-08-25).
update items set partner_kind = 'colectivo' where partner_kind = 'promo';

alter table items add column if not exists sponsored boolean not null default false;
update items set sponsored = true where id = 'pa-passline';

-- The `using` clause carries Passline sponsored → plataforma during the
-- conversion, which sidesteps assigning a value the OLD type doesn't have.
alter table items
  alter column partner_kind type franja_kind
  using (case partner_kind::text
           when 'sponsored' then 'plataforma'
           else partner_kind::text
         end)::franja_kind;

alter table items rename column partner_kind to franja_kind;
drop type partner_kind;

-- ── 4. Functions whose BODY text must change (CREATE OR REPLACE is enough) ──
-- Same signature, same parameter names — only the stored source needs fixing.

-- 4a. emit_user_hp_on_publish — TRIGGER on items. Carries `NEW.type = 'partner'`.
--     If this is missed, every publish fails closed.
create or replace function public.emit_user_hp_on_publish()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  publish_weight double precision;
begin
  if NEW.seed or NEW.created_by is null or NEW.type = 'franja' or not NEW.published then
    return NEW;
  end if;
  publish_weight := case NEW.type::text
    when 'noticia'   then 2.0
    when 'evento'    then 3.0
    when 'mix'       then 5.0
    when 'review'    then 5.0
    when 'editorial' then 5.0
    when 'articulo'  then 5.0
    when 'opinion'   then 4.0
    when 'listicle'  then 4.0
    else 2.0
  end;
  insert into user_hp_events (user_id, kind, weight, attribution_key)
  values (NEW.created_by, 'publish_' || NEW.type::text, publish_weight, 'publish:' || NEW.id)
  on conflict (attribution_key) do nothing;
  return NEW;
end;
$function$;

-- 4b. harvest_item — the COSECHAR gesture. Carries the half-life CASE.
create or replace function public.harvest_item(p_item_id text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  ECHO_FACTOR constant double precision := 0.4;
  HARVEST_MULTIPLIER constant double precision := 1.7;
  caller_id uuid;
  item_record record;
  spawn_hp double precision;
  half_life double precision;
  decay_multiplier double precision;
  dt_hours double precision;
  current_hp double precision;
  echo double precision;
begin
  caller_id := auth.uid();
  if caller_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select
    id, type::text as type, hp, hp_last_updated_at, published_at,
    editorial, created_by, harvested_at, hp_decay_multiplier
  into item_record
  from items
  where id = p_item_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'item_not_found');
  end if;
  if item_record.created_by is null or item_record.created_by <> caller_id then
    return jsonb_build_object('ok', false, 'error', 'not_publisher');
  end if;
  if item_record.harvested_at is not null then
    return jsonb_build_object('ok', false, 'error', 'already_harvested');
  end if;

  half_life := case item_record.type
    when 'evento'    then 72.0
    when 'mix'       then 504.0
    when 'editorial' then 168.0
    when 'review'    then 336.0
    when 'noticia'   then 48.0
    when 'opinion'   then 240.0
    when 'articulo'  then 336.0
    when 'listicle'  then 336.0
    when 'franja'    then 8760.0
    else 168.0
  end;
  decay_multiplier := coalesce(item_record.hp_decay_multiplier, 1.0);
  spawn_hp := case when item_record.editorial then 50.0 else 20.0 end;

  dt_hours := greatest(
    0,
    extract(epoch from (
      now() - coalesce(item_record.hp_last_updated_at, item_record.published_at)
    )) / 3600.0
  );
  current_hp := coalesce(item_record.hp, spawn_hp)
                * exp(-ln(2.0) * dt_hours * decay_multiplier / half_life);

  echo := current_hp * ECHO_FACTOR;

  update items
  set hp = current_hp - echo,
      hp_last_updated_at = now(),
      harvested_at = now(),
      harvested_amount = echo,
      hp_decay_multiplier = HARVEST_MULTIPLIER
  where id = p_item_id;

  insert into user_hp_events (user_id, kind, weight, attribution_key)
  values (caller_id, 'harvest', echo, 'harvest:' || p_item_id)
  on conflict (attribution_key) do nothing;

  return jsonb_build_object('ok', true, 'echo', echo);
end;
$function$;

-- 4c. apply_hp_rollup — the pg_cron job. THE DANGEROUS ONE: if missed it fails
--     into the cron log with no user-visible symptom, and HP silently stops
--     rolling up until someone notices the curve went flat weeks later.
create or replace function public.apply_hp_rollup()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  rolled_ids bigint[];
  rec record;
  spawn_hp double precision;
  current_hp double precision;
  half_life double precision;
  base_lambda double precision;
  decay_multiplier double precision;
  imminence double precision;
  hours_until_start double precision;
  hours_past_end double precision;
  dt_hours double precision;
  decayed double precision;
begin
  select array_agg(id) into rolled_ids from hp_events;
  if rolled_ids is null then
    return;
  end if;

  for rec in
    select
      i.id,
      i.type::text as type,
      i.hp,
      i.hp_last_updated_at,
      i.published_at,
      i.editorial,
      i.hp_decay_multiplier,
      i.date,
      i.end_date,
      coalesce(sum(e.weight), 0) as delta
    from items i
    join hp_events e on e.item_id = i.id
    where e.id = ANY(rolled_ids)
    group by i.id, i.type, i.hp, i.hp_last_updated_at, i.published_at,
             i.editorial, i.hp_decay_multiplier, i.date, i.end_date
  loop
    half_life := case rec.type
      when 'evento'    then 72.0
      when 'mix'       then 504.0
      when 'editorial' then 168.0
      when 'review'    then 336.0
      when 'noticia'   then 48.0
      when 'opinion'   then 240.0
      when 'articulo'  then 336.0
      when 'listicle'  then 336.0
      when 'franja'    then 8760.0
      else 168.0
    end;
    base_lambda := ln(2.0) / half_life;
    decay_multiplier := coalesce(rec.hp_decay_multiplier, 1.0);

    -- ── Event-imminence modulation — mirrors decayLambda() in lib/curation.ts ──
    imminence := 1.0;
    if rec.type = 'evento' and rec.date is not null then
      hours_until_start := extract(epoch from (rec.date - now())) / 3600.0;
      hours_past_end := extract(epoch from (now() - coalesce(rec.end_date, rec.date))) / 3600.0;

      if hours_until_start <= 1 and hours_past_end <= 1 then
        imminence := 0;                                    -- live window: freeze
      elsif hours_until_start > 0 and hours_until_start < 168 then
        imminence := power((hours_until_start / 24.0) / 7.0, 2);  -- approaching
      elsif hours_past_end > 720 then
        imminence := 2.0;                                  -- >30d past: fade fast
      end if;
    end if;

    spawn_hp := case when rec.editorial then 50.0 else 20.0 end;
    current_hp := coalesce(rec.hp, spawn_hp);

    dt_hours := greatest(
      0,
      extract(epoch from (now() - coalesce(rec.hp_last_updated_at, rec.published_at))) / 3600.0
    );
    -- λ_eff = base × harvest-multiplier × imminence-factor. imminence = 0 → no
    -- decay this tick (matches currentHp returning hp0 unchanged in the live
    -- window); = 1 → flat type decay; (daysUntil/7)^2 → near-frozen approaching;
    -- = 2 → doubled archival fade.
    decayed := current_hp * exp(-base_lambda * decay_multiplier * imminence * dt_hours);

    update items
    set hp = decayed + rec.delta,
        hp_last_updated_at = now()
    where id = rec.id;
  end loop;

  delete from hp_events where id = ANY(rolled_ids);
end;
$function$;

-- 4d. handle_new_auth_user — TRIGGER on auth.users. References the renamed
--     users + invite_codes columns; breaks signup if missed.
create or replace function public.handle_new_auth_user()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'auth'
as $function$
declare
  v_invite_code text;
  v_username text;
  v_invite invite_codes%rowtype;
begin
  -- Seed users (created via service-role auth.admin.createUser with
  -- seed=true metadata) bypass the invite-code check entirely. The seed
  -- script inserts public.users rows directly via the service-role client.
  if coalesce((new.raw_user_meta_data->>'seed')::boolean, false) then
    return new;
  end if;

  v_invite_code := new.raw_user_meta_data->>'invite_code';
  v_username    := new.raw_user_meta_data->>'username';

  if v_invite_code is null then
    raise exception 'signup requires invite_code in user_metadata';
  end if;

  if v_username is null or length(v_username) < 3 then
    raise exception 'signup requires username (min 3 chars) in user_metadata';
  end if;

  -- Lock the invite_codes row to prevent two concurrent signups racing for
  -- the same code.
  select * into v_invite from invite_codes where code = v_invite_code for update;

  if not found then
    raise exception 'invalid invite code';
  end if;

  if v_invite.used_at is not null then
    raise exception 'invite code already used';
  end if;

  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    raise exception 'invite code expired';
  end if;

  -- Apply invite-code metadata to a new public.users profile.
  insert into public.users (
    id, username, display_name, role, is_mod, franja_id, franja_admin
  ) values (
    new.id,
    v_username,
    v_username,                          -- display_name defaults to username; user edits later
    v_invite.intended_role,
    v_invite.intended_is_mod,
    v_invite.intended_franja_id,
    v_invite.intended_franja_admin
  );

  -- Mark the code used. Same transaction → atomic with the user INSERT.
  update invite_codes
  set used_by = new.id, used_at = now()
  where code = v_invite_code;

  return new;
end;
$function$;

-- ── 5. Functions needing DROP + CREATE ──────────────────────────────────────
-- Parameter names or RETURNS TABLE output column names change, which
-- CREATE OR REPLACE refuses. The app calls these with NAMED arguments through
-- PostgREST, so these names are client contract — the `rename/franja` branch
-- already expects the new ones.

-- 5a. peek_invite_card — output columns partner_title / partner_logo_url are
--     read by lib/invitations.ts, which now expects franja_*.
drop function if exists public.peek_invite_card(text);
create function public.peek_invite_card(p_code text)
 returns table(
   card_name text, role user_role, folio integer, folio_denominator integer,
   issued_label text, issued_at timestamp with time zone,
   franja_title text, franja_logo_url text, status text
 )
 language sql
 security definer
 set search_path to 'public'
as $function$
  select
    ic.card_name,
    ic.intended_role,
    ic.folio,
    ic.folio_denominator,
    ic.issued_label,
    ic.created_at,
    p.title,
    p.image_url,
    case
      when ic.used_at is not null then 'used'
      when ic.expires_at is not null and ic.expires_at < now() then 'expired'
      else 'active'
    end
  from public.invite_codes ic
  left join public.items p
    on p.id = ic.intended_franja_id and p.type = 'franja'
  where ic.code = p_code;
$function$;

-- 5b–5d. The team-management RPCs. p_partner_id → p_franja_id.
drop function if exists public.partner_team_add(text, uuid);
create function public.franja_team_add(p_franja_id text, p_user_id uuid)
 returns users
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_caller uuid := auth.uid();
  v_role text;
  v_caller_franja text;
  v_caller_admin boolean;
  v_row public.users;
begin
  if v_caller is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select role, franja_id, franja_admin
    into v_role, v_caller_franja, v_caller_admin
    from public.users where id = v_caller;
  if not (v_role = 'admin'
          or (v_caller_franja = p_franja_id and v_caller_admin = true)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.items where id = p_franja_id and type = 'franja'
  ) then
    raise exception 'franja not found' using errcode = 'P0002';
  end if;
  update public.users
     set franja_id = p_franja_id, franja_admin = false
   where id = p_user_id
   returning * into v_row;
  if not found then
    raise exception 'user not found' using errcode = 'P0002';
  end if;
  return v_row;
end;
$function$;

drop function if exists public.partner_team_set_admin(text, uuid, boolean);
create function public.franja_team_set_admin(p_franja_id text, p_user_id uuid, p_admin boolean)
 returns users
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_caller uuid := auth.uid();
  v_role text;
  v_caller_franja text;
  v_caller_admin boolean;
  v_row public.users;
begin
  if v_caller is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select role, franja_id, franja_admin
    into v_role, v_caller_franja, v_caller_admin
    from public.users where id = v_caller;
  if not (v_role = 'admin'
          or (v_caller_franja = p_franja_id and v_caller_admin = true)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  -- Scope to this franja: cannot promote a user assigned elsewhere.
  update public.users
     set franja_admin = p_admin
   where id = p_user_id and franja_id = p_franja_id
   returning * into v_row;
  if not found then
    raise exception 'user not on this franja team' using errcode = 'P0002';
  end if;
  return v_row;
end;
$function$;

drop function if exists public.partner_team_remove(text, uuid);
create function public.franja_team_remove(p_franja_id text, p_user_id uuid)
 returns users
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_caller uuid := auth.uid();
  v_role text;
  v_caller_franja text;
  v_caller_admin boolean;
  v_row public.users;
begin
  if v_caller is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select role, franja_id, franja_admin
    into v_role, v_caller_franja, v_caller_admin
    from public.users where id = v_caller;
  if not (v_role = 'admin'
          or (v_caller_franja = p_franja_id and v_caller_admin = true)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.users
     set franja_id = null, franja_admin = false
   where id = p_user_id and franja_id = p_franja_id
   returning * into v_row;
  if not found then
    raise exception 'user not on this franja team' using errcode = 'P0002';
  end if;
  return v_row;
end;
$function$;

-- 5e. ingest_scraped_event — the scraper backbone. p_partner_id → p_franja_id.
drop function if exists public.ingest_scraped_event(
  text, text, text, text, text, text, text, text, timestamptz, timestamptz,
  text, text, text[], text, text, text, text[], int, int);
create function public.ingest_scraped_event(
  p_source text, p_external_id text, p_franja_id text, p_id text, p_slug text,
  p_title text, p_subtitle text, p_excerpt text,
  p_date timestamptz, p_end_date timestamptz,
  p_venue text, p_venue_city text, p_artists text[], p_ticket_url text,
  p_price text, p_image_url text, p_genres text[],
  p_vibe_min integer default 5, p_vibe_max integer default 5)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  caller uuid;
  caller_role text;
  caller_franja text;
  result_id text;
  v_min int;
  v_max int;
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

  -- Clamp + order the incoming seed defensively (DB constraint requires
  -- 0 <= vibe_min <= vibe_max <= 10).
  v_min := greatest(0, least(10, coalesce(p_vibe_min, 5)));
  v_max := greatest(0, least(10, coalesce(p_vibe_max, 5)));
  if v_min > v_max then
    v_min := least(v_min, v_max);
    v_max := greatest(v_min, v_max);
  end if;

  select role::text, franja_id into caller_role, caller_franja
  from users where id = caller;

  -- Franja-team members: Instagram-only, own franja only. Admins: anything.
  if coalesce(caller_role, '') <> 'admin' then
    if p_source <> 'scraper:instagram'
       or p_franja_id is null
       or caller_franja is distinct from p_franja_id then
      return jsonb_build_object('ok', false, 'error', 'forbidden');
    end if;
  end if;

  insert into items (
    id, slug, type, title, subtitle, excerpt,
    vibe_min, vibe_max,
    date, end_date, venue, venue_city, artists, ticket_url, price, image_url,
    genres, source, external_id, franja_id,
    published, editorial, elevated, published_at
  ) values (
    p_id, p_slug, 'evento', p_title, nullif(p_subtitle, ''), nullif(p_excerpt, ''),
    v_min, v_max,
    p_date, p_end_date, nullif(p_venue, ''), nullif(p_venue_city, ''),
    coalesce(p_artists, '{}'), nullif(p_ticket_url, ''), nullif(p_price, ''), nullif(p_image_url, ''),
    coalesce(p_genres, '{}'), p_source::content_source, p_external_id, p_franja_id,
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
    -- Re-seed vibe ONLY while the row is still the untouched default (5/5).
    -- A graded band (anything other than 5/5) is editor-owned → preserved.
    vibe_min    = case when items.vibe_min = 5 and items.vibe_max = 5 then excluded.vibe_min else items.vibe_min end,
    vibe_max    = case when items.vibe_min = 5 and items.vibe_max = 5 then excluded.vibe_max else items.vibe_max end,
    franja_id   = coalesce(items.franja_id, excluded.franja_id),
    updated_at  = now()
  returning id into result_id;

  return jsonb_build_object('ok', true, 'id', result_id);
end;
$function$;

-- ── 6. The BORRADORES draft RPCs ────────────────────────────────────────────
-- These three have NO call sites — the MiPartnerSection UI that drove them was
-- deleted in the dashboard revamp, and four pending Instagram events have sat
-- unreachable in prod since 2026-06-02. They are renamed rather than dropped so
-- the flow can be re-hosted in EL PLIEGO later (Iker's call, 2026-08-25: the
-- stranded events themselves are stale and not worth rescuing). Their bodies
-- reference franja_id, so leaving them untouched would leave live landmines.

drop function if exists public.publish_partner_event(text);
create function public.publish_franja_event(p_item_id text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  caller uuid;
  rec record;
begin
  caller := auth.uid();
  if caller is null then return jsonb_build_object('ok', false, 'error', 'unauthorized'); end if;

  select id, franja_id, published into rec from items where id = p_item_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if rec.franja_id is null
     or not exists (select 1 from public.users where id = caller and franja_id = rec.franja_id) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if rec.published then return jsonb_build_object('ok', false, 'error', 'already_published'); end if;

  update items
  set published = true, editorial = true, published_at = now()
  where id = p_item_id;
  return jsonb_build_object('ok', true);
end;
$function$;

drop function if exists public.discard_partner_event(text);
create function public.discard_franja_event(p_item_id text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  caller uuid;
  rec record;
begin
  caller := auth.uid();
  if caller is null then return jsonb_build_object('ok', false, 'error', 'unauthorized'); end if;

  select id, franja_id, published into rec from items where id = p_item_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if rec.franja_id is null
     or not exists (select 1 from public.users where id = caller and franja_id = rec.franja_id) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if rec.published then return jsonb_build_object('ok', false, 'error', 'already_published'); end if;

  delete from items where id = p_item_id;
  return jsonb_build_object('ok', true);
end;
$function$;

drop function if exists public.update_partner_event(
  text, text, text, text, timestamptz, timestamptz, text, text, text[],
  text, text, text, text[], int, int);
create function public.update_franja_event(
  p_item_id text, p_title text, p_subtitle text, p_excerpt text,
  p_date timestamptz, p_end_date timestamptz, p_venue text, p_venue_city text,
  p_artists text[], p_ticket_url text, p_price text, p_image_url text,
  p_genres text[], p_vibe_min integer, p_vibe_max integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  caller uuid;
  rec record;
  v_min int;
  v_max int;
begin
  caller := auth.uid();
  if caller is null then return jsonb_build_object('ok', false, 'error', 'unauthorized'); end if;
  if p_title is null or length(btrim(p_title)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'title_required');
  end if;
  if p_date is null then
    return jsonb_build_object('ok', false, 'error', 'date_required');
  end if;

  select id, franja_id, published, source into rec from items where id = p_item_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if rec.franja_id is null
     or not exists (select 1 from public.users where id = caller and franja_id = rec.franja_id) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if rec.published then return jsonb_build_object('ok', false, 'error', 'already_published'); end if;
  if rec.source is distinct from 'scraper:instagram' then
    return jsonb_build_object('ok', false, 'error', 'not_a_draft');
  end if;

  -- clamp vibe into 0..10, keep min <= max
  v_min := greatest(0, least(10, coalesce(p_vibe_min, 5)));
  v_max := greatest(0, least(10, coalesce(p_vibe_max, 5)));
  if v_min > v_max then v_min := v_max; end if;

  update items set
    title      = btrim(p_title),
    subtitle   = nullif(btrim(coalesce(p_subtitle, '')), ''),
    excerpt    = nullif(btrim(coalesce(p_excerpt, '')), ''),
    date       = p_date,
    end_date   = p_end_date,
    venue      = nullif(btrim(coalesce(p_venue, '')), ''),
    venue_city = nullif(btrim(coalesce(p_venue_city, '')), ''),
    artists    = coalesce(p_artists, '{}'),
    ticket_url = nullif(btrim(coalesce(p_ticket_url, '')), ''),
    price      = nullif(btrim(coalesce(p_price, '')), ''),
    image_url  = nullif(btrim(coalesce(p_image_url, '')), ''),
    genres     = coalesce(p_genres, '{}'),
    vibe_min   = v_min,
    vibe_max   = v_max,
    updated_at = now()
  where id = p_item_id;

  return jsonb_build_object('ok', true);
end;
$function$;

-- ── 7. Re-grant execute ─────────────────────────────────────────────────────
-- DROP took the grants with it; CREATE OR REPLACE (section 4) kept theirs.

grant execute on function public.peek_invite_card(text) to anon, authenticated;
grant execute on function public.franja_team_add(text, uuid) to authenticated;
grant execute on function public.franja_team_set_admin(text, uuid, boolean) to authenticated;
grant execute on function public.franja_team_remove(text, uuid) to authenticated;
grant execute on function public.ingest_scraped_event(
  text, text, text, text, text, text, text, text, timestamptz, timestamptz,
  text, text, text[], text, text, text, text[], int, int) to authenticated;
grant execute on function public.publish_franja_event(text) to authenticated;
grant execute on function public.discard_franja_event(text) to authenticated;
grant execute on function public.update_franja_event(
  text, text, text, text, timestamptz, timestamptz, text, text, text[],
  text, text, text, text[], int, int) to authenticated;

-- ── 8. Cosmetic renames ─────────────────────────────────────────────────────
-- Indexes and FK constraints keep working either way; these just stop the
-- catalog from reading like the old vocabulary.

alter index items_partner_id_idx                rename to items_franja_id_idx;
alter index items_partner_marketplace_idx       rename to items_franja_marketplace_idx;
alter index users_partner_idx                   rename to users_franja_idx;
alter index marketplace_listings_partner_idx    rename to marketplace_listings_franja_idx;

alter table items                rename constraint items_partner_id_fkey                to items_franja_id_fkey;
alter table users                rename constraint users_partner_id_fkey                to users_franja_id_fkey;
alter table invite_codes         rename constraint invite_codes_intended_partner_id_fkey to invite_codes_intended_franja_id_fkey;
alter table marketplace_listings rename constraint marketplace_listings_partner_id_fkey  to marketplace_listings_franja_id_fkey;

commit;

-- ── 9. Reload the PostgREST schema cache ────────────────────────────────────
-- Supabase normally fires this from a DDL event trigger, but confirm rather
-- than assume: a stale cache serves the old column names and every write 400s.

notify pgrst, 'reload schema';

-- ── 10. Verification (run these after, expect the stated results) ───────────
--
--   -- 78, and no 'partner' value survives anywhere:
--   select count(*) from items where type = 'franja';
--
--   -- colectivo 16, plataforma 1, no promo/sponsored kinds:
--   select franja_kind::text, count(*) from items where type='franja' group by 1 order by 2 desc;
--
--   -- exactly 1:
--   select count(*) from items where sponsored;
--
--   -- MUST return zero rows — any hit is a function that still carries the
--   -- old vocabulary in its source text and will throw at runtime:
--   select p.proname
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname in ('public','private')
--      and (p.prosrc ~ '''partner''' or p.prosrc ilike '%partner_id%'
--           or p.prosrc ilike '%partner_admin%' or p.prosrc ilike '%intended_partner%');
--
-- Then exercise the rewritten functions from the app — the type checker cannot
-- see inside a plpgsql body, so only these prove section 4 worked:
--   · publish an item          → emit_user_hp_on_publish
--   · COSECHAR a published item→ harvest_item
--   · peek an invite at /welcome → peek_invite_card
--   · add + remove a team member → franja_team_* RPCs
--   · check the pg_cron run log after the next tick → apply_hp_rollup
-- ============================================================================
