-- ============================================================================
-- 0001_init.sql — Gradiente FM consolidated schema (squash of 0001-0015)
-- ============================================================================
-- Replaces:
--   0001_init                — schema baseline
--   0002_rls                 — RLS policies (now in 0002_rls.sql)
--   0003_function_hardening  — superseded by private-schema move (0006)
--   0004_grants              — table grants (folded in here)
--   0005_dev_visibility      — temporary, reverted by 0010
--   0006_private_helpers     — auth helpers in `private` schema (folded in)
--   0007_helper_grants_fix   — re-grants on the new schema (folded in)
--   0008_pgrst_reload        — one-shot schema-cache flush (no longer needed)
--   0009_auth_trigger        — handle_new_auth_user trigger (folded in;
--                              `private.lookup_email_by_username` dropped — dead code,
--                              the route handler uses auth.admin.getUserById instead)
--   0010_tighten_dev_visibility — final state (folded into policies in 0002)
--   0011_saved_comments      — saved_comments table (folded in)
--   0012_items_created_by    — items.created_by (folded into items table)
--   0013_uploads_bucket      — Storage (now in 0003_storage.sql)
--   0014_foro_bump_trigger   — foro_replies bump trigger (folded in)
--   0015_realtime_publications — Realtime (now in 0004_realtime.sql)
-- ============================================================================


-- ── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists pgcrypto;     -- gen_random_uuid()


-- ── Schemas ─────────────────────────────────────────────────────────────────
-- Auth helpers + the foro bump trigger live in `private` so they can't be
-- called as PostgREST RPCs. Policies reference them by qualified name.
create schema if not exists private;
grant usage on schema private to anon, authenticated, service_role;


-- ── Enum types ──────────────────────────────────────────────────────────────
create type content_type as enum (
  'evento', 'mix', 'noticia', 'review', 'editorial',
  'opinion', 'articulo', 'listicle', 'partner'
);

create type content_source as enum (
  'scraper:ra', 'manual:editor', 'manual:partner'
);

create type partner_kind as enum (
  'promo', 'label', 'promoter', 'venue', 'sponsored'
);

create type user_role as enum (
  'user', 'curator', 'guide', 'insider', 'admin'
);

create type reaction_kind as enum (
  'provocative', 'signal'
);

create type poll_kind as enum (
  'from-list', 'from-tracklist', 'attendance', 'freeform'
);

create type mix_status as enum (
  'disponible', 'exclusivo', 'archivo', 'proximamente'
);


-- ── Trigger functions ──────────────────────────────────────────────────────
create or replace function set_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ============================================================================
-- ITEMS — main content table
-- ============================================================================
create table items (
  id text primary key,
  slug text unique not null,
  type content_type not null,

  title text not null,
  subtitle text,
  excerpt text,

  vibe smallint not null check (vibe between 0 and 10),
  genres text[] not null default '{}',
  tags text[] not null default '{}',

  image_url text,

  published_at timestamptz not null,
  date timestamptz,
  end_date timestamptz,
  expires_at timestamptz,

  source content_source,
  external_id text,
  ra_last_seen_at timestamptz,
  elevated boolean not null default false,

  -- Event fields
  venue text,
  venue_city text,
  artists text[],
  ticket_url text,
  price text,

  -- Mix fields
  mix_url text,
  embeds jsonb not null default '[]'::jsonb,
  duration text,
  tracklist jsonb not null default '[]'::jsonb,
  mix_series text,
  recorded_in text,
  mix_format text,
  bpm_range text,
  musical_key text,
  mix_status mix_status,

  -- Article fields
  author text,
  read_time int,
  editorial boolean not null default false,
  pinned boolean not null default false,
  body_preview text,

  -- Long-form articulo
  article_body jsonb not null default '[]'::jsonb,
  footnotes jsonb not null default '[]'::jsonb,
  hero_caption text,

  -- Partner rail
  partner_kind partner_kind,
  partner_url text,
  partner_last_updated timestamptz,

  -- Marketplace
  marketplace_enabled boolean not null default false,
  marketplace_description text,
  marketplace_location text,
  marketplace_currency text,
  marketplace_listings jsonb not null default '[]'::jsonb,

  -- Curation — written by HP rollup pg_cron
  hp double precision,
  hp_last_updated_at timestamptz,

  published boolean not null default true,
  seed boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger items_set_updated_at
  before update on items
  for each row execute function set_updated_at();

create index items_type_published_idx
  on items(type, published_at desc) where published = true and seed = false;
create index items_hp_idx
  on items(type, hp desc nulls last) where published = true and seed = false;
create index items_published_at_idx on items(published_at desc);
create unique index items_external_ra_idx
  on items(external_id) where source = 'scraper:ra';
create index items_seed_idx on items(seed) where seed = true;
create index items_pinned_idx on items(pinned) where pinned = true;
create index items_partner_marketplace_idx
  on items(type) where type = 'partner' and marketplace_enabled = true;

-- Full-text search column (Spanish dictionary).
alter table items add column search_tsv tsvector
  generated always as (
    setweight(to_tsvector('spanish', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(subtitle, '')), 'B') ||
    setweight(to_tsvector('spanish', coalesce(excerpt, '')), 'C') ||
    setweight(to_tsvector('spanish', coalesce(body_preview, '')), 'C')
  ) stored;
create index items_search_idx on items using gin(search_tsv);


-- ============================================================================
-- USERS — extends auth.users
-- ============================================================================
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,

  role user_role not null default 'user',
  is_mod boolean not null default false,
  is_og boolean not null default false,

  partner_id text references items(id) on delete set null,
  partner_admin boolean not null default false,

  profile_meta jsonb not null default '{}'::jsonb,

  joined_at timestamptz not null default now(),
  seed boolean not null default false
);

