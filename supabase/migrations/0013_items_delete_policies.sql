-- ============================================================================
-- 0013_items_delete_policies.sql — split items_staff_write so DELETE has its
-- own gate (owner OR admin), instead of any guide being able to delete any
-- editor's content.
-- ============================================================================
-- Before: `items_staff_write` was `for all` using auth_is_guide_or_admin(),
-- which covered SELECT/INSERT/UPDATE/DELETE in one sweep. Any guide could
-- delete anyone else's content. After:
--   - INSERT/UPDATE: still gated on guide-or-admin (no behavior change)
--   - SELECT:        unchanged (handled by items_staff_read + public_read)
--   - DELETE:        gated on (created_by = auth.uid()) OR (admin)
--
-- Owner-delete relies on items.created_by being stamped at publish time
-- (already done in app/api/items/route.ts since 0012). Rows with NULL
-- created_by (legacy seeds) are deletable only by admin.
-- ============================================================================

drop policy if exists items_staff_write on items;

create policy items_staff_insert on items
  for insert
  with check (private.auth_is_guide_or_admin());

create policy items_staff_update on items
  for update
  using (private.auth_is_guide_or_admin())
  with check (private.auth_is_guide_or_admin());

create policy items_owner_delete on items
  for delete
  using (created_by = auth.uid());

create policy items_admin_delete on items
  for delete
  using (private.auth_is_admin());
