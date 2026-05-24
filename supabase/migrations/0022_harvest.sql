-- 0022_harvest.sql
-- The COSECHAR gesture. Phase 4 of the user-HP arc.
--
-- A publisher can perform one harvest per item, ever. The harvest action:
--   1. Computes the item's current HL from its decay anchor
--   2. Transfers 40% of that HL into the publisher's engagement_hp
--   3. Marks the item with harvested_at + harvested_amount + a 1.7x
--      decay multiplier (the "stigma" — harvested posts fade faster)
--
-- The gesture is a positioned reading of "when has my work done its
-- work" — early harvest = small absolute gain but locks out future
-- HL; late harvest = larger gain but the item has already decayed.
-- Not harvesting at all is a valid path too: the post does its
-- democratic decay job and the publisher gets no personal credit.
--
-- Implementation:
--   * items columns added: harvested_at, harvested_amount,
--     hp_decay_multiplier (default 1.0)
--   * apply_hp_rollup() now multiplies the decay lambda by the
--     hp_decay_multiplier on each item, so the stigma is uniform
--     between read-side computation (lib/curation.ts) and the
--     5-min cron rollup
--   * No new trigger — the /api/items/[id]/harvest route handler
--     does the work in a single transaction (drains item.hp,
--     inserts user_hp_events for the publisher, stamps the
--     sentinels on the item row).

alter table items
  add column if not exists harvested_at timestamptz,
  add column if not exists harvested_amount double precision,
  add column if not exists hp_decay_multiplier double precision not null default 1.0;

comment on column items.harvested_at is
  'When the publisher performed their one-and-only harvest on this item. NULL = not yet harvested.';
comment on column items.harvested_amount is
  'How much HL was transferred into the publisher''s engagement_hp at harvest time. Decorative — useful for the UI "you got X ◇" toast.';
comment on column items.hp_decay_multiplier is
  'Multiplier on the decay lambda for this item. Default 1.0; harvested items become 1.7 ("stigma"). Read in both lib/curation.ts and apply_hp_rollup().';


-- ============================================================================
-- APPLY_HP_ROLLUP — respect the decay multiplier on harvested items
-- ============================================================================
-- Same shape as 0008, but the half_life division is scaled by the item's
-- hp_decay_multiplier. A multiplier of 1.7 effectively shortens the
-- half-life by a factor of 1.7 — a 21-day mix becomes ~12.4 days post-
-- harvest.

create or replace function apply_hp_rollup() returns void
language plpgsql security definer set search_path = 'public'
as $$
declare
  rolled_ids bigint[];
  rec record;
  spawn_hp double precision;
  current_hp double precision;
  half_life double precision;
  decay_multiplier double precision;
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
      coalesce(sum(e.weight), 0) as delta
    from items i
    join hp_events e on e.item_id = i.id
    where e.id = ANY(rolled_ids)
    group by i.id, i.type, i.hp, i.hp_last_updated_at, i.published_at, i.editorial, i.hp_decay_multiplier
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
    decay_multiplier := coalesce(rec.hp_decay_multiplier, 1.0);

    spawn_hp := case when rec.editorial then 50.0 else 20.0 end;
    current_hp := coalesce(rec.hp, spawn_hp);

    dt_hours := greatest(
      0,
      extract(epoch from (now() - coalesce(rec.hp_last_updated_at, rec.published_at))) / 3600.0
    );
    -- Decay scales with the per-item multiplier. Harvested items fade
    -- faster — that's the cost of the harvest.
    decayed := current_hp * exp(-ln(2.0) * dt_hours * decay_multiplier / half_life);

    update items
    set hp = decayed + rec.delta,
        hp_last_updated_at = now()
    where id = rec.id;
  end loop;

  delete from hp_events where id = ANY(rolled_ids);
end;
$$;


-- ============================================================================
-- HARVEST_ITEM — the atomic gesture
-- ============================================================================
-- Called by /api/items/[id]/harvest. SECURITY DEFINER so it can write to
-- user_hp_events (no client INSERT policy), but enforces caller identity
-- explicitly by comparing auth.uid() to items.created_by.
--
-- Returns jsonb so the route can shape its response. On error returns
-- { ok: false, error: '...' }; on success { ok: true, echo: <number> }.
--
-- Constants chosen at the design pass:
--   * 40% echo factor — meaningful gain, real opportunity cost
--   * 1.7x decay multiplier post-harvest — visibly faster fade
-- Both live in the function body. Tunable here without a code deploy.

create or replace function harvest_item(p_item_id text) returns jsonb
language plpgsql security definer set search_path = 'public'
as $$
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
    when 'partner'   then 8760.0
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

  -- Drain the item, set sentinels, ratchet up decay.
  update items
  set hp = current_hp - echo,
      hp_last_updated_at = now(),
      harvested_at = now(),
      harvested_amount = echo,
      hp_decay_multiplier = HARVEST_MULTIPLIER
  where id = p_item_id;

  -- Credit the publisher. attribution_key prevents any future
  -- accidental double-credit if the function were ever re-called for
  -- the same item (which the harvested_at check already blocks above).
  insert into user_hp_events (user_id, kind, weight, attribution_key)
  values (caller_id, 'harvest', echo, 'harvest:' || p_item_id)
  on conflict (attribution_key) do nothing;

  return jsonb_build_object('ok', true, 'echo', echo);
end;
$$;

comment on function harvest_item(text) is
  'Atomic harvest: 40% of current HL transfers to the publisher''s engagement_hp, the item gets a 1.7x decay stigma. One harvest per item, ever — enforced by harvested_at sentinel.';

-- Allow authenticated users to call the function. The function itself
-- enforces caller-must-equal-created_by; this grant is just the connection
-- gate.
grant execute on function harvest_item(text) to authenticated;

