-- 0012_vibe_checks_security.sql
-- Follow-up to 0011: lints flagged two security issues with the new objects.
--   1. `vibe_check_aggregates` was created without `security_invoker = true`,
--      so it ran as the owner. The matching pattern from 0005's
--      `user_rank_signals` view uses invoker so RLS on the underlying
--      `vibe_checks` table (read-all in our case) gates results correctly.
--   2. `touch_vibe_checks_updated_at()` had a mutable search_path. Pin it to
--      `public` to match `set_updated_at` in 0001.
--
-- Both fixes are in-place CREATE OR REPLACE — no data movement.

create or replace view vibe_check_aggregates
  with (security_invoker = true) as
select
  item_id,
  count(*)::int as check_count,
  cast(percentile_cont(0.5) within group (order by vibe_min) as smallint) as median_min,
  cast(percentile_cont(0.5) within group (order by vibe_max) as smallint) as median_max
from vibe_checks
group by item_id;

create or replace function touch_vibe_checks_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
