-- ============================================================================
-- 0045_foro_custom_tags — user-created tags for the foro composer
-- ============================================================================
--
-- The foro composer requires 1–5 tags on a new thread but until now could
-- only offer the static catalog in `lib/genres.ts` (TAGS). If a user's topic
-- wasn't covered, they simply could not post. This table is the growable
-- half of that catalog: the composer unions it with the static list, and
-- creating a tag from the composer inserts a row here so it shows up for
-- everyone from then on.
--
-- `id` is the slug the thread rows actually store (foro_threads.tags is a
-- plain text[] with no FK — this table is a *name registry*, not a
-- constraint). That means a tag missing from this table still renders, just
-- with a slug-derived label.
--
-- PENDING APPLY: run `npx supabase db push` (lead dev / Johan).

create table if not exists foro_tags (
  id         text primary key,
  name       text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Slug shape mirrors lib/genres.ts `slugifyTag`.
alter table foro_tags
  drop constraint if exists foro_tags_id_slug;
alter table foro_tags
  add constraint foro_tags_id_slug
  check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(id) <= 40);

alter table foro_tags
  drop constraint if exists foro_tags_name_len;
alter table foro_tags
  add constraint foro_tags_name_len
  check (length(btrim(name)) between 1 and 40);

alter table foro_tags enable row level security;

-- Anyone (including logged-out readers) can read the registry — it's needed
-- to render tag labels on public threads.
drop policy if exists foro_tags_public_read on foro_tags;
create policy foro_tags_public_read
  on foro_tags for select
  using (true);

-- Any authenticated user may add a tag, and must own the row they create.
drop policy if exists foro_tags_authenticated_insert on foro_tags;
create policy foro_tags_authenticated_insert
  on foro_tags for insert
  to authenticated
  with check (created_by = auth.uid());

-- No update/delete policies: tags are append-only from the client. Curation
-- (renaming/removing) happens through the service role.

create index if not exists foro_tags_created_at_idx on foro_tags (created_at desc);
