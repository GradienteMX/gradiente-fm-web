-- 0034_security_hardening_fix.sql
-- ============================================================================
-- APPLY VIA THE SUPABASE SQL EDITOR (never `supabase db push`). Idempotent.
--
-- Corrects 0033 Part B. Those statements did `revoke execute ... from anon /
-- authenticated`, but Postgres grants function EXECUTE to PUBLIC by default
-- (proacl shows `=X/postgres` on every function), and anon/authenticated
-- inherit it via PUBLIC — so the revokes were NO-OPs (verified: anon still had
-- EXECUTE on harvest_item / ingest_scraped_event, authenticated still on
-- apply_hp_rollup). The effective fix is REVOKE ... FROM PUBLIC, with explicit
-- re-grants for the roles that legitimately call each function.
--
-- Why this is safe:
--   • pg_cron runs jobs as `postgres` (owner, proacl postgres=X) → rollups/sweep
--     keep working after revoking PUBLIC.
--   • Trigger functions (emit_user_hp_*, handle_new_auth_user) fire as the
--     definer; a trigger does NOT require the writing role to hold EXECUTE, so
--     comment/save/vibe/publish/signup keep working.
--   • SECURITY DEFINER internals run as the owner, so function→function calls
--     are unaffected.
--   • service_role is granted explicitly below for the app-invoked functions in
--     case any server path uses it.
--
-- TEST AFTER APPLYING (re-run the proacl / has_function_privilege checks):
--   anon  → EXECUTE only on peek_invite_card;  authenticated → no rollups/
--   triggers, keeps record_hp_event/harvest/ingest/partner_* ; cron + signup +
--   comment/save/vibe + dashboard publish all still work.
-- ============================================================================

-- ── App-invoked by AUTHENTICATED users (revoke PUBLIC default; keep authenticated
--    + service_role) ─────────────────────────────────────────────────────────
revoke execute on function public.record_hp_event(text, text, double precision) from public;
revoke execute on function public.harvest_item(text) from public;
revoke execute on function public.ingest_scraped_event(text, text, text, text, text, text, text, text, timestamptz, timestamptz, text, text, text[], text, text, text, text[]) from public;
revoke execute on function public.update_partner_event(text, text, text, text, timestamptz, timestamptz, text, text, text[], text, text, text, text[], integer, integer) from public;
revoke execute on function public.publish_partner_event(text) from public;
revoke execute on function public.discard_partner_event(text) from public;
revoke execute on function public.partner_team_add(text, uuid) from public;
revoke execute on function public.partner_team_set_admin(text, uuid, boolean) from public;
revoke execute on function public.partner_team_remove(text, uuid) from public;

grant execute on function public.record_hp_event(text, text, double precision) to authenticated, service_role;
grant execute on function public.harvest_item(text) to authenticated, service_role;
grant execute on function public.ingest_scraped_event(text, text, text, text, text, text, text, text, timestamptz, timestamptz, text, text, text[], text, text, text, text[]) to authenticated, service_role;
grant execute on function public.update_partner_event(text, text, text, text, timestamptz, timestamptz, text, text, text[], text, text, text, text[], integer, integer) to authenticated, service_role;
grant execute on function public.publish_partner_event(text) to authenticated, service_role;
grant execute on function public.discard_partner_event(text) to authenticated, service_role;
grant execute on function public.partner_team_add(text, uuid) to authenticated, service_role;
grant execute on function public.partner_team_set_admin(text, uuid, boolean) to authenticated, service_role;
grant execute on function public.partner_team_remove(text, uuid) to authenticated, service_role;

-- ── Invite-peek: anon + authenticated keep it ───────────────────────────────
revoke execute on function public.peek_invite_card(text) from public;
grant execute on function public.peek_invite_card(text) to anon, authenticated, service_role;

-- ── Cron/trigger-only: revoke PUBLIC entirely (no client role calls these) ───
revoke execute on function public.apply_hp_rollup() from public;
revoke execute on function public.apply_user_hp_rollup() from public;
revoke execute on function public.apply_trophy_unlocks() from public;
revoke execute on function public.apply_vibe_check_bonuses() from public;
revoke execute on function public.sweep_old_foro_threads() from public;
revoke execute on function public.rls_auto_enable() from public;
revoke execute on function public.handle_new_auth_user() from public;
revoke execute on function public.emit_user_hp_on_comment_post() from public;
revoke execute on function public.emit_user_hp_on_comment_save() from public;
revoke execute on function public.emit_user_hp_on_item_save() from public;
revoke execute on function public.emit_user_hp_on_publish() from public;
revoke execute on function public.emit_user_hp_on_reaction() from public;
revoke execute on function public.emit_user_hp_on_vibe_check() from public;
