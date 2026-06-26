-- 0041_item_links.sql
-- Free-form outbound links surfaced in the CONTEXTO block of an item overlay —
-- "where to buy / listen / read more" (Bandcamp, Discogs, official site, news
-- source…). Distinct from `embeds` (playable sources) and the entity registry
-- (browsable scene rows): these are plain labeled URLs that don't deserve their
-- own row. Authored in the dashboard via the new LinkListField (ReviewForm first).
--
-- Shape: jsonb array of { "label": string, "url": string } (the EntityLink type).
-- Nullable + defaulted, so this is backward-compatible and safe to apply BEFORE
-- the code deploys. The composer rides the drafts payload (jsonb) for free; only
-- PUBLISHED items need this column. `contentItemToRow` sends `links` only when an
-- item has at least one link, so link-less items publish fine even if this hasn't
-- been applied yet — but apply it before anyone publishes an item WITH links.
--
-- Apply via the Supabase SQL editor — NEVER `supabase db push` (prod migration
-- history is drifted; see the migration-history-drift note).

alter table public.items
  add column if not exists links jsonb not null default '[]'::jsonb;
