-- 0021_vibe_check_accuracy_bonus.sql
-- Adds the "your guess landed near the crowd median" bonus, finishing
-- the calibration loop from [[Vibe Philosophy]] idea 4 (grading as
-- engagement). A user who casts a vibe check earns 0.5 ◇ baseline; if
-- their midpoint lands within 1 of the eventual median midpoint AFTER
-- the threshold (5 checks) is crossed, they earn an additional +2 ◇.
--
-- Implementation:
--   * `vibe_checks.hp_credited_at` column tracks "this row has been
--     evaluated for the post-threshold bonus." Inaccurate guesses get
--     the column stamped without an associated user_hp_events row;
--     accurate guesses get both the row AND the stamp. Either way,
--     the row is never re-evaluated.
--   * `apply_vibe_check_bonuses()` runs first inside apply_user_hp_
--     rollup, so any new bonus events land in the SAME tick and don't
--     wait for the next 5-min cycle.
--   * The accuracy threshold is "abs midpoint diff <= 1" — narrow
--     enough that lucky guesses can't farm, loose enough that genuine
--     pattern-readers get rewarded for landing in the right ballpark.

alter table vibe_checks
  add column if not exists hp_credited_at timestamptz;

comment on column vibe_checks.hp_credited_at is
  'Set by apply_vibe_check_bonuses() when this row has been evaluated for the post-threshold accuracy bonus. Once non-null, never re-evaluated.';

create index if not exists vibe_checks_uncredited_idx
  on vibe_checks(item_id)
  where hp_credited_at is null;


-- ============================================================================
-- APPLY_VIBE_CHECK_BONUSES — accuracy-based +2 ◇
-- ============================================================================
create or replace function apply_vibe_check_bonuses() returns void
language plpgsql security definer set search_path = 'public'
as $$
begin
  -- Step 1: award accuracy bonuses for post-threshold checks not yet credited.
  -- "Accurate" means the user's midpoint is within 1 unit of the crowd
  -- median's midpoint. attribution_key dedups in case the function fires
  -- multiple times before the credited_at flag flushes.
  insert into user_hp_events (user_id, kind, weight, attribution_key)
  select
    vc.user_id,
    'vibe_check_accurate',
    2.0,
    'vibe_check_accurate:' || vc.item_id || ':' || vc.user_id::text
  from vibe_checks vc
  join vibe_check_aggregates vca on vca.item_id = vc.item_id
  where vc.hp_credited_at is null
    and vca.check_count >= 5
    and abs(
      ((vc.vibe_min::numeric + vc.vibe_max::numeric) / 2.0) -
      ((vca.median_min::numeric + vca.median_max::numeric) / 2.0)
    ) <= 1
  on conflict (attribution_key) do nothing;

  -- Step 2: stamp ALL post-threshold checks as credited (accurate OR not).
  -- Inaccurate checks get the stamp without a user_hp_events row — the
  -- bonus they'd never earn. This prevents re-scanning the same row
  -- every tick.
  update vibe_checks vc
  set hp_credited_at = now()
  where vc.hp_credited_at is null
    and exists (
      select 1 from vibe_check_aggregates vca
      where vca.item_id = vc.item_id and vca.check_count >= 5
    );
end;
$$;

comment on function apply_vibe_check_bonuses() is
  'Scans post-threshold vibe_checks not yet credited, emits +2 ◇ events for accurate guesses (abs midpoint diff ≤ 1 from crowd median midpoint), and stamps hp_credited_at for all evaluated rows. Called from apply_user_hp_rollup.';


-- ============================================================================
-- APPLY_USER_HP_ROLLUP — call accuracy-bonus FIRST so events land same tick
-- ============================================================================
-- Order:
--   1. apply_vibe_check_bonuses()  -- generate any pending bonus events
--   2. (existing rollup logic)     -- fold all unprocessed events into HP
--   3. apply_trophy_unlocks()      -- re-evaluate trophy conditions

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
  -- Generate any pending vibe-check accuracy bonuses BEFORE the rollup
  -- scan so they land in this tick instead of waiting for the next one.
  perform apply_vibe_check_bonuses();

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
