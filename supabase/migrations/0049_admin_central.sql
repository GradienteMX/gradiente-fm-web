-- 0049_admin_central.sql
-- The backend for «CENTRAL DE ADMINISTRACIÓN» — the /admin redesign.
--
-- Five independent sections, safe to apply as one transaction:
--
--   §1  hp_events becomes a LEDGER instead of a queue (retention + base_weight)
--   §2  record_hp_event() stores the pre-novelty base weight alongside the scaled one
--   §3  apply_hp_rollup() marks instead of deletes  ← THE HIGH-RISK CHANGE, read §3
--   §4  sweep_old_hp_events() + its cron job, so the ledger stays bounded
--   §5  admin_adjust_item_hp() — the audited beta-calibration HL lever
--   §6  items HP columns become non-writable by `authenticated`
--   §7  reports — the moderation queue's substrate
--
-- HOW TO APPLY: paste into the Supabase SQL editor and run. NEVER `supabase
-- db push` — prod's schema_migrations stops at 0016 while the DB carries
-- objects through 0048 (applied out-of-band). See the migration-history-drift
-- note in the wiki.
--
-- §2/§3 bodies are branched from the LIVE pg_proc.prosrc read on 2026-09-02,
-- NOT from the files on disk. The files lie: 0008's body is stale V1, and
-- apply_hp_rollup has been re-created four times (0008 → 0022 → 0024 → 0048).
-- The live body is 0048's. Branching from any earlier file silently reinstates
-- `when 'partner' then 8760.0`, which no longer casts to content_type, and the
-- cron then fails into the cron log with no visible symptom.


-- ============================================================================
-- §1 — hp_events: queue → ledger
-- ============================================================================
-- Until now hp_events was a 5-minute buffer: apply_hp_rollup folded each row's
-- weight into items.hp and then HARD-DELETED it. The `kind` column — the only
-- place an item's click/open/save/comment breakdown ever existed — was
-- discarded at rollup time and persisted nowhere. ~2,110 events have already
-- been destroyed; they are unrecoverable. History accrues from the moment this
-- migration is applied and not one second earlier, and the admin UI says so
-- rather than rendering an empty chart as though it meant "no engagement".
--
-- This mirrors exactly what 0020 did on the USER side, which is why
-- user_hp_events has retained rows back to May while the item side has none.
--
-- base_weight exists because hp_events.weight is ALREADY the product of the
-- nominal weight and a per-caller novelty multiplier m ∈ [0.6, 1.5] (0025).
-- Without the base stored, a 0.5-weight click and a 0.75-weight click are
-- indistinguishable, so sum(weight)/0.5 mis-counts by up to ±50%. Storing the
-- base lets the admin panel show an honest event COUNT next to weighted HL
-- without ever exposing m itself, which stays under the hood by decision.
alter table hp_events add column if not exists processed_at timestamptz;
alter table hp_events add column if not exists base_weight double precision;

comment on column hp_events.processed_at is
  'Set by apply_hp_rollup() when the row has been folded into items.hp. NULL = pending. Rows are retained after processing (ledger, not queue) so the admin per-kind HL breakdown has history; swept at 180d by sweep_old_hp_events().';
comment on column hp_events.base_weight is
  'The nominal KIND_WEIGHTS value before record_hp_event() applied the novelty multiplier. `weight` is base_weight x m. NULL on rows written before 0049 and on BOTH system kinds (admin_adjust, decay), which have no event count. Count reader events with base_weight, sum HL with weight.';

-- The rollup's hot path: "everything still pending". Partial, so it stays the
-- size of one tick no matter how long the ledger grows.
create index if not exists hp_events_unprocessed_idx
  on hp_events (created_at) where processed_at is null;

