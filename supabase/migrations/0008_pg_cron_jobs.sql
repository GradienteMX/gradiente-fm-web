-- 0008_pg_cron_jobs.sql
-- Two scheduled jobs (third — orphan storage prune — deferred until JSONB-aware
-- traversal is needed; see wiki/70-Roadmap/Backend Plan.md § Storage cleanup):
--
--   1. apply_hp_rollup()       — every 5 min: decay items.hp from anchor, add
--                                pending hp_events deltas, bump hp_last_updated_at,
--                                consume processed events
--   2. sweep_old_foro_threads()— daily: hard-delete foro_threads with
--                                bumped_at < now() - 30 days (cascades to replies)
--
-- The HP write path (interaction → hp_events insert) isn't built yet, so the
-- rollup runs as a no-op until that lands. Migration now so the schedule + math
-- are in place when signals start flowing.

-- ── pg_cron extension ──────────────────────────────────────────────────────
-- Lives in `cron` schema by Supabase convention; `cron.schedule()` is the
-- public API for registering jobs.
create extension if not exists pg_cron;

-- ── HP rollup ──────────────────────────────────────────────────────────────
-- Mirrors lib/curation.ts decay logic. For each item with pending events:
--   new_hp = decay(stored_hp, hours_since_anchor, half_life_for_type) + Σweights
-- Re-anchors hp_last_updated_at to now() so subsequent reads decay from the
-- new snapshot.
--
-- Half-lives match ATTENTION_HALF_LIFE_HOURS in lib/curation.ts. Event-
-- imminence modulation (slow decay near doors, paused live window) is NOT
-- ported here — V2 once we see how aggressive that needs to be in practice.
-- Worst case for V1: events near their start get slightly over-decayed at
-- rollup time. Read-side rendering still uses the full TS-side math.
--
-- Concurrency: snapshots event IDs upfront so inserts arriving DURING the
-- rollup land in the next batch (not lost, not double-counted).

create or replace function apply_hp_rollup() returns void as $$
declare
  rolled_ids bigint[];
  rec record;
  spawn_hp double precision;
  current_hp double precision;
  half_life double precision;
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
      coalesce(sum(e.weight), 0) as delta
    from items i
    join hp_events e on e.item_id = i.id
    where e.id = ANY(rolled_ids)
    group by i.id, i.type, i.hp, i.hp_last_updated_at, i.published_at, i.editorial
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
      when 'partner'   then 8760.0
      else 168.0
    end;

    spawn_hp := case when rec.editorial then 50.0 else 20.0 end;
    current_hp := coalesce(rec.hp, spawn_hp);

    dt_hours := greatest(
      0,
      extract(epoch from (now() - coalesce(rec.hp_last_updated_at, rec.published_at))) / 3600.0
    );
    decayed := current_hp * exp(-ln(2.0) * dt_hours / half_life);

    update items
    set hp = decayed + rec.delta,
        hp_last_updated_at = now()
    where id = rec.id;
  end loop;

  delete from hp_events where id = ANY(rolled_ids);
end;
$$ language plpgsql security definer set search_path = 'public';

comment on function apply_hp_rollup() is
  'Batches pending hp_events into items.hp deltas with decay-aware re-anchoring. Runs every 5 min via pg_cron.';

-- ── Foro 30-day sweep ──────────────────────────────────────────────────────
-- Imageboard convention: old threads fade. Hard-delete any thread whose
-- bumped_at (last reply or createdAt if no replies) is older than 30 days.
-- foro_replies cascade via FK ON DELETE CASCADE.
--
-- Storage cleanup: NOT done here — image_url paths in deleted threads/replies
-- become orphans in the uploads bucket. The future orphan storage prune
-- (deferred — JSONB-aware traversal needed) handles them. At current scale
-- (4 storage objects) this is fine.

create or replace function sweep_old_foro_threads() returns void as $$
begin
  delete from foro_threads
  where bumped_at < now() - interval '30 days';
end;
$$ language plpgsql security definer set search_path = 'public';

comment on function sweep_old_foro_threads() is
  'Hard-deletes foro_threads (and via FK cascade, their replies) older than 30 days since last bump. Runs daily via pg_cron.';

-- ── Schedule ───────────────────────────────────────────────────────────────
-- HP rollup every 5 min — aligns with Backend Plan § "5-min cadence" so the
-- displayed countdown stays honest with actual feed update time.
--
-- Foro sweep daily at 04:00 UTC (22:00 CDMX) — low-traffic window.
--
-- Idempotent: cron.schedule overwrites a job with the same name. Re-running
-- this migration replaces the schedule cleanly.

select cron.schedule(
  'hp-rollup',
  '*/5 * * * *',
  $job$ select apply_hp_rollup() $job$
);

select cron.schedule(
  'foro-30-day-sweep',
  '0 4 * * *',
  $job$ select sweep_old_foro_threads() $job$
);
