-- ============================================================================
-- 0002_rls.sql — Row Level Security policies (squash)
-- ============================================================================
-- Mirrors lib/permissions.ts at the DB layer. Helpers live in `private`
-- (see 0001_init.sql), referenced by qualified name. Multiple permissive
-- policies on the same table OR together — admin policies stack on top of
-- public ones rather than replacing them.
--
-- Policy naming: <table>_<who>_<action>.
-- ============================================================================


-- ============================================================================
-- ITEMS
-- ============================================================================
create policy items_public_read on items
  for select
  using (published = true and seed = false);

create policy items_staff_read on items
  for select
  using (private.auth_is_guide_or_admin());

create policy items_staff_write on items
  for all
  using (private.auth_is_guide_or_admin())
  with check (private.auth_is_guide_or_admin());


-- ============================================================================
-- USERS
-- ============================================================================
create policy users_public_read on users
  for select
  using (true);

create policy users_self_update on users
  for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select role from users where id = auth.uid())
    and is_mod = (select is_mod from users where id = auth.uid())
    and is_og = (select is_og from users where id = auth.uid())
    and partner_id is not distinct from (select partner_id from users where id = auth.uid())
    and partner_admin = (select partner_admin from users where id = auth.uid())
  );

create policy users_admin_all on users
  for all
  using (private.auth_is_admin())
  with check (private.auth_is_admin());

-- INSERT into users is exclusive to the on_auth_user_created trigger
-- (SECURITY DEFINER). No client-side INSERT policy by design.


-- ============================================================================
-- INVITE_CODES — admins only. Signup trigger reads/marks via SECURITY DEFINER.
-- ============================================================================
create policy invite_codes_admin_all on invite_codes
  for all
  using (private.auth_is_admin())
  with check (private.auth_is_admin());


-- ============================================================================
-- DRAFTS — strict self-only. Even admins cannot read other users' drafts.
-- ============================================================================
create policy drafts_self_only on drafts
  for all
  using (author_id = auth.uid())
  with check (author_id = auth.uid());


-- ============================================================================
-- COMMENTS
-- ============================================================================
create policy comments_public_read on comments
  for select
  using (seed = false);

create policy comments_staff_read on comments
  for select
  using (private.auth_is_guide_or_admin());

create policy comments_authenticated_insert on comments
  for insert
  with check (auth.uid() is not null and author_id = auth.uid());

create policy comments_author_edit_window on comments
  for update
  using (
    author_id = auth.uid()
    and created_at > now() - interval '15 minutes'
    and deletion_at is null
  )
  with check (
    author_id = auth.uid()
    and created_at > now() - interval '15 minutes'
  );

create policy comments_mod_edit on comments
  for update
  using (private.auth_is_mod_or_admin())
  with check (private.auth_is_mod_or_admin());

-- No DELETE policy — moderation uses tombstones, not deletion. Hard delete
-- of tombstoned rows is done by a pg_cron sweep (chunk 4).


-- ============================================================================
-- COMMENT_REACTIONS
-- ============================================================================
create policy comment_reactions_public_read on comment_reactions
  for select
  using (true);

create policy comment_reactions_self_insert on comment_reactions
  for insert
  with check (auth.uid() is not null and user_id = auth.uid());

create policy comment_reactions_self_delete on comment_reactions
  for delete
  using (user_id = auth.uid());


-- ============================================================================
-- SAVED_COMMENTS — strict self-only.
-- ============================================================================
create policy saved_comments_self_only on saved_comments
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ============================================================================
-- USER_SAVES — strict self-only.
-- ============================================================================
create policy user_saves_self_only on user_saves
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ============================================================================
-- POLLS
-- ============================================================================
create policy polls_public_read on polls
  for select
  using (true);

create policy polls_authoring_write on polls
  for all
  using (private.auth_is_authoring_role())
  with check (private.auth_is_authoring_role());


-- ============================================================================
-- POLL_VOTES — counts are computed client-side; UI (lib/polls.ts) gates
-- "anonymous-until-vote" — server exposes openly because hiding is UX, not
-- security.
-- ============================================================================
create policy poll_votes_public_read on poll_votes
  for select
  using (true);

create policy poll_votes_self_write on poll_votes
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ============================================================================
-- FORO_THREADS
-- ============================================================================
create policy foro_threads_public_read on foro_threads
  for select
  using (seed = false);

create policy foro_threads_staff_read on foro_threads
  for select
  using (private.auth_is_guide_or_admin());

create policy foro_threads_authenticated_insert on foro_threads
  for insert
  with check (auth.uid() is not null and author_id = auth.uid());

create policy foro_threads_author_edit_window on foro_threads
  for update
  using (
    author_id = auth.uid()
    and created_at > now() - interval '15 minutes'
    and deletion_at is null
  )
  with check (
    author_id = auth.uid()
    and created_at > now() - interval '15 minutes'
  );

create policy foro_threads_mod_edit on foro_threads
  for update
  using (private.auth_is_mod_or_admin())
  with check (private.auth_is_mod_or_admin());


-- ============================================================================
-- FORO_REPLIES
-- ============================================================================
create policy foro_replies_public_read on foro_replies
  for select
  using (true);

create policy foro_replies_authenticated_insert on foro_replies
  for insert
  with check (auth.uid() is not null and author_id = auth.uid());

create policy foro_replies_author_edit_window on foro_replies
  for update
  using (
    author_id = auth.uid()
    and created_at > now() - interval '15 minutes'
    and deletion_at is null
  )
  with check (
    author_id = auth.uid()
    and created_at > now() - interval '15 minutes'
  );

create policy foro_replies_mod_edit on foro_replies
  for update
  using (private.auth_is_mod_or_admin())
  with check (private.auth_is_mod_or_admin());


-- ============================================================================
-- HP_EVENTS — insert-only signal stream. Anon-views excluded by design.
-- ============================================================================
create policy hp_events_authenticated_insert on hp_events
  for insert
  with check (auth.uid() is not null);

create policy hp_events_admin_read on hp_events
  for select
  using (private.auth_is_admin());


-- ============================================================================
-- AUDIT_LOG — admin read only. Inserts come from DB triggers (SECURITY
-- DEFINER), not the API. Append-only.
-- ============================================================================
create policy audit_log_admin_read on audit_log
  for select
  using (private.auth_is_admin());
