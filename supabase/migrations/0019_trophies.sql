-- 0019_trophies.sql
-- Trophy catalog + unlock evaluator. Trophies are one-way: once earned,
-- they stay forever, per [[project_user_hp_visibility]]. They are the
-- visible progression signal — users never see their engagement_hp number,
-- but they see which trophies they've unlocked.
--
-- The TypeScript catalog at lib/trophies.ts holds the display metadata
-- (name, sigil, description). This migration only carries the unlock
-- conditions and stores who has earned what — the key strings between
-- the two MUST stay aligned manually until/unless we move to a config
-- table later.
--
-- Also includes a follow-up fix to migration 0018: the comment_reactions
-- emit trigger gains an attribution_key so toggling !/? on the same
-- comment only credits the author once. Discovered during B-2 smoke
-- testing.


-- ============================================================================
-- USER_TROPHIES — who has earned what, when
-- ============================================================================
create table user_trophies (
  user_id      uuid not null references users(id) on delete cascade,
  trophy_key   text not null,
  earned_at    timestamptz not null default now(),
  primary key (user_id, trophy_key)
);

create index user_trophies_user_idx on user_trophies(user_id, earned_at desc);

comment on table user_trophies is
  'Permanent per-user trophy unlocks. Inserts come from apply_trophy_unlocks() only — no client write path. Once earned, never removed.';


-- ============================================================================
-- RLS — read-all (public profile shows other users'' trophies), no client write
-- ============================================================================
alter table user_trophies enable row level security;

create policy user_trophies_public_read on user_trophies
  for select using (true);

-- No INSERT/UPDATE/DELETE policy. Only the SECURITY DEFINER evaluator writes.


-- ============================================================================
-- FIX: comment_reactions emit trigger — add attribution_key dedup
-- ============================================================================
-- Without dedup, a user toggling !/? on the same comment re-fires the
-- trigger each time (the API deletes the old reaction then inserts the new
-- one; trigger fires only on INSERT). Each unique reactor on each unique
-- comment should award the author exactly once.

create or replace function emit_user_hp_on_reaction() returns trigger
language plpgsql security definer set search_path = 'public'
as $$
declare
  comment_author uuid;
  attr text;
begin
  select author_id into comment_author from comments where id = NEW.comment_id;
  if comment_author is null or comment_author = NEW.user_id then
    return NEW;
  end if;
  attr := 'reaction_received:' || NEW.comment_id::text || ':' || NEW.user_id::text;
  insert into user_hp_events (user_id, kind, weight, attribution_key)
  values (comment_author, 'reaction_received', 1.0, attr)
  on conflict (attribution_key) do nothing;
  return NEW;
end;
$$;


-- ============================================================================
-- APPLY_TROPHY_UNLOCKS — runs at the end of each apply_user_hp_rollup tick
-- ============================================================================
-- For every user with any engagement activity (engagement_hp > 0 or an
-- existing trophy), evaluate each trophy condition and insert any unmet
-- ones. ON CONFLICT DO NOTHING handles the "already earned" case — never
-- re-evaluates a trophy a user already has.
--
-- Conditions reference RAW signals (table counts), not engagement_hp,
-- except for the presence_* trophies which are explicit HP thresholds.
-- Story-shaped trophies stay earned even when the HP they crossed has
-- decayed below threshold — what matters is the act.
--
-- Scaling note: this scan walks every user with activity per tick. At
-- beta scale (~10 users) it''s a few rows per minute of work. When users
-- > 1000, optimize by only walking users whose engagement_hp was
-- mutated in the current rollup window (carry a list out of
-- apply_user_hp_rollup).

create or replace function apply_trophy_unlocks() returns void
language plpgsql security definer set search_path = 'public'
as $$
declare
  uid uuid;
