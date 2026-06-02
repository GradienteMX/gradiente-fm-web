-- 0025_novelty_weighting.sql
-- Novelty-weighted HP contribution — "box-breaking" under the hood.
--
-- The HP a user GRANTS to content (via hp_events) is scaled by how novel that
-- content is to THEM, across three axes — genre, content-type, and vibe-band.
-- A house-head's repeated house interaction is discounted (~0.8×); their rare
-- jazz interaction is amplified (up to 1.5×). Emergent effect: content drawing
-- interest from outside its usual audience rises more than echo-chamber content.
--
-- Why this is allowed under wiki/90-Decisions/No Algorithm: READS STAY GLOBAL.
-- The feed is still ranked by one shared items.hp scalar, identical for everyone.
-- Only the WRITE WEIGHT is personalized — never the view. No per-user feed.
--
-- It does relax one rule: curation.ts:5 "No per-user logs". This feature needs a
-- private per-user affinity profile (user_axis_affinity below). That profile is
-- never exposed (RLS-locked) and never shown in any UI — consistent with the
-- "HP scalar is private" rule. See wiki/90-Decisions/Novelty Weighting.md.

-- ── Per-user affinity store ──────────────────────────────────────────────────
-- The one new per-user log. PRIVATE: RLS enabled with NO client policies, so it
-- is reachable only by the SECURITY DEFINER function below. Decayed lazily (no
-- cron): each read multiplies weight by exp-decay from updated_at; each write
-- re-anchors. Mirrors the items.hp lazy-decay philosophy.
create table if not exists user_axis_affinity (
  user_id    uuid not null references users(id) on delete cascade,
  axis       text not null check (axis in ('genre', 'type', 'vibe')),
  key        text not null,
  weight     double precision not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, axis, key)
);

alter table user_axis_affinity enable row level security;
-- Intentionally NO policies — private profile, written only by record_hp_event()
-- (SECURITY DEFINER). Direct client access is denied by default.

comment on table user_axis_affinity is
  'Private per-user interaction affinity by axis (genre/type/vibe), decayed ~45d. Drives novelty weighting in record_hp_event(). RLS-locked: reads/writes only via the SECURITY DEFINER function, never exposed to clients. Relaxes the historical "No per-user logs" rule — see wiki/90-Decisions/Novelty Weighting.md.';

-- ── record_hp_event — novelty-weighted insert + affinity update (atomic) ─────
-- Replaces the bare hp_events insert in /api/hp-events. Computes how novel the
-- item's (genre, type, vibe-band) are to the caller, scales the base weight by a
-- bounded multiplier, records the event, and folds this interaction into the
-- caller's affinity. Returns the applied multiplier, or -1 if the item is absent
-- (so the route can 404). The multiplier is NOT surfaced to the client.
--
-- Constants below are the "gentle" spread validated in scripts/noveltySim.mjs
-- (2026-06-02). KEEP IN LOCKSTEP with that file. Tunable here without a code
-- deploy — same convention as harvest_item()'s ECHO_FACTOR.
create or replace function record_hp_event(
  p_item_id text,
  p_kind text,
  p_base_weight double precision
) returns double precision
language plpgsql security definer set search_path = 'public'
as $$
declare
  -- ── gentle spread ──
  M_MIN          constant double precision := 0.6;
  M_MAX          constant double precision := 1.5;
  GAMMA          constant double precision := 1.0;
  W_GENRE        constant double precision := 0.5;
  W_TYPE         constant double precision := 0.2;
  W_VIBE         constant double precision := 0.3;
  HALFLIFE_DAYS  constant double precision := 45.0;
  COLDSTART      constant double precision := 15.0;  -- interactions before novelty engages

  caller uuid;
  it record;
  vibe_mid double precision;
  vibe_band text;
  g text;
  n_genres int;
  contrib_genre double precision;

  genre_total double precision := 0;  genre_hit double precision := 0;
  type_total  double precision := 0;  type_hit  double precision := 0;
  vibe_total  double precision := 0;  vibe_hit  double precision := 0;

  phi_acc double precision := 0;
  w_sum   double precision := 0;
  phi double precision;
  m double precision;
