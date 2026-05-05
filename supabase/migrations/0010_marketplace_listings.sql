-- 0010_marketplace_listings.sql
-- Move marketplace listings from items.marketplace_listings (jsonb) into a
-- proper table. Why: per-listing CRUD on a jsonb array isn't race-safe
-- (two team members editing rewrite each other), RLS can't gate per
-- listing, and orphan-image cleanup needs a real listing row to FK
-- against. Splitting into a table makes all three tractable.

-- ── Table ──────────────────────────────────────────────────────────────────
-- text id (matching the existing 'mkl-...' convention from the seed) so
-- we don't break URLs or hand-rolled references. partner_id FK CASCADE
-- so deleting a partner cleans up its listings (mirrors existing items
-- delete behavior).
create table marketplace_listings (
  id text primary key,
  partner_id text not null references items(id) on delete cascade,
  title text not null check (length(title) > 0),
  category text not null check (category in (
    'vinyl', 'cassette', 'cd', 'synth', 'drum-machine',
    'turntable', 'mixer', 'outboard', 'merch', 'other'
  )),
  subcategory text,
  price numeric not null default 0 check (price >= 0),
  condition text not null check (condition in (
    'NEW', 'NM', 'VG+', 'VG', 'G+', 'G', 'F'
  )),
  status text not null default 'available' check (status in (
    'available', 'reserved', 'sold'
  )),
  description text,
  tags text[] not null default '{}',
  shipping_mode text check (shipping_mode in ('shipping', 'local', 'both')),
  images text[] not null default '{}',
  embeds jsonb not null default '[]'::jsonb,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index marketplace_listings_partner_idx
  on marketplace_listings(partner_id, published_at desc);
create index marketplace_listings_status_idx
  on marketplace_listings(status);

-- ── Data migration ────────────────────────────────────────────────────────
-- Expand existing jsonb arrays into rows. Today only the N.A.A.F.I. seed
-- has 6 listings; real partners have 0. We migrate all of them so nothing
-- is lost when the column drops below.
insert into marketplace_listings (
  id, partner_id, title, category, subcategory, price, condition, status,
  description, tags, shipping_mode, images, embeds, published_at, updated_at
)
select
  l->>'id',
  i.id,
  l->>'title',
  l->>'category',
  l->>'subcategory',
  coalesce((l->>'price')::numeric, 0),
  l->>'condition',
  coalesce(l->>'status', 'available'),
  l->>'description',
  coalesce(
    (select array_agg(t) from jsonb_array_elements_text(coalesce(l->'tags', '[]'::jsonb)) t),
    '{}'::text[]
  ),
  l->>'shippingMode',
  coalesce(
    (select array_agg(im) from jsonb_array_elements_text(coalesce(l->'images', '[]'::jsonb)) im),
    '{}'::text[]
  ),
  coalesce(l->'embeds', '[]'::jsonb),
  coalesce((l->>'publishedAt')::timestamptz, now()),
  now()
from items i
cross join lateral jsonb_array_elements(coalesce(i.marketplace_listings, '[]'::jsonb)) as l
where i.type = 'partner'
  and jsonb_typeof(coalesce(i.marketplace_listings, '[]'::jsonb)) = 'array'
  and jsonb_array_length(coalesce(i.marketplace_listings, '[]'::jsonb)) > 0;

-- ── Drop legacy column ────────────────────────────────────────────────────
-- After this, the only listing storage is the new table. Row mappers
-- + writes update accordingly in the same commit's code changes.
alter table items drop column marketplace_listings;

-- ── RLS ───────────────────────────────────────────────────────────────────
-- Enable + policies. Reads are public so the catalog/overlay don't need
-- service-role tokens; writes are gated to site admin OR partner team
-- member (matches canManagePartner from lib/permissions.ts).
alter table marketplace_listings enable row level security;

create policy marketplace_listings_anon_read on marketplace_listings
  for select using (true);

create policy marketplace_listings_team_write on marketplace_listings
  for all
  using (
    exists (
      select 1 from users u
      where u.id = auth.uid()
        and (u.role = 'admin' or u.partner_id = marketplace_listings.partner_id)
    )
  )
  with check (
    exists (
      select 1 from users u
      where u.id = auth.uid()
        and (u.role = 'admin' or u.partner_id = marketplace_listings.partner_id)
    )
  );

-- ── updated_at auto-bump ──────────────────────────────────────────────────
-- Reuses the existing set_updated_at() trigger function (defined in
-- 0001_init for items / users / etc.). Keeps app code from having to
-- manually touch updated_at on every PATCH.
create trigger marketplace_listings_set_updated_at
  before update on marketplace_listings
  for each row
  execute function set_updated_at();
