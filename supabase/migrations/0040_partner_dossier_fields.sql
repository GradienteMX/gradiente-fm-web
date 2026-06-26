-- 0040_partner_dossier_fields.sql
-- Partner dossier fields for the full-page partner revamp
-- (project_partner_page_revamp). Both columns are nullable/defaulted, so this is
-- backward-compatible and safe to apply BEFORE the code deploys.
--
-- Apply via the Supabase SQL editor — NEVER `supabase db push` (prod migration
-- history is drifted; see the migration-history-drift note).
--
--   verified         — official/verified partner → //VERIFICADO badge in the
--                      dossier identity panel.
--   featured_item_id — the partner-chosen //HISTORIA DESTACADA item: an items.id
--                      of a //PRESENTA-attributed item. Plain text, resolved
--                      app-side; a stale id simply renders nothing.

alter table public.items
  add column if not exists verified boolean not null default false;

alter table public.items
  add column if not exists featured_item_id text;
