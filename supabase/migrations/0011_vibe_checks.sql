-- 0011_vibe_checks.sql
-- Per-user [vibe_min, vibe_max] grade for an item. Aggregated via the
-- `vibe_check_aggregates` view (median min + median max + count). The fader
-- in components/VibeFader.tsx lets each authed user cast / revise / clear
-- their check; the displayed band falls through to the median once the
-- check_count crosses the threshold (5, enforced client-side).

create table vibe_checks (
  item_id    text not null references items(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  vibe_min   smallint not null check (vibe_min between 0 and 10),
  vibe_max   smallint not null check (vibe_max between 0 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (item_id, user_id),
  check (vibe_min <= vibe_max)
);

create index vibe_checks_item_id_idx on vibe_checks(item_id);

-- Auto-bump updated_at on revote
create or replace function touch_vibe_checks_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger vibe_checks_touch_updated
  before update on vibe_checks
  for each row execute function touch_vibe_checks_updated_at();

-- Median min / median max / count per item. Used by:
--   - VibeFader display when crowd >= 5 checks
--   - filterByVibe() effective-band fall-through (decided 2026-05-05)
create or replace view vibe_check_aggregates as
select
  item_id,
  count(*)::int as check_count,
  cast(percentile_cont(0.5) within group (order by vibe_min) as smallint) as median_min,
  cast(percentile_cont(0.5) within group (order by vibe_max) as smallint) as median_max
from vibe_checks
group by item_id;

-- RLS: read-all (anonymous viewers see crowd opinion), self-write only
alter table vibe_checks enable row level security;

create policy vibe_checks_read_all on vibe_checks
  for select using (true);

create policy vibe_checks_self_write on vibe_checks
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Realtime: optimistic UI confirms / rolls back via per-item channel
alter publication supabase_realtime add table vibe_checks;