-- The admin read path: "this item's events, newest first, by kind". Prod has
-- only hp_events_pkey(id) and hp_events_window_idx(created_at) — there is no
-- index on item_id at all. Today the rollup's own `join hp_events e on
-- e.item_id = i.id` is cheap ONLY because the table is near-empty between
-- ticks. The moment §3 makes it append-only, both that join and every
-- breakdown query would seq-scan a growing table. This index must land in the
-- SAME migration as the retention change, never after it.
create index if not exists hp_events_item_kind_idx
  on hp_events (item_id, kind, created_at desc);


-- ============================================================================
-- §2 — record_hp_event(): store the base weight too
-- ============================================================================
-- Byte-identical to the live body except the two INSERT statements, which now
-- carry base_weight. The novelty multiplier itself is still never returned to
-- the client and never stored — only the two endpoints of the multiplication,
-- which is enough for honest counts and nothing more.
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
    insert into hp_events (item_id, kind, weight, base_weight)
    values (p_item_id, p_kind, p_base_weight, p_base_weight);
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
  insert into hp_events (item_id, kind, weight, base_weight)
  values (p_item_id, p_kind, p_base_weight * m, p_base_weight);

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


-- ============================================================================
-- §3 — apply_hp_rollup(): mark, don't delete
-- ============================================================================
-- ⚠ THE HIGHEST-RISK CHANGE IN THIS MIGRATION. Two edits to the live body, and
-- they are a PAIR — shipping the second without the first corrupts the feed:
--
--   (a) the opening cursor gains `where processed_at is null`
--   (b) the closing `delete from hp_events`  →  `update … set processed_at = now()`
--
-- The live body opens with a COMPLETELY UNFILTERED `select array_agg(id) into
-- rolled_ids from hp_events;`. That was harmless while the last statement
-- deleted every row it read — the table was empty by definition at the start
-- of each tick. Once rows are retained, that same unfiltered select re-reads
-- the ENTIRE ledger every five minutes and re-folds all of it into items.hp.
-- HP compounds without bound, feed ordering corrupts within hours, and NOTHING
-- ERRORS: no exception, no log line, no failed cron run. Every other line
-- below is byte-identical to the live 0048 body.
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
  -- (a) PENDING ONLY. See the header — without this predicate the ledger
  -- re-applies itself on every tick.
  select array_agg(id) into rolled_ids from hp_events where processed_at is null;
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

    -- ── Record the decay this tick removed ──────────────────────────────────
    -- Decay is computed, never stored, so it cannot be reconstructed after the
    -- fact: the anchors it was computed against are overwritten by the UPDATE
    -- immediately above. Recording it forward is the only honest way to draw a
    -- net line — HL ganada is meaningless without the loss beside it.
    --
    -- Scope note the admin UI repeats: this covers only items that received an
    -- event this tick, because those are the only rows the rollup re-anchors.
    -- That is exactly the right complement to the gains — the two together sum
    -- to the real net change in items.hp — but it is NOT corpus-wide decay,
    -- and a panel that labelled it so would be lying.
    --
    -- weight is NEGATIVE. base_weight stays NULL: a decay row has no event
    -- count, and the breakdown must print «—» rather than invent one.
    -- processed_at is stamped at insert so the next tick cannot fold it into
    -- items.hp as though it were engagement.
    if current_hp - decayed > 0.0001 then
      insert into hp_events (item_id, kind, weight, processed_at)
      values (rec.id, 'decay', decayed - current_hp, now());
    end if;
  end loop;

  -- (b) Retain. This is the line that turns the queue into a ledger.
  update hp_events set processed_at = now() where id = ANY(rolled_ids);
end;
$$;

comment on function apply_hp_rollup() is
  'Folds pending hp_events into items.hp with decay-aware re-anchoring, then MARKS them processed (0049; previously deleted them). Reads only rows with processed_at IS NULL — removing that predicate would re-apply the whole ledger every tick. Decay lambda mirrors lib/curation.ts decayLambda: type half-life x harvest decay_multiplier x event-imminence. Runs every 5 min via pg_cron jobid 1.';


-- ============================================================================
-- §4 — bounded retention
-- ============================================================================
-- ~17 events/day at current traffic, so the ledger grows ~6k rows/year — free
-- at this scale. The sweep exists so it stays free after the beta: 180 days is
-- six times the longest window the admin UI offers (30 days) and leaves room
-- for a quarter-over-quarter read.
--
-- Only PROCESSED rows are eligible. A pending row is unapplied HL and deleting
-- it would silently drop engagement.
create or replace function sweep_old_hp_events() returns void
language plpgsql security definer set search_path = 'public'
as $$
begin
  delete from hp_events
  where processed_at is not null
    and processed_at < now() - interval '180 days';
end;
$$;

-- Postgres grants EXECUTE to PUBLIC by default, and a newly CREATED function
-- gets that default even when a sibling in the same migration is locked down.
-- Without this line sweep_old_hp_events() is callable by ANONYMOUS requests
-- through PostgREST — a SECURITY DEFINER function that deletes ledger rows.
-- (Caught in post-apply verification, 2026-09-02: it shipped with a NULL acl
-- while apply_hp_rollup, which was CREATE OR REPLACEd, correctly kept its
-- existing {postgres=X}. Replace preserves privileges; create does not.)
-- Only cron calls this, and cron runs as the owner, so nothing is granted back.
revoke execute on function sweep_old_hp_events() from public;

comment on function sweep_old_hp_events() is
  'Deletes hp_events rows processed more than 180 days ago, bounding the ledger introduced in 0049. Never touches pending rows (processed_at IS NULL) — those are unapplied HL. Runs daily via pg_cron.';

-- Idempotent (re)schedule — cron.schedule raises on a duplicate jobname.
select cron.unschedule('hp-events-sweep')
where exists (select 1 from cron.job where jobname = 'hp-events-sweep');
select cron.schedule('hp-events-sweep', '20 4 * * *', $$select sweep_old_hp_events()$$);


-- ============================================================================
-- §5 — admin_adjust_item_hp(): the beta-calibration HL lever
-- ============================================================================
-- WHAT THIS IS FOR. During beta the team needs to see how the mosaic reshapes
-- as HL moves — which tiers appear, how imminence competes with weight, how
-- the creator-side HP loop responds. Waiting for organic traffic to produce
-- those states at 61 users would take months. This lever produces them on
-- demand. It is an instrument, not a curation thumb: the honest levers for
-- "make this piece matter more" are `editorial`, `elevated` and `pinned`.
--
-- SO IT IS BUILT TO BE IMPOSSIBLE TO HIDE:
--   * every call writes an audit_log row (actor, item, before, after, reason)
--   * every call writes an hp_events row with kind 'admin_adjust', so the
--     per-kind breakdown shows injected HL as its own band and no chart in the
--     product can mistake an injection for organic reach
--   * the ledger row is stamped processed_at = now() AT INSERT, because the
--     adjustment is applied here and now. An unprocessed row would be folded
--     into items.hp again on the next tick and apply twice.
--   * reversal needs no extra machinery: audit_log carries before/after, so
--     the UI reverts by applying the inverse delta — which is itself audited.
--
-- WHAT IT DELIBERATELY CANNOT DO: touch users.engagement_hp. User HL is earned
-- and gates trophies; injecting it would manufacture unearned status. Item HL
-- decays and belongs to the feed. The lever stops at items.
--
-- SIDE EFFECT THE OPERATOR MUST KNOW: score() normalizes by the MAX currentHp
-- observed per type in the rendered set (lib/curation.ts). Raising one item's
-- HL raises its type's peak and therefore DEMOTES every other item of that
-- type on the same page. That is inherent to the curation model, not a bug
-- here — the admin UI states it at the point of commit.
create or replace function admin_adjust_item_hp(
  p_item_id text,
  p_delta double precision,
  p_reason text default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  -- Fat-finger guard, not a policy ceiling. The highest HP any item has ever
  -- reached in production is ~71; 1000 leaves the instrument its full range
  -- while stopping a stray keypress from becoming six digits.
  MAX_DELTA constant double precision := 1000.0;

  caller uuid;
  rec record;
  half_life double precision;
  base_lambda double precision;
  imminence double precision;
  hours_until_start double precision;
  hours_past_end double precision;
  dt_hours double precision;
  before_hp double precision;
  after_hp double precision;
begin
  caller := auth.uid();
  if caller is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not private.auth_is_admin() then
    raise exception 'admin role required' using errcode = '42501';
  end if;

  if p_delta is null or p_delta = 0 then
    raise exception 'delta must be a non-zero number' using errcode = '22023';
  end if;
  if abs(p_delta) > MAX_DELTA then
    raise exception 'delta magnitude exceeds % HL', MAX_DELTA using errcode = '22023';
  end if;

  -- Lock the row: two admins calibrating the same item would otherwise both
  -- read the same `before` and the second write would erase the first.
  select id, type::text as type, hp, hp_last_updated_at, published_at,
         editorial, hp_decay_multiplier, date, end_date
  into rec
  from public.items
  where id = p_item_id
  for update;
  if not found then
    raise exception 'item not found' using errcode = 'P0002';
  end if;

  -- ── Decay to NOW before adjusting ────────────────────────────────────────
  -- items.hp is a snapshot anchored at hp_last_updated_at, not a live value.
  -- Adding a delta to the raw column would add it to a stale number and the
  -- readout would disagree with what the feed and the item's own dashboard
  -- show. This block is the same math as apply_hp_rollup §3 and currentHp()
  -- in lib/curation.ts — all three must move together.
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

  imminence := 1.0;
  if rec.type = 'evento' and rec.date is not null then
    hours_until_start := extract(epoch from (rec.date - now())) / 3600.0;
    hours_past_end := extract(epoch from (now() - coalesce(rec.end_date, rec.date))) / 3600.0;
    if hours_until_start <= 1 and hours_past_end <= 1 then
      imminence := 0;
    elsif hours_until_start > 0 and hours_until_start < 168 then
      imminence := power((hours_until_start / 24.0) / 7.0, 2);
    elsif hours_past_end > 720 then
      imminence := 2.0;
    end if;
  end if;

  dt_hours := greatest(
    0,
    extract(epoch from (now() - coalesce(rec.hp_last_updated_at, rec.published_at))) / 3600.0
  );

  -- coalesce to spawn: 374 of 601 items have hp IS NULL (never touched). The
  -- rollup treats NULL as spawn HP, so the lever must too, or adjusting a
  -- never-touched item would land it far below an untouched peer.
  before_hp := coalesce(rec.hp, case when rec.editorial then 50.0 else 20.0 end)
             * exp(-base_lambda * coalesce(rec.hp_decay_multiplier, 1.0) * imminence * dt_hours);

  -- Floor at zero. Negative HP has no meaning in the model (exp decay never
  -- produces it) and would invert the per-type peak normalization.
  after_hp := greatest(0, before_hp + p_delta);

  update public.items
  set hp = after_hp,
      -- Re-anchoring is REQUIRED, not incidental: currentHp() decays the
      -- stored value from hp_last_updated_at, so an injection written against
      -- a three-week-old anchor would partly evaporate before anyone saw it.
      hp_last_updated_at = now()
  where id = p_item_id;

  -- Ledger row: pre-processed so the next rollup tick cannot apply it again.
  -- base_weight stays NULL — an adjustment is not a counted reader event, and
  -- leaving it null keeps it out of every "N interactions" figure by default.
  insert into public.hp_events (item_id, kind, weight, processed_at)
  values (p_item_id, 'admin_adjust', after_hp - before_hp, now());

  -- Audit row. audit_log has an admin-read policy and NO insert policy; this
  -- function reaches it as SECURITY DEFINER. It is the table's first writer in
  -- four months — the 0002_rls.sql comment claiming inserts arrive from
  -- triggers was never true.
  insert into public.audit_log (actor_id, action, target_type, target_id, payload)
  values (
    caller,
    'hp_adjust',
    'item',
    p_item_id,
    jsonb_build_object(
      'delta', p_delta,
      'applied', after_hp - before_hp,   -- differs from delta when the floor clamps
      'before', before_hp,
      'after', after_hp,
      'reason', p_reason
    )
  );

  return jsonb_build_object(
    'ok', true,
    'before', before_hp,
    'after', after_hp,
    'applied', after_hp - before_hp
  );
end;
$$;

-- Postgres grants EXECUTE to PUBLIC by default. 0033 revoked from anon and
-- authenticated while PUBLIC still held it and was therefore a complete no-op;
-- 0034 had to redo it as REVOKE FROM PUBLIC. Without these two lines this
-- function is callable by anonymous requests and its internal admin check
-- becomes the only thing standing between the internet and the HL economy.
revoke execute on function admin_adjust_item_hp(text, double precision, text) from public;
grant execute on function admin_adjust_item_hp(text, double precision, text) to authenticated, service_role;

comment on function admin_adjust_item_hp(text, double precision, text) is
  'Admin-only beta-calibration lever: decays items.hp to now, applies a signed delta (floored at 0), re-anchors hp_last_updated_at, and records BOTH an audit_log row and a pre-processed hp_events row of kind admin_adjust so injected HL is never mistaken for organic. Never touches users.engagement_hp — user HL is earned and gates trophies.';


-- ============================================================================
-- §6 — close the raw write path to items.hp
-- ============================================================================
-- Before this: `authenticated` held a blanket table-level UPDATE on items with
-- no column-level entries, and items_staff_update gates only at the ROW level
-- (private.auth_is_guide_or_admin()). So all 39 elevated accounts could run
--     supabase.from('items').update({ hp: 999 }).eq('id', …)
-- from a logged-in browser session — no route, no audit, no trace. An audited
-- lever standing next to an unaudited back door is decorative.
--
-- Column-level REVOKE cannot narrow a table-level grant — Postgres checks the
-- table grant first and a column revoke against it is a silent no-op. The only
-- correct shape is: revoke UPDATE wholesale, then re-grant it column by column
-- for everything except the protected five. The list is computed from
-- information_schema at apply time so it can never drift from the real table.
--
-- ⚠ MAINTENANCE TRAP THIS CREATES: a future `alter table items add column x`
-- lands OUTSIDE the grant, so `authenticated` silently cannot update x —
-- writes fail with a permissions error that reads like an RLS problem. The fix
-- is one line, and it is kept as a callable function so a future migration
-- does not have to reconstruct this reasoning:
--
--     select regrant_items_update();
create or replace function regrant_items_update() returns void
language plpgsql security definer set search_path = 'public'
as $$
declare
  cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by column_name)
  into cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'items'
    and column_name not in (
      'hp', 'hp_last_updated_at', 'hp_decay_multiplier',
      'harvested_at', 'harvested_amount'
    );

  execute 'revoke update on public.items from authenticated';
  execute format('grant update (%s) on public.items to authenticated', cols);
end;
$$;

-- Same default-PUBLIC trap as sweep_old_hp_events above, and worse here: this
-- is a SECURITY DEFINER function that MANIPULATES GRANTS. Left at the default
-- it is callable by anonymous requests. It is idempotent and re-applying the
-- same grants changes nothing, so the practical blast radius is small — but a
-- privilege-editing function reachable from the internet is categorically
-- wrong. Only a migration author ever calls this, by hand, as postgres.
revoke execute on function regrant_items_update() from public;

comment on function regrant_items_update() is
  'Re-derives the column-level UPDATE grant for `authenticated` on items, excluding the five HP columns (0049 §6). Call after ANY `alter table items add column` — a new column is otherwise not updatable by authenticated and fails with a permissions error that looks like RLS.';

select regrant_items_update();

-- VERIFIED SAFE against every authenticated-context write to items before
-- applying this (2026-09-02):
--   · PATCH /api/franjas/[id]        — session client. Writes title, bio,
--     image_url, marketplace_*, franja_last_updated. None protected.
--   · PATCH /api/admin/franjas/[id]  — session client. Same column set.
--   · POST  /api/items               — createAdminClient (service_role), and
--     already strips all five columns on edit anyway.
--   · POST  /api/admin/events        — createAdminClient (service_role).
-- service_role and the SECURITY DEFINER writers (apply_hp_rollup,
-- harvest_item, admin_adjust_item_hp) run as owner and are unaffected, so
-- COSECHAR and both cron rollups keep working unchanged.
--
-- ── NOT DONE HERE, on purpose ───────────────────────────────────────────────
-- `anon` ALSO holds a blanket arwdDxtm on items (verified in pg_class.relacl:
-- {postgres=arwdDxtm, anon=arwdDxtm, authenticated=arwdDxtm,
-- service_role=arwdDxtm}). No anonymous write can actually land — every RLS
-- policy on items requires a role predicate, so RLS blocks it — but the GRANT
-- is wider than anything anon could ever legitimately need, on every column
-- and not just the five here.
--
-- Closing it is a one-liner (`revoke insert, update, delete on public.items
-- from anon;`) and would break nothing, since nothing anonymous writes items
-- today. It is left out because it is a separate decision from the one that
-- was made, and a permissions change to production should be the change that
-- was actually approved. Raise it as its own call.


-- ============================================================================
-- §7 — reports: the moderation queue's substrate
-- ============================================================================
-- Nothing in the product could be reported before this. MODERACIÓN had no
-- countable substrate: prod holds 31 comments of which 4 are tombstoned, and
-- three of those four are author self-deletes, so exactly ONE moderator action
-- has ever occurred. Any "REPORTES · N" tile wired to the tombstone count
-- would have overstated real moderation four-fold.
--
-- reason/status are TEXT with CHECK constraints, deliberately not enums. 0048
-- exists because renaming one enum value broke five plpgsql function bodies
-- that stored the literal as text; a CHECK constraint is one ALTER to widen.
create table if not exists reports (
  id           bigserial primary key,
  reporter_id  uuid not null references users(id) on delete cascade,
  target_type  text not null check (target_type in ('item', 'comment', 'foro_thread', 'foro_reply', 'listing')),
  target_id    text not null,
  reason       text not null check (reason in ('spam', 'acoso', 'odio', 'sexual', 'violencia', 'enganoso', 'copyright', 'otro')),
  note         text check (note is null or char_length(note) <= 1000),
  status       text not null default 'abierto' check (status in ('abierto', 'resuelto', 'descartado')),
  resolved_by  uuid references users(id) on delete set null,
  resolved_at  timestamptz,
  resolution   text check (resolution is null or char_length(resolution) <= 1000),
  created_at   timestamptz not null default now()
);

-- One report per person per object: a report is a signal, not a vote, and
-- without this the queue is trivially floodable by a single account.
create unique index if not exists reports_reporter_target_idx
  on reports (reporter_id, target_type, target_id);
-- The queue's own read: open reports, oldest first.
create index if not exists reports_status_idx on reports (status, created_at);
-- "has this object been reported before?" — drives the count badge on an item.
create index if not exists reports_target_idx on reports (target_type, target_id);

alter table reports enable row level security;

-- A reporter may file, and may see what they filed — nothing else. Reading
-- other people's reports would turn the table into a public denunciation feed.
-- (select auth.uid()) is wrapped so the planner hoists it to an initplan
-- instead of re-evaluating per row; bare auth.uid() re-introduces exactly the
-- regression 0035 was written to fix.
-- `create policy` has no IF NOT EXISTS, and this file is applied BY HAND in
-- the SQL editor where a half-failed run gets re-pasted. Dropping first makes
-- the whole migration safely re-runnable; every other statement in it is
-- already idempotent (add column if not exists / create index if not exists /
-- create or replace function / create table if not exists).
drop policy if exists reports_insert_self on reports;
drop policy if exists reports_read_own on reports;
drop policy if exists reports_read_staff on reports;
drop policy if exists reports_update_staff on reports;

create policy reports_insert_self on reports
  for insert to authenticated
  with check (reporter_id = (select auth.uid()));

create policy reports_read_own on reports
  for select to authenticated
  using (reporter_id = (select auth.uid()));

-- Mods and admins see and resolve the whole queue. canModerate() in
-- lib/permissions.ts is the TS mirror of this predicate — they must agree.
create policy reports_read_staff on reports
  for select to authenticated
  using (private.auth_is_mod_or_admin());

create policy reports_update_staff on reports
  for update to authenticated
  using (private.auth_is_mod_or_admin())
  with check (private.auth_is_mod_or_admin());

-- No DELETE policy anywhere, deliberately: a resolved or dismissed report is
-- the record that someone looked. Deleting it erases the moderation history.
--
-- target_id carries no FK — it is polymorphic across five tables whose keys are
-- not even the same type (items.id is text, comments.id is uuid). A report
-- therefore OUTLIVES its target: delete the comment and the row remains,
-- pointing at nothing. That is the intended shape (the record that someone
-- looked survives the takedown), and the queue renders such rows as
-- «OBJETO ELIMINADO» rather than dropping them.

comment on table reports is
  'User-filed reports on items, comments, foro posts and marketplace listings. Insert-self-only; readable by its reporter and by mods/admins; resolvable only by mods/admins; never deletable. Feeds the /admin MODERACIÓN queue (0049).';
