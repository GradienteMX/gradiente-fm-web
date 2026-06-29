-- ============================================================================
-- 0042_insider_curator_authoring.sql — let insider/curator publish their OWN
-- items, aligning RLS with the app's role model (lib/permissions.ts).
-- ============================================================================
-- The bug it fixes:
--   lib/permissions.ts canCreateContent() treats `insider` as a publishing-
--   equal sibling of `guide` (ROLE_RANK tier 2), and `curator` (tier 1) as a
--   listicle author. The dashboard shows these roles the composer + PUBLICAR
--   button. But the only items INSERT policies were:
--     - items_staff_insert         → private.auth_is_guide_or_admin()
--                                     i.e. role in ('guide','admin') — a literal
--                                     check with NO insider/curator, no rank.
--     - items_partner_team_insert  → requires source='manual:partner' + the
--                                     user's own partner_id.
--   So a plain insider's personal publish satisfied neither policy → Postgres
--   raised "new row violates row-level security policy" → /api/items returned
--   403 → the publish button silently "did nothing".
--
--   private.auth_is_authoring_role() (0001) already enumerates
--   curator/guide/insider/admin, but it was never wired to a policy.
--
-- The fix:
--   A per-type author gate that mirrors canCreateContent() exactly, plus
--   own-row INSERT/UPDATE policies for the PERSONAL (non-partner) path:
--     - partner_id must be null  → partner attribution stays exclusively on
--                                   items_partner_team_* (own partner_id only),
--                                   so an insider can't claim a partner.
--     - source null | manual:editor → can't masquerade as scraper/partner.
--     - editorial = false        → the spawn-HP boost stays an editor/guide
--                                   lever; the API stamps editorial=false for
--                                   this path in lockstep (app/api/items/route.ts).
--   guide/admin keep their existing items_staff_* powers (incl. the editorial
--   lever and editing others' content); RLS policies OR together.
-- ============================================================================

create or replace function private.auth_can_author_type(p_type content_type)
returns boolean
language sql stable security definer set search_path = public, auth as $$
  -- Mirror of lib/permissions.ts canCreateContent() for the personal-author
  -- (non-partner) path:
  --   listicle                                   → curator+ (tier 1)
  --   mix/opinion/noticia/evento/editorial/review/articulo → guide+ (tier 2,
  --                                                guide ≡ insider)
  --   partner                                    → admin-only, via items_staff_insert
  select coalesce((
    select case
      when p_type = 'listicle'
        then u.role in ('curator', 'guide', 'insider', 'admin')
      when p_type in ('mix', 'opinion', 'noticia', 'evento', 'editorial', 'review', 'articulo')
        then u.role in ('guide', 'insider', 'admin')
      else false
    end
    from public.users u
    where u.id = (select auth.uid())
  ), false);
$$;

grant execute on function private.auth_can_author_type(content_type)
  to anon, authenticated, service_role;

-- INSERT — publish one's OWN personal item of a tier-permitted type.
drop policy if exists items_author_insert on items;
create policy items_author_insert on items
  for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and private.auth_can_author_type(type)
    and partner_id is null
    and (source is null or source = 'manual:editor'::content_source)
    and editorial = false
  );

-- UPDATE — re-publish / edit one's OWN personal item. The publish endpoint
-- upserts by id, so an existing row takes the UPDATE path; same guard rails.
drop policy if exists items_author_update on items;
create policy items_author_update on items
  for update
  to authenticated
  using (
    created_by = (select auth.uid())
    and partner_id is null
    and private.auth_can_author_type(type)
  )
  with check (
    created_by = (select auth.uid())
    and private.auth_can_author_type(type)
    and partner_id is null
    and (source is null or source = 'manual:editor'::content_source)
    and editorial = false
  );
