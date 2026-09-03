-- 0050_reception.sql
-- Backend for RECEPCIÓN — the creator's own reception stats in /dashboard.
--
-- Two sections, and the FIRST one is a privacy fix that stands on its own:
--
--   §1  close the attribution_key leak on user_hp_events
--   §2  creator_reception() — per-item reception, aggregated so it cannot leak
--
-- HOW TO APPLY: paste into the Supabase SQL editor. NEVER `supabase db push`
-- (prod's schema_migrations stops at 0016 while the DB carries objects through
-- 0049). Safely re-runnable.


-- ============================================================================
-- §1 — user_hp_events.attribution_key stops being readable by its subject
-- ============================================================================
-- THE LEAK, found while building RECEPCIÓN and worth applying even if that
-- feature is never shipped:
--
--   · user_hp_events_self_read admits a user to their OWN rows
--     (user_id = auth.uid()).
--   · a row's user_id is the RECIPIENT — the creator who earned the HP.
--   · attribution_key on those rows is `item_saved:<item_id>:<SAVER_ID>` and
--     `reaction_received:<comment_id>:<REACTOR_ID>` (verified in prod).
--   · `authenticated` holds a blanket table-level SELECT with no column
--     restriction (relacl: authenticated=arwdDxtm).
--
-- So any logged-in creator could read `/rest/v1/user_hp_events?select=
-- attribution_key` and recover the user id of every person who saved their
-- content or reacted to their comments. Saves are anonymous by design — the
-- product shows a save count to nobody and a saver to nobody. This handed the
-- creator the full list.
--
-- (comment_received also carries the commenter's id, but a comment is public
-- and signed, so that half was never a secret. item_saved and
-- reaction_received are the real exposure.)
--
-- Column-level REVOKE cannot narrow a table-level grant — Postgres checks the
-- table grant first. The only correct shape is revoke-then-regrant by column,
-- the same ritual 0049 §6 used on items.hp.
--
-- Nothing in the application reads this column: grep over app/ lib/
-- components/ returns zero hits outside the generated types, and the only
-- reader of the table at all is lib/data/adminStats.ts, which selects
-- kind/weight/created_at. The dedup that DOES depend on attribution_key
-- (`on conflict (attribution_key) do nothing`, all eight writers) runs inside
-- SECURITY DEFINER functions as the table owner and is unaffected by a grant
-- to `authenticated`.
--
-- Admins lose the column too, deliberately: an admin is `authenticated` at the
-- Postgres level, and no admin surface needs saver identities either. A future
-- one can reach it through service_role.
--
-- NOT DONE: `anon` also holds the blanket grant, but every policy on this
-- table requires a matching auth.uid() or admin, so anonymous requests read
-- nothing. That is defence-in-depth on an unexposed path, not this fix.
do $$
declare
  cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by column_name)
  into cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'user_hp_events'
    and column_name <> 'attribution_key';

  execute 'revoke select on public.user_hp_events from authenticated';
  execute format('grant select (%s) on public.user_hp_events to authenticated', cols);
end $$;

comment on column user_hp_events.attribution_key is
  'Idempotency key for the eight HP writers. Encodes the ACTOR id (saver, reactor, commenter) and is therefore NOT readable by `authenticated` — 0050 §1 revoked it, because user_hp_events_self_read would otherwise show a creator who saved their work. Reachable only by the SECURITY DEFINER writers and service_role.';


-- ============================================================================
-- §2 — creator_reception(): the aggregate a creator may see
-- ============================================================================
-- Returns, for the caller's own items, how each piece was received: per
-- interaction kind, an event COUNT and a SHARE of that item's earned HL.
--
-- WHAT IT DELIBERATELY DOES NOT RETURN, and why each omission is load-bearing:
--
--   · No raw hp_events rows. hp_events has no user_id, so it cannot identify
--     anyone directly — but shipping raw rows would hand a creator per-event
--     timestamps, and at 61 users "someone saved this at 14:32" is close to
--     naming a person. Aggregation here is the privacy boundary; the UI is not
--     trusted to maintain it.
--
--   · No per-kind WEIGHT. This is the novelty-weighting guard. hp_events.weight
--     is the nominal weight times a per-caller multiplier ∈ [0.6, 1.5], so
--     returning both `events` and per-kind weight would let anyone divide one
--     by the other and recover a number the product deliberately keeps under
--     the hood (see the Novelty Weighting decision). Returning a SHARE instead
--     of a weight closes that: the item's total earned HL is never returned,
--     so share × (unknown total) does not solve for a weight.
--
--     RESIDUAL, stated so nobody trusts this further than it goes: shares plus
--     counts do leak the RELATIVE ladder to anyone who cares to regress it. An
--     item with one click and one open reports 25% / 75%, and 75/25 is 1.5/0.5.
--     What that recovers is the ratio between nominal weights — not the
--     multiplier, which varies per reader and averages away, and not any
--     absolute value. The guard here is against a price list printed on the
--     screen, not against a determined analyst with a spreadsheet. If the
--     ladder itself must stay secret, this feature cannot ship in any form.
--
--   · No weight ladder. The UI shows proportions and counts, never "× 4.0".
--     A creator who learns a save pays eight times a click has been handed a
--     price list, and the honest thing to optimise is the work.
--
-- Franjas are excluded: a franja row is rail furniture with a 365-day
-- half-life, not a piece someone wrote.
create or replace function creator_reception(p_days int default 30)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid;
  since timestamptz;
  win_days int;
  payload jsonb;
