-- 0035_rls_initplan.sql
-- ============================================================================
-- APPLY VIA THE SUPABASE SQL EDITOR (never `supabase db push`). Idempotent
-- (ALTER POLICY is a no-op if re-run with the same text).
--
-- Fixes the `auth_rls_initplan` performance advisor (~27 warnings): wraps every
-- DIRECT auth.uid() call in RLS predicates as (select auth.uid()). auth.uid()
-- is STABLE within a statement, so this is semantics-IDENTICAL — but Postgres
-- then evaluates it ONCE per query (an InitPlan) instead of once per row, which
-- matters on the high-row read paths (items / comments / foro / vibe_checks) as
-- the tables grow. No access logic changes; each predicate below is the current
-- one verbatim with only auth.uid() -> (select auth.uid()).
--
-- VERIFY AFTER: get_advisors(performance) → auth_rls_initplan should drop to 0,
-- and a pg_policies diff should show every predicate unchanged except the wrap.
-- (Does NOT touch the 92 multiple_permissive_policies — that merge needs a
-- per-table access truth-table diff and is deliberately a separate change.)
-- ============================================================================

-- ── comment_reactions ───────────────────────────────────────────────────────
alter policy "comment_reactions_self_delete" on public.comment_reactions
  using (user_id = (select auth.uid()));
alter policy "comment_reactions_self_insert" on public.comment_reactions
  with check (((select auth.uid()) is not null) and (user_id = (select auth.uid())));

-- ── comments ────────────────────────────────────────────────────────────────
alter policy "comments_authed_read" on public.comments
  using ((select auth.uid()) is not null);
alter policy "comments_authenticated_insert" on public.comments
  with check (((select auth.uid()) is not null) and (author_id = (select auth.uid())));
alter policy "comments_author_edit_window" on public.comments
  using ((author_id = (select auth.uid())) and (created_at > (now() - '00:15:00'::interval)) and (deletion_at is null))
  with check ((author_id = (select auth.uid())) and (created_at > (now() - '00:15:00'::interval)));

-- ── drafts ──────────────────────────────────────────────────────────────────
alter policy "drafts_self_only" on public.drafts
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

-- ── entities ────────────────────────────────────────────────────────────────
alter policy "entities_authed_read" on public.entities
  using ((select auth.uid()) is not null);

-- ── foro_replies ────────────────────────────────────────────────────────────
alter policy "foro_replies_authed_read" on public.foro_replies
  using ((select auth.uid()) is not null);
alter policy "foro_replies_authenticated_insert" on public.foro_replies
  with check (((select auth.uid()) is not null) and (author_id = (select auth.uid())));
alter policy "foro_replies_author_edit_window" on public.foro_replies
  using ((author_id = (select auth.uid())) and (created_at > (now() - '00:15:00'::interval)) and (deletion_at is null))
  with check ((author_id = (select auth.uid())) and (created_at > (now() - '00:15:00'::interval)));

-- ── foro_threads ────────────────────────────────────────────────────────────
alter policy "foro_threads_authed_read" on public.foro_threads
  using ((select auth.uid()) is not null);
alter policy "foro_threads_authenticated_insert" on public.foro_threads
  with check (((select auth.uid()) is not null) and (author_id = (select auth.uid())));
alter policy "foro_threads_author_edit_window" on public.foro_threads
  using ((author_id = (select auth.uid())) and (created_at > (now() - '00:15:00'::interval)) and (deletion_at is null))
  with check ((author_id = (select auth.uid())) and (created_at > (now() - '00:15:00'::interval)));

-- ── hp_events ───────────────────────────────────────────────────────────────
alter policy "hp_events_authenticated_insert" on public.hp_events
  with check ((select auth.uid()) is not null);

-- ── item_entities ───────────────────────────────────────────────────────────
alter policy "item_entities_authed_read" on public.item_entities
  using ((select auth.uid()) is not null);

-- ── items ───────────────────────────────────────────────────────────────────
alter policy "items_authed_read" on public.items
  using (((select auth.uid()) is not null) and (published = true));
alter policy "items_owner_delete" on public.items
  using (created_by = (select auth.uid()));
alter policy "items_partner_team_insert" on public.items
  with check ((created_by = (select auth.uid()))
    and (source = 'manual:partner'::content_source)
    and (type = any (array['evento'::content_type, 'mix'::content_type, 'noticia'::content_type, 'opinion'::content_type, 'listicle'::content_type]))
    and (exists ( select 1 from users where ((users.id = (select auth.uid())) and (users.partner_id = items.partner_id)))));
alter policy "items_partner_team_read" on public.items
  using ((partner_id is not null)
    and (exists ( select 1 from users where ((users.id = (select auth.uid())) and (users.partner_id = items.partner_id)))));
alter policy "items_partner_team_update" on public.items
  using ((source = 'manual:partner'::content_source)
    and (exists ( select 1 from users where ((users.id = (select auth.uid())) and (users.partner_id = items.partner_id)))))
  with check ((source = 'manual:partner'::content_source)
    and (type = any (array['evento'::content_type, 'mix'::content_type, 'noticia'::content_type, 'opinion'::content_type, 'listicle'::content_type]))
    and (exists ( select 1 from users where ((users.id = (select auth.uid())) and (users.partner_id = items.partner_id)))));

-- ── marketplace_listings ────────────────────────────────────────────────────
alter policy "marketplace_listings_team_write" on public.marketplace_listings
  using (exists ( select 1 from users u where ((u.id = (select auth.uid())) and ((u.role = 'admin'::user_role) or (u.partner_id = marketplace_listings.partner_id)))))
  with check (exists ( select 1 from users u where ((u.id = (select auth.uid())) and ((u.role = 'admin'::user_role) or (u.partner_id = marketplace_listings.partner_id)))));

-- ── poll_votes ──────────────────────────────────────────────────────────────
alter policy "poll_votes_self_write" on public.poll_votes
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ── saved_comments ──────────────────────────────────────────────────────────
alter policy "saved_comments_self_only" on public.saved_comments
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ── user_hp_events ──────────────────────────────────────────────────────────
alter policy "user_hp_events_self_read" on public.user_hp_events
  using (user_id = (select auth.uid()));

-- ── user_saves ──────────────────────────────────────────────────────────────
alter policy "user_saves_self_only" on public.user_saves
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ── users (SECURITY-CRITICAL: preserves the exact role/is_mod/is_og/partner
--    pinning in with_check — only auth.uid() is wrapped) ────────────────────
alter policy "users_self_update" on public.users
  using (id = (select auth.uid()))
  with check ((id = (select auth.uid()))
    and (role = ( select users_1.role from users users_1 where (users_1.id = (select auth.uid()))))
    and (is_mod = ( select users_1.is_mod from users users_1 where (users_1.id = (select auth.uid()))))
    and (is_og = ( select users_1.is_og from users users_1 where (users_1.id = (select auth.uid()))))
    and (not (partner_id is distinct from ( select users_1.partner_id from users users_1 where (users_1.id = (select auth.uid())))))
    and (partner_admin = ( select users_1.partner_admin from users users_1 where (users_1.id = (select auth.uid())))));

-- ── vibe_checks ─────────────────────────────────────────────────────────────
alter policy "vibe_checks_self_write" on public.vibe_checks
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
