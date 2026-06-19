-- 0028_invite_card_identity.sql
-- Invitación-3D integration · Track A (data spine).
--
-- Adds the invitee-identity fields the invitación-3d card prints, plus an
-- anon-safe read path so /welcome can resolve a ?codigo= into card data.
--
-- HOW TO APPLY: paste into the Supabase SQL editor and run. Do NOT
-- `supabase db push` — the recorded migration history drifts from the live DB
-- (history stops ~0016, the DB is past 0027); this file is applied by hand.

begin;

-- 1 · Invitee-identity columns on the CODE.
--     The code is minted before any user exists, so these live on invite_codes,
--     not on users. (`name` is card-only per product decision — it is NOT copied
--     into users.display_name at signup.)
alter table public.invite_codes
  add column if not exists card_name         text,
  add column if not exists folio             integer,
  add column if not exists folio_denominator integer not null default 150,
  add column if not exists issued_label      text;

comment on column public.invite_codes.card_name is
  'Display name printed on the invitación-3d card (admin-typed). Card-only; not copied to users.display_name.';
comment on column public.invite_codes.folio is
  'Beta member number (NNN). Set explicitly at mint / bulk-import; NULL for non-cohort codes.';
comment on column public.invite_codes.folio_denominator is
  'Denominator printed after the folio (NNN/150).';
comment on column public.invite_codes.issued_label is
  'Frozen "issued" label printed on the card (e.g. JUN 2026). Falls back to created_at when null.';

-- Folio is unique among codes that have one. Partial index leaves the 38
-- pre-existing codes (folio NULL) untouched and lets the roster import own 1..N.
create unique index if not exists invite_codes_folio_uidx
  on public.invite_codes (folio) where folio is not null;

-- 2 · Anon-safe peek.
--     invite_codes is admin-only (RLS), but a logged-out invitee on /welcome must
--     resolve their code into the card's display data. This SECURITY DEFINER
--     function returns ONLY what the card prints — never created_by/used_by or any
--     other code. The code string itself is the secret and is already in the URL,
--     so nothing new leaks. (Mild "is this code valid" oracle; gate with
--     captcha-after-N later if abuse appears, per the anti-spam posture.)
create or replace function public.peek_invite_card(p_code text)
returns table (
  card_name         text,
  role              public.user_role,
  folio             integer,
  folio_denominator integer,
  issued_label      text,
  issued_at         timestamptz,
  partner_title     text,
  partner_logo_url  text,
  status            text
)
language sql
security definer
set search_path = public
as $$
  select
    ic.card_name,
    ic.intended_role,
    ic.folio,
    ic.folio_denominator,
    ic.issued_label,
    ic.created_at,
    p.title,
    p.image_url,
    case
      when ic.used_at is not null then 'used'
      when ic.expires_at is not null and ic.expires_at < now() then 'expired'
      else 'active'
    end
  from public.invite_codes ic
  left join public.items p
    on p.id = ic.intended_partner_id and p.type = 'partner'
  where ic.code = p_code;
$$;

-- anon = the logged-out invitee on /welcome; authenticated = covers edge cases.
-- Nobody gains read access to the invite_codes table itself.
grant execute on function public.peek_invite_card(text) to anon, authenticated;

commit;
