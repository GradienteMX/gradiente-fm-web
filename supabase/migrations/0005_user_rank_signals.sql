-- ============================================================================
-- 0005_user_rank_signals.sql — per-user reaction-count aggregate view
-- ============================================================================
-- Surfaces signal_count + prov_count per author across all live (non-seed,
-- non-deleted) comments. Powers the live `useUserRank` hook which buckets
-- counts into 'normie' | 'detonador' | 'enigma' | 'espectro' via
-- lib/permissions.ts rankFromCounts.
--
-- Replaces the prototype's mock+session computation that ran in-memory and
-- always returned 'normie' once the surface moved to real DB data.
--
-- security_invoker = true (PG 15+) so the existing RLS on comments
-- (seed=false public read) and comment_reactions (public read true)
-- naturally gates view results — anon sees ranks based only on visible
-- non-seed activity, staff see ranks reflecting all activity.
-- ============================================================================

create view user_rank_signals
  with (security_invoker = true) as
select c.author_id                                          as user_id,
       count(*) filter (where r.kind = 'signal')            as signal_count,
       count(*) filter (where r.kind = 'provocative')       as prov_count
  from comment_reactions r
  join comments c on c.id = r.comment_id
 where c.deletion_at is null
   and c.seed = false
 group by c.author_id;

grant select on user_rank_signals to anon, authenticated;
