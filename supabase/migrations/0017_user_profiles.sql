-- 0017_user_profiles.sql
-- Public-profile fields on the users table — first slice of the user-HP /
-- profile arc. Pure additive columns; no RLS changes needed because:
--
--   * users_public_read already permits anyone to SELECT any row, which is
--     exactly what the new /u/[username] route needs.
--   * users_self_update pins only role / is_mod / is_og / partner_id /
--     partner_admin via the with-check clause. New columns are unlisted, so
--     a user can self-update them under their own auth.uid().
--
-- Avatar storage reuses the existing `uploads` bucket (migration 0003) —
-- its self-write RLS keys on the first folder segment matching auth.uid(),
-- which works for `<uid>/avatar-*.jpg` paths exactly as it does for any
-- other image upload. No new bucket needed.

alter table users
  add column if not exists avatar_url text,
  add column if not exists bio text,
  add column if not exists firma text,
  add column if not exists location text;

comment on column users.avatar_url is
  'Public URL of the user''s avatar image, served from the uploads bucket. Null = default avatar.';
comment on column users.bio is
  'Free-text user bio shown on /u/[username]. Plain text, no markdown.';
comment on column users.firma is
  'Editorial sign-off line appended to long-form authored content.';
comment on column users.location is
  'User-supplied location string (city / zona). Free-text — no enum, no geocoding.';
