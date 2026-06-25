-- ── entities.address ─────────────────────────────────────────────────────────
-- Street address for an entity — mostly meaningful for venues, so the admin
-- events editor can store a venue's real address once and reuse it across all
-- of that venue's events. Additive, optional; bare (kind, name, slug) entities
-- still resolve-or-create without it. Sits alongside the existing `city`
-- metadata column from migration 0029.
alter table entities add column if not exists address text;

comment on column entities.address is
  'Street address; mostly for venues. NULL = unspecified.';

-- Refresh PostgREST's schema cache so the new column is queryable immediately
-- (same step the 0038 columns needed in prod).
notify pgrst, 'reload schema';
