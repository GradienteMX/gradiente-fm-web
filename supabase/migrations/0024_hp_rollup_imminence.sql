-- 0024_hp_rollup_imminence.sql
-- Reconcile the cron HP rollup with the read-side decay math.
--
-- The problem (documented but never fixed — see lib/curation.ts:91 and the
-- header of 0008_pg_cron_jobs.sql): the read-side `currentHp()` modulates the
-- decay lambda for EVENTOS by their imminence (decayLambda, curation.ts:59-81):
--
--   * live window  (1h pre-doors → 1h post-end)  → lambda = 0  (decay frozen)
--   * approaching  (0 < hoursUntilStart < 7 days) → lambda *= (daysUntil/7)^2
--   * stale past   (hoursPastEnd > 30 days)       → lambda *= 2  (archival fade)
--
-- `apply_hp_rollup()` (0008, then 0022 for the harvest multiplier) ignored all
-- of this and always used the flat type half-life. Because the rollup overwrites
-- items.hp AND re-anchors hp_last_updated_at = now() for every item that received
-- an engagement event, a POPULAR UPCOMING EVENT gets flat-decayed + re-anchored
-- on each tick — eroding precisely the imminence lift that is supposed to keep
-- tonight's party on top. The more an upcoming event is clicked, the more its
-- intended slow-decay is clobbered. This fixes that by porting the imminence
-- factor into the rollup so cron and read-side agree.
--
-- Faithful port: imminence is expressed as a multiplicative factor on the base
-- lambda, composed with the harvest decay_multiplier (0022). factor = 0 means
-- "no decay this tick" (the live-window freeze). Non-eventos and eventos with no
-- date keep factor = 1.0 (unchanged behavior).

create or replace function apply_hp_rollup() returns void
language plpgsql security definer set search_path = 'public'
as $$
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
      when 'partner'   then 8760.0
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
$$;

comment on function apply_hp_rollup() is
  'Batches pending hp_events into items.hp with decay-aware re-anchoring. Decay lambda mirrors lib/curation.ts decayLambda: type half-life × harvest decay_multiplier × event-imminence factor. Runs every 5 min via pg_cron (scheduled in 0008).';