begin
  caller := auth.uid();

  select genres, type::text as ctype, vibe_min, vibe_max
  into it
  from items
  where id = p_item_id;
  if not found then
    return -1;  -- item missing → route maps to 404
  end if;

  -- Anonymous emitter (shouldn't happen — route gates on auth): record at base
  -- weight, skip affinity.
  if caller is null then
    insert into hp_events (item_id, kind, weight) values (p_item_id, p_kind, p_base_weight);
    return 1.0;
  end if;

  vibe_mid := (coalesce(it.vibe_min, 5) + coalesce(it.vibe_max, 5)) / 2.0;
  vibe_band := case when vibe_mid <= 3 then 'low' when vibe_mid <= 6 then 'mid' else 'high' end;
  n_genres := coalesce(array_length(it.genres, 1), 0);

  -- ── Familiarity per axis (decayed on read) ──
  if n_genres > 0 then
    select coalesce(sum(w), 0), coalesce(sum(w) filter (where key = any(it.genres)), 0)
    into genre_total, genre_hit
    from (
      select key, weight * exp(-ln(2.0) * extract(epoch from (now() - updated_at)) / 86400.0 / HALFLIFE_DAYS) as w
      from user_axis_affinity where user_id = caller and axis = 'genre'
    ) s;
  end if;

  select coalesce(sum(w), 0), coalesce(sum(w) filter (where key = it.ctype), 0)
  into type_total, type_hit
  from (
    select key, weight * exp(-ln(2.0) * extract(epoch from (now() - updated_at)) / 86400.0 / HALFLIFE_DAYS) as w
    from user_axis_affinity where user_id = caller and axis = 'type'
  ) s;

  select coalesce(sum(w), 0), coalesce(sum(w) filter (where key = vibe_band), 0)
  into vibe_total, vibe_hit
  from (
    select key, weight * exp(-ln(2.0) * extract(epoch from (now() - updated_at)) / 86400.0 / HALFLIFE_DAYS) as w
    from user_axis_affinity where user_id = caller and axis = 'vibe'
  ) s;

  -- ── Composite familiarity over axes that have history; renormalize weights ──
  if genre_total > 0 then phi_acc := phi_acc + W_GENRE * (genre_hit / genre_total); w_sum := w_sum + W_GENRE; end if;
  if type_total  > 0 then phi_acc := phi_acc + W_TYPE  * (type_hit  / type_total);  w_sum := w_sum + W_TYPE;  end if;
  if vibe_total  > 0 then phi_acc := phi_acc + W_VIBE  * (vibe_hit  / vibe_total);  w_sum := w_sum + W_VIBE;  end if;

  -- Cold start: too little history (type_total ≈ interaction count) → neutral.
  if type_total < COLDSTART or w_sum = 0 then
    m := 1.0;
  else
    phi := phi_acc / w_sum;                       -- 0 = totally novel, 1 = totally familiar
    -- greatest(0, …) guards against a float-rounding negative base if a future
    -- non-integer GAMMA is set (power(neg, non-int) raises).
    m := M_MIN + (M_MAX - M_MIN) * power(greatest(0, 1 - phi), GAMMA);
    m := greatest(M_MIN, least(M_MAX, m));
  end if;

  -- ── Record the engagement event at the effective weight ──
  insert into hp_events (item_id, kind, weight) values (p_item_id, p_kind, p_base_weight * m);

  -- ── Fold this interaction into the caller's affinity (decay-then-add) ──
  if n_genres > 0 then
    contrib_genre := 1.0 / n_genres;
    foreach g in array it.genres loop
      insert into user_axis_affinity (user_id, axis, key, weight, updated_at)
      values (caller, 'genre', g, contrib_genre, now())
      on conflict (user_id, axis, key) do update
        set weight = user_axis_affinity.weight
              * exp(-ln(2.0) * extract(epoch from (now() - user_axis_affinity.updated_at)) / 86400.0 / HALFLIFE_DAYS)
              + excluded.weight,
            updated_at = now();
    end loop;
  end if;

  insert into user_axis_affinity (user_id, axis, key, weight, updated_at)
  values (caller, 'type', it.ctype, 1.0, now())
  on conflict (user_id, axis, key) do update
    set weight = user_axis_affinity.weight
          * exp(-ln(2.0) * extract(epoch from (now() - user_axis_affinity.updated_at)) / 86400.0 / HALFLIFE_DAYS)
          + excluded.weight,
        updated_at = now();

  insert into user_axis_affinity (user_id, axis, key, weight, updated_at)
  values (caller, 'vibe', vibe_band, 1.0, now())
  on conflict (user_id, axis, key) do update
    set weight = user_axis_affinity.weight
          * exp(-ln(2.0) * extract(epoch from (now() - user_axis_affinity.updated_at)) / 86400.0 / HALFLIFE_DAYS)
          + excluded.weight,
        updated_at = now();

  return m;
end;
$$;

grant execute on function record_hp_event(text, text, double precision) to authenticated;

comment on function record_hp_event(text, text, double precision) is
  'Novelty-weighted hp_events insert. Scales p_base_weight by how novel the item''s genre/type/vibe are to auth.uid() (gentle spread — see scripts/noveltySim.mjs), records the event, and updates the caller''s private affinity profile. Returns the applied multiplier (NOT surfaced to clients), or -1 if the item is absent.';