create index users_role_idx on users(role) where role <> 'user';
create index users_partner_idx on users(partner_id) where partner_id is not null;


-- ── items.created_by — added late so the FK to users(id) resolves ──────────
-- Tracks the editor who published an item (populated by POST /api/items).
-- Originally migration 0012; placed here in execution order so the column
-- ends up last (matches existing prod ordinal_position 57).
alter table items
  add column created_by uuid references users(id) on delete set null;

create index items_created_by_idx
  on items(created_by, created_at desc) where created_by is not null;


-- ============================================================================
-- INVITE_CODES — beta gate
-- ============================================================================
create table invite_codes (
  code text primary key,

  intended_role user_role not null default 'user',
  intended_is_mod boolean not null default false,
  intended_partner_id text references items(id) on delete set null,
  intended_partner_admin boolean not null default false,

  created_by uuid references users(id) on delete set null,
  used_by uuid references users(id) on delete set null,
  used_at timestamptz,
  expires_at timestamptz,

  created_at timestamptz not null default now()
);

create index invite_codes_used_by_idx on invite_codes(used_by);
create index invite_codes_unused_idx on invite_codes(created_at desc) where used_at is null;


-- ============================================================================
-- DRAFTS — per-author editor drafts
-- ============================================================================
create table drafts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references users(id) on delete cascade,
  item_payload jsonb not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create trigger drafts_set_updated_at
  before update on drafts
  for each row execute function set_updated_at();

create index drafts_author_idx on drafts(author_id, updated_at desc);


-- ============================================================================
-- COMMENTS
-- ============================================================================
create table comments (
  id uuid primary key default gen_random_uuid(),
  item_id text not null references items(id) on delete cascade,
  parent_id uuid references comments(id) on delete cascade,
  author_id uuid not null references users(id) on delete cascade,

  body text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,

  deletion_moderator_id uuid references users(id) on delete set null,
  deletion_reason text,
  deletion_at timestamptz,

  seed boolean not null default false
);

create index comments_item_idx on comments(item_id, created_at);
create index comments_parent_idx on comments(parent_id) where parent_id is not null;
create index comments_author_idx on comments(author_id);


