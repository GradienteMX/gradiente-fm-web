-- 0038_entities_fase2.sql
-- ============================================================================
-- Scene-entity registry, Fase 2. Extends the entity-attribution work from
-- migration 0029 to events + listicles and adds the editorial metadata the
-- CONTEXTO rail and composers were missing.
--
-- The item↔entity link table (item_entities) and the generic read/write path
-- already cover every content type — nothing schema-side is needed there. What
-- Fase 2 adds is three item-level columns plus four book formats:
--
--   * country       — país of the reviewed work / event (text, free-form so a
--                     festival lineup spanning countries can still note one).
--   * year          — release / edition / event year (smallint; NULL = none).
--   * subject_kind  — what the item is *about*: a record, a book, an event, or
--                     an exhibition. Drives the composer's field set (req 4 —
--                     the DISCO / LIBRO / EVENTO / EXPOSICIÓN switch) and lets a
--                     review compose the right CONTEXTO without a new type.
--
-- Book formats join the existing item_format enum so the single FORMATO field
-- serves both a vinyl review and a paperback review (no parallel column).
-- ============================================================================

-- ── subject_kind enum ────────────────────────────────────────────────────────
-- What the item reviews / documents. Distinct from `type` (the editorial
-- container) and from `format` (the physical/digital carrier). NULL for items
-- predating Fase 2 and for types where it's meaningless (mix, noticia, …).
create type item_subject_kind as enum ('record', 'book', 'event', 'exhibition');

alter table items
  add column if not exists subject_kind item_subject_kind,
  add column if not exists country      text,
  add column if not exists year         smallint;

comment on column items.subject_kind is
  'What the item is about (record/book/event/exhibition). Drives composer '
  'field set + CONTEXTO. NULL = unspecified / not applicable.';
comment on column items.country is
  'País of the reviewed work or event. Free-form; NULL = unspecified.';
comment on column items.year is
  'Release / edition / event year. NULL = unspecified.';

-- ── book formats on item_format ──────────────────────────────────────────────
-- Postgres allows ADD VALUE inside a transaction (PG12+) as long as the new
-- value is not *used* in the same transaction — it isn't here, so this is safe
-- under Supabase's transactional migration runner.
alter type item_format add value if not exists 'hardcover';
alter type item_format add value if not exists 'paperback';
alter type item_format add value if not exists 'ebook';
alter type item_format add value if not exists 'zine';
