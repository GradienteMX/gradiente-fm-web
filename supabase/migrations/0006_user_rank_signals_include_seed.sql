-- ============================================================================
-- 0006_user_rank_signals_include_seed.sql — drop the seed filter
-- ============================================================================
-- The 0005 view filtered `c.seed = false` so only real-user activity counted
-- toward ranks. Pre-beta this means seeded users (who have 51 reactions on
-- 25 seeded comments) all show 'normie' — no visible rank system.
--
-- Drop the seed filter so pre-beta testing surfaces meaningful ranks. After
-- the pre-launch `delete from comments where seed = true` cleanup, the
-- filter becomes a no-op anyway, so this is identical to the seed=false
-- version in production.
-- ============================================================================

drop view if exists user_rank_signals;

create view user_rank_signals
  with (security_invoker = true) as
select c.author_id                                          as user_id,
       count(*) filter (where r.kind = 'signal')            as signal_count,
       count(*) filter (where r.kind = 'provocative')       as prov_count
  from comment_reactions r
  join comments c on c.id = r.comment_id
 where c.deletion_at is null
 group by c.author_id;

grant select on user_rank_signals to anon, authenticated;
