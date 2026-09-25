-- ============================================================================
-- 0052 — STICKERS («CALCOS»)
--
-- Stickers are pressed onto a member's credencial (its acrylic case): a
-- franja's mark from its store, a night's stub, the house's own. Placed
-- stickers are permanent — the only way off is scraping, pass by pass — and
-- they age with real time. See docs/06-LIBREA.md §4.
--
-- The CATALOG is not a table: it is derived deterministically from the
-- franjas and nights in `items` (lib/stickers/catalog.ts — the client and the
-- API routes run the same function), so ids look like `st-<franja-slug>-logo`,
-- `st-<slug>-holo`, `st-ev-<item-id>`, `st-casa-energia`. Everything here
-- stores those ids as text.
--
-- THE CLOSED BETA leaves a clean slate for the release: every row granted or
-- created while the beta runs carries `batch = 'beta-2026'`
-- (lib/stickers/beta.ts), and `scripts/stickersBeta.ts --wipe` removes them
-- all (placements cascade) and resets the serial counters. After the release
-- the real unlock rules (support, franja membership, trophies, tickets)
-- grant copies with `batch = null`.
--
-- Writes: only through the API routes (app/api/stickers/*) with the
-- service-role client — they validate against the catalog and the rules. No
-- client can insert, update or delete these tables directly.
--
-- Apply via the Supabase SQL editor — NEVER `supabase db push`
-- (migration-history drift; see wiki + memory).
-- ============================================================================

-- ── copies: what someone holds (the binder, placed or not) ──────────────────
create table if not exists public.sticker_copies (
  uid         uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  -- catalog id (lib/stickers/catalog.ts), e.g. 'st-club-japan-holo'
  sticker_id  text not null check (sticker_id ~ '^st-[a-z0-9-]+$'),
  -- how it arrived: a purchase, a night's stub, a gift from the house, and
  -- (after release) the unlock rules; 'beta' / 'prueba' only during the beta
  via         text not null check (via in ('compra', 'boleto', 'regalo', 'franja', 'trofeo', 'participacion', 'beta', 'prueba')),
  -- n of a numbered run (StickerDef.edition); null for open runs and beta kits
  serial      integer check (serial is null or serial > 0),
  -- 'beta-2026' for everything from the closed beta (wiped at release)
  batch       text,
  acquired_at timestamptz not null default now()
);

create index if not exists sticker_copies_user_idx on public.sticker_copies (user_id, acquired_at desc);
create index if not exists sticker_copies_batch_idx on public.sticker_copies (batch) where batch is not null;
-- A serial is issued once per sticker. (Plain insert-time guard; nothing
-- upserts into this table, so the partial index never meets ON CONFLICT.)
create unique index if not exists sticker_copies_serial_uniq on public.sticker_copies (sticker_id, serial) where serial is not null;

-- ── placements: a copy pressed onto the case (public on every card) ─────────
create table if not exists public.sticker_placements (
  -- the copy itself: one placement per copy; scraping it off deletes the copy
  uid        uuid primary key references public.sticker_copies(uid) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  -- denormalized so other people's cards render without reading their binder
  sticker_id text not null,
  face       text not null check (face in ('frente', 'dorso')),
  -- centre in face coordinates (0..1 over the printed card; up to 0.1 past it,
  -- where it wraps round the case's edge — PLACEMENT_BLEED)
  x          real not null check (x >= -0.1 and x <= 1.1),
  y          real not null check (y >= -0.1 and y <= 1.1),
  rot        real not null,
  scale      real not null check (scale >= 0.6 and scale <= 1.5),
  -- stacking: later presses sit above earlier ones
  z          integer not null,
  -- age (and its patina) counts from here
  placed_at  timestamptz not null default now(),
  -- 0..1 scraped; at 1 the copy is deleted
  wear       real not null default 0 check (wear >= 0 and wear < 1)
);

create index if not exists sticker_placements_user_idx on public.sticker_placements (user_id, z);

-- ── a night's stub: one per person per night, even after it's scraped ───────
create table if not exists public.sticker_stub_claims (
  user_id    uuid not null references public.users(id) on delete cascade,
  sticker_id text not null check (sticker_id ~ '^st-ev-'),
  claimed_at timestamptz not null default now(),
  batch      text,
  primary key (user_id, sticker_id)
);

create index if not exists sticker_stub_claims_batch_idx on public.sticker_stub_claims (batch) where batch is not null;

-- ── serial counters for numbered runs ───────────────────────────────────────
create table if not exists public.sticker_serials (
  sticker_id text primary key,
  last       integer not null default 0 check (last >= 0)
);

-- ── beta vouchers: a few store picks per tester while payments don't exist ──
create table if not exists public.sticker_vouchers (
  user_id   uuid primary key references public.users(id) on delete cascade,
  remaining integer not null default 0 check (remaining >= 0),
  batch     text
);

-- The next serial of a numbered run, atomically (the counter row is the lock).
create or replace function public.sticker_next_serial(p_sticker_id text) returns integer
language sql
security definer
set search_path = public
as $$
  insert into public.sticker_serials (sticker_id, last) values (p_sticker_id, 1)
  on conflict (sticker_id) do update set last = public.sticker_serials.last + 1
  returning last;
$$;

revoke all on function public.sticker_next_serial(text) from public, anon, authenticated;
grant execute on function public.sticker_next_serial(text) to service_role;

-- Spend one beta voucher, atomically; null when none are left.
create or replace function public.sticker_use_voucher(p_user uuid) returns integer
language sql
security definer
set search_path = public
as $$
  update public.sticker_vouchers set remaining = remaining - 1
  where user_id = p_user and remaining > 0
  returning remaining;
$$;

-- Give it back when the pick fails after spending it (sold out, write error).
create or replace function public.sticker_refund_voucher(p_user uuid) returns integer
language sql
security definer
set search_path = public
as $$
  update public.sticker_vouchers set remaining = remaining + 1
  where user_id = p_user
  returning remaining;
$$;

revoke all on function public.sticker_use_voucher(uuid) from public, anon, authenticated;
revoke all on function public.sticker_refund_voucher(uuid) from public, anon, authenticated;
grant execute on function public.sticker_use_voucher(uuid) to service_role;
grant execute on function public.sticker_refund_voucher(uuid) to service_role;

-- ============================================================================
-- RLS — reads only; every write goes through the service-role API routes.
-- ============================================================================

alter table public.sticker_copies      enable row level security;
alter table public.sticker_placements  enable row level security;
alter table public.sticker_stub_claims enable row level security;
alter table public.sticker_serials     enable row level security;
alter table public.sticker_vouchers    enable row level security;

-- A binder is private: your own copies (admins see all, for Central).
drop policy if exists sticker_copies_own_read on public.sticker_copies;
create policy sticker_copies_own_read on public.sticker_copies
  for select to authenticated
  using (user_id = auth.uid() or private.auth_is_admin());

-- Every card is public to the members: placements are readable by anyone signed in.
drop policy if exists sticker_placements_member_read on public.sticker_placements;
create policy sticker_placements_member_read on public.sticker_placements
  for select to authenticated
  using (true);

drop policy if exists sticker_stub_claims_own_read on public.sticker_stub_claims;
create policy sticker_stub_claims_own_read on public.sticker_stub_claims
  for select to authenticated
  using (user_id = auth.uid() or private.auth_is_admin());

-- How much of a numbered run is left is a catalog fact («quedan 12 de 150»).
drop policy if exists sticker_serials_member_read on public.sticker_serials;
create policy sticker_serials_member_read on public.sticker_serials
  for select to authenticated
  using (true);

drop policy if exists sticker_vouchers_own_read on public.sticker_vouchers;
create policy sticker_vouchers_own_read on public.sticker_vouchers
  for select to authenticated
  using (user_id = auth.uid() or private.auth_is_admin());

comment on table public.sticker_copies is
  'Sticker copies held by members (binder). Catalog ids are derived in lib/stickers/catalog.ts. batch=beta-2026 rows are wiped at release (scripts/stickersBeta.ts --wipe). Writes only via app/api/stickers/*.';
comment on table public.sticker_placements is
  'Copies pressed onto a credencial case. Permanent: only scraping removes them (wear reaches 1 → the copy is deleted).';
