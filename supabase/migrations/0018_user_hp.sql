-- 0018_user_hp.sql
-- User-HP backbone — the user-side mirror of the item-HP system.
--
-- Adds `users.engagement_hp` (double precision, never rendered as a number
-- per [[project_user_hp_visibility]]) and a parallel events table that
-- pg_cron rolls into the scalar every 5 min, with a 60-day half-life
-- (slower than any content half-life so dormancy fades over ~2 months).
--
-- The writer side is fully internal: SECURITY DEFINER triggers on existing
-- engagement tables (comment_reactions, saved_comments, user_saves,
-- comments, vibe_checks, items) emit rows into user_hp_events. Clients
-- have no INSERT policy — there is no /api/user-hp-events route and never
-- will be. This means a malicious client can't spoof HP gains; the
-- existing route handlers + RLS that gate the source actions ARE the gate.
--
-- Trophies + the visible-perks layer (avatar frames / firma unlock /
-- emoji unlocks / publisher-only HL chip on own cards) come in later
-- migrations / commits. This migration leaves the scalar real but
-- invisible.

-- ============================================================================
-- USERS — add the engagement scalar + its decay anchor
-- ============================================================================
alter table users
  add column if not exists engagement_hp double precision not null default 0,
  add column if not exists engagement_hp_last_updated_at timestamptz;

comment on column users.engagement_hp is
  'Internal user-HP scalar. NEVER rendered as a number publicly. Drives trophy unlocks + private dashboard widget only.';
comment on column users.engagement_hp_last_updated_at is
  'Decay anchor for engagement_hp. Updated by apply_user_hp_rollup().';


-- ============================================================================
-- USER_HP_EVENTS — pending deltas before rollup
-- ============================================================================
-- Mirrors the shape of hp_events for items. `attribution_key` is the dedup
-- mechanism: when set, a unique partial index prevents double-awards for the
-- same logical event (e.g. one commenter replying 10 times to the same post
-- in a day only credits the author once).

create table user_hp_events (
  id             bigserial primary key,
  user_id        uuid not null references users(id) on delete cascade,
  kind           text not null,
  weight         double precision not null default 1,
  attribution_key text,
  created_at     timestamptz not null default now()
);

create index user_hp_events_window_idx on user_hp_events(created_at);
create index user_hp_events_user_idx on user_hp_events(user_id);
create unique index user_hp_events_attribution_key_idx
  on user_hp_events(attribution_key)
  where attribution_key is not null;

comment on table user_hp_events is
  'Pending engagement deltas for users. Inserts come from SECURITY DEFINER triggers only — no client write path.';
comment on column user_hp_events.attribution_key is
  'Optional dedup key. Format examples: "comment_received:<item_id>:<commenter_id>:<YYYY-MM-DD>", "publish:<item_id>", "vibe_check_cast:<item_id>:<user_id>".';


-- ============================================================================
-- RLS — read self, admin reads all, NO insert policy (triggers only)
-- ============================================================================
alter table user_hp_events enable row level security;

create policy user_hp_events_self_read on user_hp_events
  for select using (user_id = auth.uid());

create policy user_hp_events_admin_read on user_hp_events
  for select using (private.auth_is_admin());

-- Intentionally no INSERT/UPDATE/DELETE policies. SECURITY DEFINER triggers
-- and the rollup function bypass RLS; everything else is denied by default.


-- ============================================================================
-- APPLY_USER_HP_ROLLUP — every 5 min via pg_cron
-- ============================================================================
-- Same shape as apply_hp_rollup() (migration 0008): batch pending deltas,
-- decay current_hp from its anchor, add the deltas, re-anchor to now,
-- consume processed events.
--
-- 60-day half-life. Slower than the slowest content half-life (mix @ 21d).
-- Means a fully-dormant user fades to half over two months — present
-- enough to gate trophies, slow enough that a busy week off doesn't reset
-- progress.

create or replace function apply_user_hp_rollup() returns void
language plpgsql security definer set search_path = 'public'
as $$
declare
  rolled_ids bigint[];
  rec record;
  half_life_hours constant double precision := 1440.0;  -- 60 days
  current_hp double precision;
  dt_hours double precision;
  decayed double precision;
begin
  select array_agg(id) into rolled_ids from user_hp_events;
  if rolled_ids is null then
    return;
  end if;

  for rec in
    select
      u.id,
      u.engagement_hp,
      u.engagement_hp_last_updated_at,
      coalesce(sum(e.weight), 0) as delta
    from users u
    join user_hp_events e on e.user_id = u.id
    where e.id = ANY(rolled_ids)
    group by u.id, u.engagement_hp, u.engagement_hp_last_updated_at
  loop
    current_hp := coalesce(rec.engagement_hp, 0);
    dt_hours := greatest(
      0,
      extract(epoch from (now() - coalesce(rec.engagement_hp_last_updated_at, now()))) / 3600.0
    );
    decayed := current_hp * exp(-ln(2.0) * dt_hours / half_life_hours);

    update users
    set engagement_hp = decayed + rec.delta,
        engagement_hp_last_updated_at = now()
    where id = rec.id;
  end loop;

  delete from user_hp_events where id = ANY(rolled_ids);
end;
$$;

comment on function apply_user_hp_rollup() is
  'Batches pending user_hp_events into users.engagement_hp with decay-aware re-anchoring. 60-day half-life. Runs every 5 min via pg_cron.';

select cron.schedule(
  'user-hp-rollup',
  '*/5 * * * *',
  $job$ select apply_user_hp_rollup() $job$
);


