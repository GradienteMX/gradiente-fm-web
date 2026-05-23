-- 0020_user_hp_persistent_dedup.sql
-- Cross-time dedup for the user-HP system. Fixes a gap discovered during
-- Bundle B verification: the attribution_key dedup on user_hp_events
-- only worked WITHIN a single rollup window because the rollup DELETE'd
-- processed events. A user who reacted/saved/unsaved/re-acted across
-- different rollup ticks would re-credit the target each time.
--
-- Fix: keep the events row, mark `processed_at`. The unique partial index
-- on `attribution_key WHERE attribution_key IS NOT NULL` (from 0018) now
-- enforces "one credit per attribution_key, ever."
--
-- Also retro-adds attribution_key to the item_saved and comment_saved
-- triggers, which were the two remaining no-dedup writers. (Reactions
-- were fixed in 0019; the comment/vibe_check/publish triggers already
-- had attribution_key.)
--
-- The events table now grows monotonically. At beta scale this is fine
-- (rows are tiny, indexes are partial). A future migration can add a
-- retention policy if engagement_hp_events crosses ~1M rows.

-- ============================================================================
-- USER_HP_EVENTS — processed_at column
-- ============================================================================
alter table user_hp_events
  add column if not exists processed_at timestamptz;

comment on column user_hp_events.processed_at is
  'Set by apply_user_hp_rollup() when the row is folded into engagement_hp. Once non-null, the row is retained only to enforce attribution_key dedup.';

-- Partial index — the rollup only scans unprocessed rows.
create index if not exists user_hp_events_unprocessed_idx
  on user_hp_events(created_at)
  where processed_at is null;


-- ============================================================================
-- ITEM_SAVED — add attribution_key
-- ============================================================================
-- Without dedup, a user who saves → unsaves → re-saves an item would
-- re-fire the trigger (saved_items toggleSavedItem deletes then inserts).
-- With attribution_key = 'item_saved:<item_id>:<saver_id>', the second
-- attempt hits the unique-index conflict and does nothing.

create or replace function emit_user_hp_on_item_save() returns trigger
language plpgsql security definer set search_path = 'public'
as $$
declare
  item_creator uuid;
  attr text;
begin
  select created_by into item_creator from items where id = NEW.item_id;
  if item_creator is null or item_creator = NEW.user_id then
    return NEW;
  end if;
  attr := 'item_saved:' || NEW.item_id || ':' || NEW.user_id::text;
  insert into user_hp_events (user_id, kind, weight, attribution_key)
  values (item_creator, 'item_saved', 3.0, attr)
  on conflict (attribution_key) do nothing;
  return NEW;
end;
$$;


-- ============================================================================
-- COMMENT_SAVED — add attribution_key
-- ============================================================================
-- Same shape as item_saved. Save → unsave → re-save can't re-credit.

create or replace function emit_user_hp_on_comment_save() returns trigger
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
  attr := 'comment_saved:' || NEW.comment_id::text || ':' || NEW.user_id::text;
  insert into user_hp_events (user_id, kind, weight, attribution_key)
  values (comment_author, 'comment_saved', 2.0, attr)
  on conflict (attribution_key) do nothing;
  return NEW;
end;
$$;


-- ============================================================================
-- APPLY_USER_HP_ROLLUP — UPDATE processed_at instead of DELETE
-- ============================================================================
-- The rollup now scans only unprocessed rows (WHERE processed_at IS NULL)
-- and marks them processed instead of deleting. The attribution_key on
-- each kept row prevents the same logical event from re-firing across
-- ticks.
--
-- Trophy chain stays unchanged.

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
  select array_agg(id) into rolled_ids
  from user_hp_events
  where processed_at is null;

  if rolled_ids is null then
    perform apply_trophy_unlocks();
    return;
  end if;

  for rec in
    select
      u.id, u.engagement_hp, u.engagement_hp_last_updated_at,
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

  update user_hp_events
  set processed_at = now()
  where id = ANY(rolled_ids);

  perform apply_trophy_unlocks();
end;
$$;
