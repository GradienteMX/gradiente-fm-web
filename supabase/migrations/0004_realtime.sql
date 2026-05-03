-- ============================================================================
-- 0004_realtime.sql — Realtime publications (squash of 0015)
-- ============================================================================
-- Tables in `supabase_realtime` participate in the Postgres publication;
-- row-level events are fanned to subscribed clients via the Realtime
-- websocket. RLS still gates which events each client receives.
--
-- Coverage:
--   - comments            → CommentsColumn live updates
--   - comment_reactions   → CommentList live reaction counts
--   - foro_threads        → ForoCatalog live ordering (bump trigger UPDATEs)
--   - foro_replies        → ThreadOverlay live replies + tile reply counts
-- ============================================================================

alter publication supabase_realtime add table public.comments;
alter publication supabase_realtime add table public.comment_reactions;
alter publication supabase_realtime add table public.foro_threads;
alter publication supabase_realtime add table public.foro_replies;
