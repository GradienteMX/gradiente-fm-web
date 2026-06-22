-- 0029_entities.sql
-- ============================================================================
-- Scene entity registry — artists, labels, venues, promoters as first-class
-- rows, plus an item↔entity link table. This is the foundation for turning
-- free-text metadata (items.artists[], items.venue) into a relational graph
-- where every mention is a clickable cross-reference to "everything about X".
-- ============================================================================
--
-- WHY a single `entities` table with a `kind` column (vs. one table per type):
--   * The headline feature — "any mention links to a filter of everything that
--     touches that entity" — becomes ONE mechanism instead of four.
--   * A person can be both an artist AND a label (common in the scene); a
--     single row with one kind today can grow a second linkage later without
--     a schema change.
--   * Browse-by-kind ("show all venues", "show all artists") is just
--     `where kind = '…'` — no extra plumbing.
--
-- GOVERNANCE (mirrors the items write model in 0002 / 0013):
--   * INSERT  — guide-or-admin. Content authors create entities on the fly via
--               composer type-ahead. The app de-dupes by (kind, slug) first;
--               a genuinely new name inserts a fresh row.
--   * UPDATE  — admin only. Editing an entity (rename, merge, attach bio/image)
--               affects every item that references it, so it is a curation-tier
--               operation, not an author-tier one.
--   * DELETE  — admin only. Prefer `merged_into` over hard delete so existing
--               links stay resolvable.
--   * SELECT  — any authenticated user (matches the auth-gated read model in
--               0014; the whole site is invite-only behind /welcome).
--
-- FORMAT is intentionally NOT an entity — it is a closed set (vinyl / cassette
-- / cd / digital / mix), so it lives as an enum column on items. No filter page
-- "everything that is vinyl" is needed at the entity level; a tag/filter covers
-- that later if wanted.
-- ============================================================================

-- ── enums ────────────────────────────────────────────────────────────────────
create type entity_kind as enum ('artist', 'label', 'venue', 'promoter');

-- How an item relates to an entity. `subject` rows surface in the CONTEXTO
-- rail of the overlay; `mention` rows are inline references inside the body
-- text (authored in a later phase). Both feed the same per-entity filter.
create type entity_relation as enum ('subject', 'mention');

-- Physical/digital format a review (or other item) is about. Closed set.
create type item_format as enum ('vinyl', 'cassette', 'cd', 'digital', 'mix', 'other');

-- ── entities ─────────────────────────────────────────────────────────────────
create table entities (
  id          uuid primary key default gen_random_uuid(),
  kind        entity_kind not null,
  name        text not null,
  slug        text not null,                         -- url-safe, derived from name
  -- Optional metadata — all additive, populated over time by admins. None of
  -- it is required to create-on-the-fly: a bare (kind, name, slug) is enough.
  bio         text,
  image_url   text,
  city        text,                                  -- mostly meaningful for venue
  links       jsonb not null default '[]'::jsonb,    -- [{ platform, url }] — site/IG/Bandcamp
  -- De-dup pointer. When an admin merges a duplicate ("RoPax" → "Ro Pax"),
  -- the loser's row keeps `merged_into` set so old links still resolve while
  -- the app transparently follows the pointer to the canonical entity.
  merged_into uuid references entities(id) on delete set null,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Same name can exist across kinds (an artist "Mind" and a label "Mind"),
  -- but is unique within a kind. slug normalizes case/spacing so "Ro Pax" and
  -- "ro pax" collide here and get de-duped on insert.
  unique (kind, slug)
);

create index entities_kind_idx on entities(kind);
-- Supports the composer type-ahead (case-insensitive prefix search per kind).
create index entities_kind_name_lower_idx on entities(kind, lower(name));

-- ── item_entities (link) ─────────────────────────────────────────────────────
create table item_entities (
  item_id    text not null references items(id) on delete cascade,
  entity_id  uuid not null references entities(id) on delete cascade,
  relation   entity_relation not null default 'subject',
  created_at timestamptz not null default now(),
  primary key (item_id, entity_id, relation)
);

create index item_entities_entity_idx on item_entities(entity_id);
create index item_entities_item_idx on item_entities(item_id);

-- ── items.format ─────────────────────────────────────────────────────────────
alter table items
  add column if not exists format item_format;

comment on column items.format is
  'Physical/digital format the item is about (reviews mainly). Closed enum; '
  'NULL = unspecified.';

-- ── auto-bump updated_at on entity edits (mirrors vibe_checks trigger) ────────
create or replace function touch_entities_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger entities_touch_updated
  before update on entities
  for each row execute function touch_entities_updated_at();

-- ── RLS: entities ────────────────────────────────────────────────────────────
alter table entities enable row level security;

create policy entities_authed_read on entities
  for select
  using (auth.uid() is not null);

create policy entities_author_insert on entities
  for insert
  with check (private.auth_is_guide_or_admin());

create policy entities_admin_update on entities
  for update
  using (private.auth_is_admin())
  with check (private.auth_is_admin());

create policy entities_admin_delete on entities
  for delete
  using (private.auth_is_admin());

-- ── RLS: item_entities ───────────────────────────────────────────────────────
-- Links are JOIN attachments — read alongside their parent item (which is
-- already auth-gated). Write follows the items_staff_insert gate; admins
-- implicitly covered.
alter table item_entities enable row level security;

create policy item_entities_authed_read on item_entities
  for select
  using (auth.uid() is not null);

create policy item_entities_author_write on item_entities
  for all
  using (private.auth_is_guide_or_admin())
  with check (private.auth_is_guide_or_admin());