-- ============================================================================
-- TRIGGERS — engagement → user_hp_events
-- ============================================================================
-- Six writers, all SECURITY DEFINER. Each rejects self-rewards (you don't
-- earn HP from your own actions on your own work) and stays defensive
-- against missing FK targets (returns NEW without inserting).
--
-- Weights chosen per the calibration in the planning doc:
--   reaction_received      1.0   anchor: "a comment got a !/? reaction"
--   comment_saved          2.0   bookmark = higher than a thumbs-up
--   item_saved             3.0   item save = highest passive signal
--   comment_received       1.0   per-unique-commenter-per-day dedup
--   vibe_check_cast        0.5   participation prize
--   publish_<type>         2-5   craft cost varies by type
--
-- Vibe-check accuracy bonus (+2 if user landed within 1 of eventual median)
-- is NOT in this migration — it requires extra schema (a credited-at flag
-- on vibe_checks) and post-threshold scanning. Add when there's enough
-- vibe-check volume to make the calculation meaningful.

-- 1. ───────────────────── comment_reactions → reaction_received ─────────
create or replace function emit_user_hp_on_reaction() returns trigger
language plpgsql security definer set search_path = 'public'
as $$
declare
  comment_author uuid;
begin
  select author_id into comment_author from comments where id = NEW.comment_id;
  -- Reject missing FK target or self-reaction.
  if comment_author is null or comment_author = NEW.user_id then
    return NEW;
  end if;
  insert into user_hp_events (user_id, kind, weight)
  values (comment_author, 'reaction_received', 1.0);
  return NEW;
end;
$$;

create trigger comment_reactions_emit_hp
  after insert on comment_reactions
  for each row execute function emit_user_hp_on_reaction();


-- 2. ───────────────────── saved_comments → comment_saved ────────────────
create or replace function emit_user_hp_on_comment_save() returns trigger
language plpgsql security definer set search_path = 'public'
as $$
declare
  comment_author uuid;
begin
  select author_id into comment_author from comments where id = NEW.comment_id;
  if comment_author is null or comment_author = NEW.user_id then
    return NEW;
  end if;
  insert into user_hp_events (user_id, kind, weight)
  values (comment_author, 'comment_saved', 2.0);
  return NEW;
end;
$$;

create trigger saved_comments_emit_hp
  after insert on saved_comments
  for each row execute function emit_user_hp_on_comment_save();


-- 3. ───────────────────── user_saves → item_saved ───────────────────────
create or replace function emit_user_hp_on_item_save() returns trigger
language plpgsql security definer set search_path = 'public'
as $$
declare
  item_creator uuid;
begin
  select created_by into item_creator from items where id = NEW.item_id;
  if item_creator is null or item_creator = NEW.user_id then
    return NEW;
  end if;
  insert into user_hp_events (user_id, kind, weight)
  values (item_creator, 'item_saved', 3.0);
  return NEW;
end;
$$;

create trigger user_saves_emit_hp
  after insert on user_saves
  for each row execute function emit_user_hp_on_item_save();


-- 4. ───────────────────── comments → comment_received ───────────────────
-- Dedup per (commenter, item, day) so reply-bombing one item doesn't farm.
-- The attribution_key unique index makes the ON CONFLICT a no-op.
create or replace function emit_user_hp_on_comment_post() returns trigger
language plpgsql security definer set search_path = 'public'
as $$
declare
  item_creator uuid;
  attr text;
begin
  if NEW.seed then return NEW; end if;
  select created_by into item_creator from items where id = NEW.item_id;
  if item_creator is null or item_creator = NEW.author_id then
    return NEW;
  end if;
  attr := 'comment_received:' || NEW.item_id || ':'
          || NEW.author_id::text || ':'
          || to_char(NEW.created_at at time zone 'utc', 'YYYY-MM-DD');
  insert into user_hp_events (user_id, kind, weight, attribution_key)
  values (item_creator, 'comment_received', 1.0, attr)
  on conflict (attribution_key) do nothing;
  return NEW;
end;
$$;

create trigger comments_emit_hp
  after insert on comments
  for each row execute function emit_user_hp_on_comment_post();


-- 5. ───────────────────── vibe_checks → vibe_check_cast ─────────────────
-- Dedup per (user, item) — re-voting doesn't re-award. The user already
-- got the small participation credit on their first cast.
create or replace function emit_user_hp_on_vibe_check() returns trigger
language plpgsql security definer set search_path = 'public'
as $$
declare
  attr text;
begin
  attr := 'vibe_check_cast:' || NEW.item_id || ':' || NEW.user_id::text;
  insert into user_hp_events (user_id, kind, weight, attribution_key)
  values (NEW.user_id, 'vibe_check_cast', 0.5, attr)
  on conflict (attribution_key) do nothing;
  return NEW;
end;
$$;

create trigger vibe_checks_emit_hp
  after insert on vibe_checks
  for each row execute function emit_user_hp_on_vibe_check();


-- 6. ───────────────────── items (publish) → publish_<type> ──────────────
-- One-shot per item id. Seed rows and partner-type items (admin-only) are
-- excluded. Republishing the same id (delete + recreate) WOULD re-award,
-- but RLS prevents non-admin row recreation with the same id, so this is
-- not a farming vector for users.
create or replace function emit_user_hp_on_publish() returns trigger
language plpgsql security definer set search_path = 'public'
as $$
declare
  publish_weight double precision;
begin
  if NEW.seed or NEW.created_by is null or NEW.type = 'partner' or not NEW.published then
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
$$;

create trigger items_emit_hp_on_publish
  after insert on items
  for each row execute function emit_user_hp_on_publish();