-- ============================================================================
-- COMMENT_REACTIONS
-- ============================================================================
create table comment_reactions (
  comment_id uuid not null references comments(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  kind reaction_kind not null,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index comment_reactions_user_idx on comment_reactions(user_id);


-- ============================================================================
-- SAVED_COMMENTS — per-user saved comments
-- ============================================================================
create table saved_comments (
  user_id    uuid not null references users(id) on delete cascade,
  comment_id uuid not null references comments(id) on delete cascade,
  saved_at   timestamptz not null default now(),
  primary key (user_id, comment_id)
);

create index saved_comments_user_idx on saved_comments(user_id, saved_at desc);


-- ============================================================================
-- USER_SAVES — save-from-feed
-- ============================================================================
create table user_saves (
  user_id uuid not null references users(id) on delete cascade,
  item_id text not null references items(id) on delete cascade,
  saved_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create index user_saves_item_idx on user_saves(item_id);
create index user_saves_user_idx on user_saves(user_id, saved_at desc);


-- ============================================================================
-- POLLS + POLL_VOTES
-- ============================================================================
create table polls (
  id uuid primary key default gen_random_uuid(),
  item_id text unique not null references items(id) on delete cascade,
  kind poll_kind not null,
  prompt text not null,
  choices jsonb not null default '[]'::jsonb,
  multi_choice boolean not null default false,
  closes_at timestamptz,
  created_at timestamptz not null default now()
);

create table poll_votes (
  poll_id uuid not null references polls(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  choice_ids text[] not null check (array_length(choice_ids, 1) >= 1),
  voted_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);


-- ============================================================================
-- FORO_THREADS + FORO_REPLIES
-- ============================================================================
create table foro_threads (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references users(id) on delete cascade,

  subject text not null,
  body text not null,
  image_url text not null,
  genres text[] not null check (array_length(genres, 1) between 1 and 5),

  created_at timestamptz not null default now(),
  bumped_at timestamptz not null default now(),

  deletion_moderator_id uuid references users(id) on delete set null,
  deletion_reason text,
  deletion_at timestamptz,

  archived boolean not null default false,
  seed boolean not null default false
);

create index foro_threads_bumped_idx
  on foro_threads(bumped_at desc)
  where deletion_at is null and archived = false;
create index foro_threads_author_idx on foro_threads(author_id);

create table foro_replies (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references foro_threads(id) on delete cascade,
  author_id uuid not null references users(id) on delete cascade,

  body text not null,
  image_url text,

  created_at timestamptz not null default now(),
  quoted_reply_ids uuid[] not null default '{}',

  deletion_moderator_id uuid references users(id) on delete set null,
  deletion_reason text,
  deletion_at timestamptz
);

create index foro_replies_thread_idx on foro_replies(thread_id, created_at);
create index foro_replies_author_idx on foro_replies(author_id);

-- Bump trigger: a reply lands → parent thread's bumped_at advances → catalog
-- reorders. SECURITY DEFINER so it can update threads regardless of who
-- wrote the reply.
create or replace function private.bump_thread_on_reply()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  update public.foro_threads
    set bumped_at = new.created_at
  where id = new.thread_id;
  return new;
end;
$$;
revoke execute on function private.bump_thread_on_reply() from anon, authenticated;

create trigger foro_replies_bump_parent
  after insert on public.foro_replies
  for each row execute function private.bump_thread_on_reply();


-- ============================================================================
-- HP_EVENTS
-- ============================================================================
create table hp_events (
  id bigserial primary key,
  item_id text not null references items(id) on delete cascade,
  kind text not null,
  weight double precision not null default 1,
  created_at timestamptz not null default now()
);
create index hp_events_window_idx on hp_events(created_at);


-- ============================================================================
-- AUDIT_LOG
-- ============================================================================
create table audit_log (
  id bigserial primary key,
  actor_id uuid references users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_actor_idx on audit_log(actor_id, created_at desc);
create index audit_log_target_idx on audit_log(target_type, target_id);


-- ============================================================================
-- Auth helpers (in private schema)
-- ============================================================================
-- SECURITY DEFINER + STABLE — read users.* without recursing into RLS, and
-- Postgres memoizes within a single query plan. Lives in `private` so it's
-- not exposed as PostgREST RPCs.

create or replace function private.auth_role() returns user_role
language sql stable security definer set search_path = public, auth as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function private.auth_is_admin() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select coalesce((select role = 'admin' from public.users where id = auth.uid()), false);
$$;

create or replace function private.auth_is_guide_or_admin() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select coalesce(
    (select role in ('guide', 'admin') from public.users where id = auth.uid()),
    false
  );
$$;

create or replace function private.auth_is_mod_or_admin() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select coalesce(
    (select role = 'admin' or is_mod from public.users where id = auth.uid()),
    false
  );
$$;

create or replace function private.auth_is_authoring_role() returns boolean
language sql stable security definer set search_path = public, auth as $$
  -- curator (lists/polls), guide (staff editorial), insider (own items only),
  -- admin (everything). RLS rules layer on top; this is the broad gate.
  select coalesce(
    (select role in ('curator', 'guide', 'insider', 'admin') from public.users where id = auth.uid()),
    false
  );
$$;

grant execute on function private.auth_role()              to anon, authenticated, service_role;
grant execute on function private.auth_is_admin()          to anon, authenticated, service_role;
grant execute on function private.auth_is_guide_or_admin() to anon, authenticated, service_role;
grant execute on function private.auth_is_mod_or_admin()   to anon, authenticated, service_role;
grant execute on function private.auth_is_authoring_role() to anon, authenticated, service_role;


-- ============================================================================
-- Auth signup trigger
-- ============================================================================
-- Reads invite_code + username from raw_user_meta_data; applies the carried
-- role/partner fields to a new public.users row in the same transaction.
-- Failures (bad code, expired, taken username) roll the whole signup back.
-- Seed users (raw_user_meta_data.seed = true, set by scripts/seed.ts) bypass
-- the invite-code path — public.users rows are inserted directly via service
-- role.

create or replace function public.handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = public, auth as $$
declare
  v_invite_code text;
  v_username text;
  v_invite invite_codes%rowtype;
begin
  if coalesce((new.raw_user_meta_data->>'seed')::boolean, false) then
    return new;
  end if;

  v_invite_code := new.raw_user_meta_data->>'invite_code';
  v_username    := new.raw_user_meta_data->>'username';

  if v_invite_code is null then
    raise exception 'signup requires invite_code in user_metadata';
  end if;
  if v_username is null or length(v_username) < 3 then
    raise exception 'signup requires username (min 3 chars) in user_metadata';
  end if;

  select * into v_invite from invite_codes where code = v_invite_code for update;

  if not found then
    raise exception 'invalid invite code';
  end if;
  if v_invite.used_at is not null then
    raise exception 'invite code already used';
  end if;
  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    raise exception 'invite code expired';
  end if;

  insert into public.users (
    id, username, display_name, role, is_mod, partner_id, partner_admin
  ) values (
    new.id,
    v_username,
    v_username,
    v_invite.intended_role,
    v_invite.intended_is_mod,
    v_invite.intended_partner_id,
    v_invite.intended_partner_admin
  );

  update invite_codes
  set used_by = new.id, used_at = now()
  where code = v_invite_code;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();


-- ============================================================================
-- Grants — table privileges for the API roles
-- ============================================================================
-- We picked "auto-expose new tables OFF" at project creation. New tables
-- need explicit grants. RLS (in 0002_rls.sql) narrows row-level access on
-- top of these table-level grants.

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete
  on all tables in schema public
  to anon, authenticated;

grant all privileges on all tables in schema public to service_role;

grant usage, select on all sequences in schema public to anon, authenticated;
grant all privileges on all sequences in schema public to service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;

alter default privileges in schema public
  grant all on tables to service_role;

alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated;

alter default privileges in schema public
  grant all on sequences to service_role;


-- ============================================================================
-- Enable RLS on every table — strict-by-default
-- ============================================================================
-- Without 0002_rls.sql granting policies, these tables are unreadable and
-- unwritable through the API for everyone except the service role.
alter table items              enable row level security;
alter table users              enable row level security;
alter table invite_codes       enable row level security;
alter table drafts             enable row level security;
alter table comments           enable row level security;
alter table comment_reactions  enable row level security;
alter table saved_comments     enable row level security;
alter table user_saves         enable row level security;
alter table polls              enable row level security;
alter table poll_votes         enable row level security;
alter table foro_threads       enable row level security;
alter table foro_replies       enable row level security;
alter table hp_events          enable row level security;
alter table audit_log          enable row level security;
