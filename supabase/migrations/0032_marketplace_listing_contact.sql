-- 0032_marketplace_listing_contact.sql
-- Per-listing contact routing, external sale link, and related-content links.
-- All additive + nullable / default-empty, so existing listing rows are
-- untouched and the feature degrades gracefully if the migration lags.
--
--   sale_url       — external buy/listen link (Discogs, Bandcamp, store…)
--   whatsapp       — WhatsApp number or wa.me link for buyer contact
--   contact_email  — email for buyer contact / transaction
--   related_links  — [{ label, url }] pointing to related Gradiente content
--                    (editorials / lists / articles). The marketplace↔content
--                    cross-link the redesign is built around.

alter table marketplace_listings
  add column if not exists sale_url text,
  add column if not exists whatsapp text,
  add column if not exists contact_email text,
  add column if not exists related_links jsonb not null default '[]'::jsonb;

comment on column marketplace_listings.sale_url is
  'External buy/listen link for the listing (Discogs, Bandcamp, store, etc.).';
comment on column marketplace_listings.whatsapp is
  'WhatsApp number or wa.me link for buyer contact.';
comment on column marketplace_listings.contact_email is
  'Email for buyer contact / transaction.';
comment on column marketplace_listings.related_links is
  'Array of { label, url } links to related Gradiente content (editorials/lists/articles).';