begin
  caller := auth.uid();
  if caller is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Clamp rather than reject: 180 days is sweep_old_hp_events()'s retention
  -- ceiling, so a longer window can only return sparser data while implying
  -- something was lost.
  win_days := greatest(1, least(180, coalesce(p_days, 30)));
  -- Floored to a UTC day, NOT a rolling timestamp. The route's other half
  -- (presencia, over user_hp_events) buckets by UTC day via bucketByDay, so a
  -- rolling `now() - interval` here would put the two halves on windows up to
  -- 24h apart for the same ?dias= — and the first thing anyone does with two
  -- panels on one screen is check that they agree.
  -- The double `at time zone 'UTC'` is deliberate, not redundant: the first
  -- converts timestamptz → naive UTC so date_trunc cuts on a UTC boundary, the
  -- second converts the naive result back to timestamptz. Without the second,
  -- assigning to a timestamptz variable would reinterpret the naive value in
  -- the server's TimeZone setting — correct today only because Supabase runs
  -- UTC, and silently off by hours the day that changes.
  since := (date_trunc('day', now() at time zone 'UTC') - make_interval(days => win_days - 1))
             at time zone 'UTC';

  with mine as (
    select i.id, i.title, i.slug, i.type::text as item_type, i.published_at,
           i.hp, i.hp_last_updated_at, i.editorial, i.hp_decay_multiplier,
           i.date as item_date, i.end_date as item_end_date, i.published
    from public.items i
    where i.created_by = caller
      and i.type::text <> 'franja'
  ),
  agg as (
    select e.item_id, e.kind,
           -- Counts come from base_weight, never from weight/nominal: rows
           -- written before 0049 have no base_weight and are honestly
           -- uncountable rather than guessed at.
           (count(*) filter (where e.base_weight is not null))::int as events,
           sum(e.weight) as w
    from public.hp_events e
    join mine m on m.id = e.item_id
    where e.created_at >= since
      and e.kind in ('click', 'open', 'save', 'comment')
    group by e.item_id, e.kind
  ),
  shared as (
    select item_id, kind, events,
           round(
             (100 * w / nullif(sum(w) over (partition by item_id), 0))::numeric,
             1
           )::double precision as share
    from agg
  ),
  per_item as (
    select m.*,
           coalesce((
             select jsonb_agg(
                      jsonb_build_object('kind', s.kind, 'events', s.events, 'share', s.share)
                      order by s.kind
                    )
             from shared s
             where s.item_id = m.id
           ), '[]'::jsonb) as kinds
    from mine m
  ),
  totals as (
    select a.kind,
           sum(a.events)::int as events,
           round((100 * sum(a.w) / nullif(sum(sum(a.w)) over (), 0))::numeric, 1)::double precision as share
    from agg a
    group by a.kind
  )
  select jsonb_build_object(
    'days', win_days,
    'since', since,
    'items', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.published_at desc) from per_item p
    ), '[]'::jsonb),
    'totals', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.kind) from totals t
    ), '[]'::jsonb)
  )
  into payload;

  return payload;
end;
$$;

-- Postgres grants EXECUTE to PUBLIC by default on a NEWLY CREATED function.
-- 0049 shipped two functions without this and they were callable anonymously;
-- 0033 was a whole no-op for the same reason. This one is auth-gated inside,
-- but an anonymous caller should not even reach the gate.
revoke execute on function creator_reception(int) from public;
grant execute on function creator_reception(int) to authenticated, service_role;

comment on function creator_reception(int) is
  'Per-item reception for the CALLER''s own pieces: interaction-kind event counts and each kind''s SHARE of that item''s earned HL. Never returns raw events (per-event timestamps deanonymise at beta scale) and never returns per-kind weight (dividing it by the count would recover the hidden novelty multiplier). Backs the RECEPCIÓN space in /dashboard.';
