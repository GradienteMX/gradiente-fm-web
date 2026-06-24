-- 0033_security_hardening.sql
-- ============================================================================
-- APPLY VIA THE SUPABASE SQL EDITOR (project gradiente-fm). NEVER `supabase db
-- push` — prod schema_migrations only records 0001–0016 and 0017+ were applied
-- out-of-band; a push would replay/conflict (see migration-history-drift).
-- This script is idempotent and safe to re-run. Three independent parts; you
-- can paste/run them separately.
--
-- Addresses these advisor findings:
--   • function_search_path_mutable  → Part A
--   • anon/authenticated_security_definer_function_executable (~20 funcs) → Part B
-- Plus the RLS-first fix for the partner-team route (Part C), which currently
-- only works for site admins and is a no-op for partner-admins.
-- ============================================================================


-- ── Part A · mutable search_path on the lone offender ───────────────────────
-- touch_entities_updated_at is invoker-rights (NOT security definer) — keep it
-- that way; just pin the search_path.
alter function public.touch_entities_updated_at() set search_path = '';


-- ── Part B · lock down SECURITY DEFINER function EXECUTE grants ──────────────
-- ⚠ SUPERSEDED BY 0034_security_hardening_fix.sql: the revokes below target
-- anon/authenticated, but EXECUTE is held via PUBLIC (Postgres default), so
-- they were no-ops. The effective fix (REVOKE ... FROM PUBLIC + explicit
-- re-grants) is in 0034. Kept here as historical record.
-- Call-site analysis (grep of `.rpc(` across the app):
--   anon legitimately calls ONLY peek_invite_card (invite-peek before signup).
--   authenticated calls: record_hp_event, harvest_item, ingest_scraped_event,
--     update/publish/discard_partner_event (authed routes + dashboard client).
--   NOTHING in app code calls the rollups / sweep / emit_* triggers /
--     rls_auto_enable / handle_new_auth_user — those run as cron jobs or table
--     triggers (as the owner role), so revoking EXECUTE does NOT disable them.
--
-- Strategy: blanket-revoke EXECUTE from anon (closing the whole anon RPC
-- surface — ingest injection, partner-event mutation, HP manipulation), then
-- re-grant the single function anon needs. Separately revoke the cron/trigger-
-- only functions from authenticated too.
--
-- TEST AFTER APPLYING: (1) anon invite-peek on /welcome still resolves a code;
-- (2) signup with a fresh code still works; (3) an authed user can still
-- comment / save / vibe-check (HP writes) and publish; (4) dashboard
-- publish/discard of a partner draft still works.

revoke execute on all functions in schema public from anon;
grant execute on function public.peek_invite_card(text) to anon;

revoke execute on function public.apply_hp_rollup() from authenticated;
revoke execute on function public.apply_user_hp_rollup() from authenticated;
revoke execute on function public.apply_trophy_unlocks() from authenticated;
revoke execute on function public.apply_vibe_check_bonuses() from authenticated;
revoke execute on function public.sweep_old_foro_threads() from authenticated;
revoke execute on function public.rls_auto_enable() from authenticated;
revoke execute on function public.handle_new_auth_user() from authenticated;
revoke execute on function public.emit_user_hp_on_comment_post() from authenticated;
revoke execute on function public.emit_user_hp_on_comment_save() from authenticated;
revoke execute on function public.emit_user_hp_on_item_save() from authenticated;
revoke execute on function public.emit_user_hp_on_publish() from authenticated;
revoke execute on function public.emit_user_hp_on_reaction() from authenticated;
revoke execute on function public.emit_user_hp_on_vibe_check() from authenticated;


-- ── Part C · partner-team management RPCs (RLS-first) ───────────────────────
-- Replaces the direct users.partner_id/partner_admin UPDATEs in
-- app/api/partners/[id]/team/route.ts. Those went through the caller's RLS-
-- bound client, where users_self_update pins partner_id/partner_admin and
-- users_admin_all requires a site admin — so a partner-admin's write matched 0
-- rows (silent no-op). DO NOT "fix" that by adding a broad users UPDATE policy
-- or swapping in the service-role client: either would let a partner-admin
-- rewrite ANY user's role/partner (privilege escalation). Instead, these
-- SECURITY DEFINER functions re-derive the caller from auth.uid(), authorize
-- (site admin OR partner_admin of THIS partner), scope every mutation to this
-- partner, and only ever touch partner_id / partner_admin — never
-- role / is_mod / is_og.

create or replace function public.partner_team_add(p_partner_id text, p_user_id uuid)
returns public.users
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_role text;
  v_caller_partner text;
  v_caller_admin boolean;
  v_row public.users;
begin
  if v_caller is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select role, partner_id, partner_admin
    into v_role, v_caller_partner, v_caller_admin
    from public.users where id = v_caller;
  if not (v_role = 'admin'
          or (v_caller_partner = p_partner_id and v_caller_admin = true)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.items where id = p_partner_id and type = 'partner'
  ) then
    raise exception 'partner not found' using errcode = 'P0002';
  end if;
  update public.users
     set partner_id = p_partner_id, partner_admin = false
   where id = p_user_id
   returning * into v_row;
  if not found then
    raise exception 'user not found' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

create or replace function public.partner_team_set_admin(
  p_partner_id text, p_user_id uuid, p_admin boolean
)
returns public.users
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_role text;
  v_caller_partner text;
  v_caller_admin boolean;
  v_row public.users;
begin
  if v_caller is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select role, partner_id, partner_admin
    into v_role, v_caller_partner, v_caller_admin
    from public.users where id = v_caller;
  if not (v_role = 'admin'
          or (v_caller_partner = p_partner_id and v_caller_admin = true)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  -- Scope to this partner: cannot promote a user assigned elsewhere.
  update public.users
     set partner_admin = p_admin
   where id = p_user_id and partner_id = p_partner_id
   returning * into v_row;
  if not found then
    raise exception 'user not on this partner team' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

create or replace function public.partner_team_remove(p_partner_id text, p_user_id uuid)
returns public.users
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_role text;
  v_caller_partner text;
  v_caller_admin boolean;
  v_row public.users;
begin
  if v_caller is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select role, partner_id, partner_admin
    into v_role, v_caller_partner, v_caller_admin
    from public.users where id = v_caller;
  if not (v_role = 'admin'
          or (v_caller_partner = p_partner_id and v_caller_admin = true)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.users
     set partner_id = null, partner_admin = false
   where id = p_user_id and partner_id = p_partner_id
   returning * into v_row;
  if not found then
    raise exception 'user not on this partner team' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

revoke execute on function public.partner_team_add(text, uuid) from anon;
revoke execute on function public.partner_team_set_admin(text, uuid, boolean) from anon;
revoke execute on function public.partner_team_remove(text, uuid) from anon;
grant execute on function public.partner_team_add(text, uuid) to authenticated;
grant execute on function public.partner_team_set_admin(text, uuid, boolean) to authenticated;
grant execute on function public.partner_team_remove(text, uuid) to authenticated;

-- NOTE: app/api/partners/[id]/team/route.ts is updated (same branch) to call
-- these RPCs. Apply THIS script BEFORE deploying that code, or the route's
-- write methods (even for site admins) will fail until the functions exist.
