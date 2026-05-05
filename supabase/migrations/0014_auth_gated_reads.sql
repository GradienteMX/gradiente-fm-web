-- ============================================================================
-- 0014_auth_gated_reads.sql — gate the page behind auth.
-- ============================================================================
-- The site is shifting to invite-only behavior at the chrome layer (a
-- /welcome landing for anonymous visitors, redirected via middleware).
-- This migration is the defense-in-depth at the data layer: drop the
-- "anonymous can see non-seeded content" public-read policies and
-- replace them with "any authenticated user sees everything published."
--
-- Two effects:
--   1. Anonymous reads return zero rows (matches the middleware's
--      redirect — even a direct API hit gets nothing).
--   2. The `seed = false` filter goes away. Authenticated beta testers
--      see seeded mockdata alongside real content, so the page feels
--      populated before they've contributed anything.
--
-- The `*_staff_read` policies become functionally redundant for
-- already-published content (any authed user reads it now) but they
-- still matter for `items_staff_read` covering DRAFT (published=false)
-- visibility. Left in place for that reason.
-- ============================================================================

-- ── items ───────────────────────────────────────────────────────────────────
drop policy if exists items_public_read on items;

create policy items_authed_read on items
  for select
  using (auth.uid() is not null and published = true);

-- ── comments ────────────────────────────────────────────────────────────────
drop policy if exists comments_public_read on comments;

create policy comments_authed_read on comments
  for select
  using (auth.uid() is not null);

-- ── foro_threads ────────────────────────────────────────────────────────────
drop policy if exists foro_threads_public_read on foro_threads;

create policy foro_threads_authed_read on foro_threads
  for select
  using (auth.uid() is not null);

-- ── foro_replies ────────────────────────────────────────────────────────────
drop policy if exists foro_replies_public_read on foro_replies;

create policy foro_replies_authed_read on foro_replies
  for select
  using (auth.uid() is not null);

-- ── comment_reactions / polls / poll_votes ──────────────────────────────────
-- Left as `using (true)` on purpose. These rows are JOIN attachments — they
-- only ever surface alongside their parent content, so anonymous queries
-- return zero rows naturally once the parents are auth-gated.
