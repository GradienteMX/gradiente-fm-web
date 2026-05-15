-- 0015_items_partner_id.sql
-- Partner attribution on non-partner content items.
--
-- When set, drives the //PRESENTA · X chip on cards + PUBLICADO POR //X byline
-- in overlays. References a partner row in the same `items` table (self-FK).
--
-- ON DELETE SET NULL — deleting a partner orphans the attribution but
-- preserves the content (the event/mix/noticia they authored). The chip just
-- stops rendering on those rows.
--
-- Partial index `where partner_id is not null` because the vast majority of
-- rows will have it null; sparse index keeps it cheap.
--
-- See wiki/90-Decisions/Partner Authoring.md for the design.

alter table items
  add column partner_id text references items(id) on delete set null;

create index if not exists items_partner_id_idx on items(partner_id)
  where partner_id is not null;
