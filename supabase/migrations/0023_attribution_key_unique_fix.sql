-- 0023_attribution_key_unique_fix.sql
-- Fix the latent ON CONFLICT inference bug across the user-HP system.
--
-- Background: migration 0018 created `user_hp_events_attribution_key_idx`
-- as a PARTIAL unique index (`where attribution_key is not null`).
-- Postgres won't infer a partial unique index from a bare
-- `on conflict (attribution_key)` clause — the inferrer requires the
-- conflict spec to carry the same WHERE predicate as the index.
--
-- Eight functions across 0018/0019/0020/0021/0022 use the bare clause:
--   emit_user_hp_on_reaction / _comment_save / _item_save /
--   _comment_post / _vibe_check / _publish
--   apply_vibe_check_bonuses
--   harvest_item
--
-- All were silently latent until the harvest path actually hit a
-- conflict (or, in harvest_item's case, planned the first call).
-- Discovered 2026-05-24.
--
-- Two ways to fix: (1) rewrite all 8 functions to add `where
-- attribution_key is not null`, or (2) replace the partial index
-- with a non-partial one. Option 2 is one migration, zero function
-- changes, and a unique index over a nullable column treats each
-- NULL as distinct by default — so the semantics match the old
-- partial index exactly. Going with 2.

drop index if exists user_hp_events_attribution_key_idx;

create unique index user_hp_events_attribution_key_idx
  on user_hp_events(attribution_key);

comment on index user_hp_events_attribution_key_idx is
  'Unique on attribution_key (NULLs distinct). Replaces the partial index from 0018 — the partial form broke ON CONFLICT inference. NULL rows are still allowed in any number; only non-null keys are deduped.';
