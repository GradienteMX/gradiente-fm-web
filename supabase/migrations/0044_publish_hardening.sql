-- 0044_publish_hardening.sql
-- Follow-ups from the publish bug hunt (2026-07). Three independent hardenings:
--   #21  drafts: enforce one row per (author, ContentItem.id) so concurrent
--        saves can't create duplicates (which made .maybeSingle() error → 500).
--   #24  polls: tie authoring-role writes to the PARENT ITEM's ownership so a
--        curator/guide/insider can't rewrite polls on other users' items via
--        direct PostgREST.
--   #25  items: reserve type='partner' rows to admins (the app model already
--        does; RLS let any guide mint one, which could back an unauthorized
--        partner org).

-- ── #21 drafts uniqueness ───────────────────────────────────────────────────
-- Collapse any pre-existing duplicates first (keep the most recently updated
-- row per author+item id; break ties by drafts.id), then add the unique index.
delete from drafts d
using drafts d2
where d.author_id = d2.author_id
  and d.item_payload->>'id' is not null
  and d.item_payload->>'id' = d2.item_payload->>'id'
  and (
    d.updated_at < d2.updated_at
    or (d.updated_at = d2.updated_at and d.id < d2.id)
  );

create unique index if not exists drafts_author_item_uniq
  on drafts (author_id, (item_payload->>'id'))
  where item_payload->>'id' is not null;

-- ── #24 poll writes tied to item ownership ──────────────────────────────────
drop policy if exists polls_authoring_write on polls;

-- INSERT/UPDATE/DELETE on a poll require: staff (guide/admin), OR ownership of
-- the parent item, OR partner-team membership of the parent item's partner
-- (mirrors items_partner_team_* so a teammate editing a partner item's poll
-- still works). Reading stays public (polls_public_read).
create policy polls_owner_or_staff_write on polls
  for all
  to authenticated
  using (
    private.auth_is_guide_or_admin()
    or exists (
      select 1 from items i
      where i.id = polls.item_id
        and i.created_by = (select auth.uid())
    )
    or exists (
      select 1 from items i
      join users u on u.id = (select auth.uid())
      where i.id = polls.item_id
        and i.partner_id is not null
        and i.partner_id = u.partner_id
    )
  )
  with check (
    private.auth_is_guide_or_admin()
    or exists (
      select 1 from items i
      where i.id = polls.item_id
        and i.created_by = (select auth.uid())
    )
    or exists (
      select 1 from items i
      join users u on u.id = (select auth.uid())
      where i.id = polls.item_id
        and i.partner_id is not null
        and i.partner_id = u.partner_id
    )
  );

-- ── #25 partner-type rows are admin-only ────────────────────────────────────
drop policy if exists items_staff_insert on items;
create policy items_staff_insert on items
  for insert
  with check (
    private.auth_is_guide_or_admin()
    and (type <> 'partner' or private.auth_is_admin())
  );

drop policy if exists items_staff_update on items;
create policy items_staff_update on items
  for update
  using (private.auth_is_guide_or_admin())
  with check (
    private.auth_is_guide_or_admin()
    and (type <> 'partner' or private.auth_is_admin())
  );
