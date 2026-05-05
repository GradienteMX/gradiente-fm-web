-- 0009_partner_kind_dealer.sql
-- Add 'dealer' to the partner_kind enum.
-- Use case: record/equipment dealers who sell on the marketplace but aren't
-- labels or venues — distinct enough from `sponsored` to deserve its own
-- label and color.
--
-- ALTER TYPE ... ADD VALUE is non-transactional in Postgres; this is a
-- single-statement migration so the standard CLI flow works fine.

alter type partner_kind add value if not exists 'dealer';