begin
  for uid in
    select id from users where engagement_hp > 0 or seed = false
  loop
    -- versatile_voice: posted in 5+ different content types
    insert into user_trophies (user_id, trophy_key)
    select uid, 'versatile_voice'
    where (
      select count(distinct type)
      from items
      where created_by = uid and seed = false and published = true
    ) >= 5
    on conflict do nothing;

    -- signal_caster: received 10+ ! reactions across own comments
    insert into user_trophies (user_id, trophy_key)
    select uid, 'signal_caster'
    where (
      select count(*)
      from comment_reactions cr
      join comments c on c.id = cr.comment_id
      where c.author_id = uid and cr.kind = 'signal' and c.deletion_at is null
    ) >= 10
    on conflict do nothing;

    -- question_caster: received 10+ ? reactions across own comments
    insert into user_trophies (user_id, trophy_key)
    select uid, 'question_caster'
    where (
      select count(*)
      from comment_reactions cr
      join comments c on c.id = cr.comment_id
      where c.author_id = uid and cr.kind = 'provocative' and c.deletion_at is null
    ) >= 10
    on conflict do nothing;

    -- thread_anchor: started a foro thread that crossed 20 replies
    insert into user_trophies (user_id, trophy_key)
    select uid, 'thread_anchor'
    where exists (
      select 1
      from foro_threads ft
      where ft.author_id = uid
        and ft.deletion_at is null
        and (
          select count(*) from foro_replies fr
          where fr.thread_id = ft.id and fr.deletion_at is null
        ) >= 20
    )
    on conflict do nothing;

    -- crowd_compass: cast 25+ vibe checks
    insert into user_trophies (user_id, trophy_key)
    select uid, 'crowd_compass'
    where (
      select count(*) from vibe_checks where user_id = uid
    ) >= 25
    on conflict do nothing;

    -- published_voice: published 5+ items
    insert into user_trophies (user_id, trophy_key)
    select uid, 'published_voice'
    where (
      select count(*) from items
      where created_by = uid and seed = false and published = true
    ) >= 5
    on conflict do nothing;

    -- presence_* — engagement_hp thresholds. Story-shaped, not numbered:
    --   logged       — 10 ◇  "presence registered"
    --   deep         — 25 ◇  "presence has weight"
    --   persistent   — 50 ◇  "presence sustained"
    --   insider_track— 100 ◇ "surface for insider review"
    insert into user_trophies (user_id, trophy_key)
    select uid, 'presence_logged'
    from users where id = uid and engagement_hp >= 10
    on conflict do nothing;

    insert into user_trophies (user_id, trophy_key)
    select uid, 'presence_deep'
    from users where id = uid and engagement_hp >= 25
    on conflict do nothing;

    insert into user_trophies (user_id, trophy_key)
    select uid, 'presence_persistent'
    from users where id = uid and engagement_hp >= 50
    on conflict do nothing;

    insert into user_trophies (user_id, trophy_key)
    select uid, 'presence_insider_track'
    from users where id = uid and engagement_hp >= 100
    on conflict do nothing;
  end loop;
end;
$$;

comment on function apply_trophy_unlocks() is
  'Evaluates each trophy condition for every active user and inserts unmet unlocks. Idempotent via PK conflict. Called from the user-HP rollup cron.';


-- ============================================================================
-- Chain trophy unlocks onto the user-HP rollup
-- ============================================================================
-- Re-defines apply_user_hp_rollup() to call apply_trophy_unlocks() after
-- the engagement_hp updates land. One cron job, two effects. Trophies
-- thus respond on the same 5-min cadence as HP changes.

create or replace function apply_user_hp_rollup() returns void
language plpgsql security definer set search_path = 'public'
as $$
declare
  rolled_ids bigint[];
  rec record;
  half_life_hours constant double precision := 1440.0;
  current_hp double precision;
  dt_hours double precision;
  decayed double precision;
begin
  select array_agg(id) into rolled_ids from user_hp_events;
  if rolled_ids is null then
    -- still evaluate trophies in case raw-signal trophies were earned
    -- without any new HP events (rare edge case at beta scale)
    perform apply_trophy_unlocks();
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

  perform apply_trophy_unlocks();
end;
$$;
