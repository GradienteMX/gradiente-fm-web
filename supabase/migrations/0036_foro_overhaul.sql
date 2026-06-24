-- ============================================================================
-- 0036_foro_overhaul — multi-image threads + metadata tags
-- ============================================================================
--
-- Foro overhaul, schema layer. Two additive columns on foro_threads:
--
--   image_urls text[]  — the full ordered gallery for a thread. image_urls[1]
--                        is the cover (= the existing image_url, kept for
--                        back-compat with the catalog tile + cheap reads).
--                        Backfilled from image_url for existing rows so every
--                        thread has a non-empty gallery.
--
--   tags text[]        — transversal metadata keywords (lib/genres.ts TAGS),
--                        separate from the genre axis. The composer now
--                        requires at least one; we DON'T add a min check
--                        constraint because existing seed rows have none —
--                        the minimum is enforced at the API + UI layer. We
--                        cap the maximum at 5 to match the genre cap.
--
-- Replies keep their single optional image_url unchanged (per product call:
-- one image/gif per comment).
--
-- PENDING APPLY: run `npx supabase db push` (lead dev / Johan).

alter table foro_threads
  add column if not exists image_urls text[] not null default '{}',
  add column if not exists tags       text[] not null default '{}';

-- Cap tags at 5 (genre-parity). Null/empty arrays pass — the API enforces the
-- minimum of 1 on new inserts; old rows stay valid.
alter table foro_threads
  drop constraint if exists foro_threads_tags_max;
alter table foro_threads
  add constraint foro_threads_tags_max
  check (array_length(tags, 1) is null or array_length(tags, 1) <= 5);

-- Backfill the gallery from the legacy single cover so existing threads
-- render under the new array-based reader.
update foro_threads
  set image_urls = array[image_url]
  where (image_urls is null or array_length(image_urls, 1) is null)
    and image_url is not null;
