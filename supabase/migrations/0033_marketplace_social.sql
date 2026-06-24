-- 0033_marketplace_social.sql
-- Marketplace social layer: lightweight per-listing comments + a view counter
-- that drives invisible HL-style ordering of the item feed.
--
-- listing_comments is intentionally SEPARATE from the editorial `comments`
-- table: those FK to items(id) and carry !/? reactions that feed user rank.
-- Marketplace comments are just "a buyer asks, the seller replies" — flat with
-- one level of replies, no reactions, no rank effects.

-- ── Comments ─────────────────────────────────────────────────────────────────
create table listing_comments (
  id          uuid primary key default gen_random_uuid(),
  listing_id  text not null references marketplace_listings(id) on delete cascade,
  author_id   uuid not null references users(id) on delete cascade,
  parent_id   uuid references listing_comments(id) on delete cascade,
  body        text not null check (length(trim(body)) > 0),
  created_at  timestamptz not null default now(),
  edited_at   timestamptz
);

create index listing_comments_listing_idx on listing_comments(listing_id, created_at);
create index listing_comments_parent_idx on listing_comments(parent_id)
  where parent_id is not null;

alter table listing_comments enable row level security;

-- Read: any authenticated user (the whole site is invite-gated).
create policy listing_comments_authed_read on listing_comments
  for select using (auth.uid() is not null);

-- Write: a user can only post / edit as themselves.
create policy listing_comments_self_insert on listing_comments
  for insert with check (author_id = auth.uid());
create policy listing_comments_self_update on listing_comments
  for update using (author_id = auth.uid()) with check (author_id = auth.uid());

-- Delete: own comment, or site admin (moderation).
create policy listing_comments_own_delete on listing_comments
  for delete using (author_id = auth.uid());
create policy listing_comments_admin_delete on listing_comments
  for delete using (private.auth_is_admin());

-- ── View counter (invisible HL signal) ──────────────────────────────────────
-- Drives the item-feed ordering (recency blended with visits). Never shown as
-- a number — Gradiente's "size/position only" rule still holds; views only
-- nudge order.
alter table marketplace_listings
  add column if not exists views integer not null default 0;

-- Bumping views is open to any visitor, but we don't want a blanket UPDATE
-- policy (that'd let anyone rewrite price/status). A SECURITY DEFINER function
-- scopes the write to just the counter.
create or replace function increment_listing_views(p_listing_id text)
returns void
language sql
security definer
set search_path = public
as $$
  update marketplace_listings
    set views = views + 1
  where id = p_listing_id;
$$;

grant execute on function increment_listing_views(text) to anon, authenticated;
