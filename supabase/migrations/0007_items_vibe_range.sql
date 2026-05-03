-- 0007_items_vibe_range.sql
-- Replace items.vibe (single smallint) with vibe_min + vibe_max so content can express ranges.
-- Existing rows backfill cleanly: vibe_min = vibe_max = old vibe.
-- Filter overlap test (in lib/utils.ts) replaces point-in-range.

alter table items add column vibe_min smallint check (vibe_min between 0 and 10);
alter table items add column vibe_max smallint check (vibe_max between 0 and 10);

update items set vibe_min = vibe, vibe_max = vibe;

alter table items alter column vibe_min set not null;
alter table items alter column vibe_max set not null;

alter table items add constraint items_vibe_range_check check (vibe_min <= vibe_max);

alter table items drop column vibe;
