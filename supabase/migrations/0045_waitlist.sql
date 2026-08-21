-- ============================================================================
-- 0045 — WAITLIST
--
-- Public signup queue for the viral-campaign landing (/espera). Visitors who
-- arrive without an invite code leave alias + email + segmentation fields;
-- admins later convert entries into invite_codes rows from the /admin
-- //ESPERA tab (one code per entry, deep-linked as /welcome?codigo=INV-…),
-- which funnels them into the EXISTING invite pipeline — the waitlist never
-- touches auth.users directly.
--
-- Status model: 'pending' → 'invited' (code minted). "Registered" is NOT a
-- stored status — it is derived by joining invite_codes.used_at through the
-- invite_code FK, so the signup trigger stays untouched and there is no
-- second write path to keep in sync.
--
-- Apply via the Supabase SQL editor — NEVER `supabase db push`
-- (migration-history drift; see wiki + memory).
-- ============================================================================

create table if not exists public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),

  -- Normalized to lowercase by the API route before insert, so the plain
  -- unique constraint is effectively case-insensitive AND `on conflict`
  -- inference keeps working (a lower(email) expression index would also
  -- work, but a partial index would not — see partial-index/ON CONFLICT
  -- gotcha from the folio work).
  email text not null unique,

  -- Display alias from the form ("01_ ALIAS / IDENTIFICADOR"). Not a slug —
  -- the real username is chosen at signup when the code is redeemed. Reused
  -- as invite_codes.card_name when the code is minted.
  alias text not null default '',

  -- Segmentation selects ("03_ CIUDAD / ZONA", "04_ ¿CÓMO NOS ENCONTRASTE?").
  -- Free text at the schema layer; the API route allowlists values so these
  -- stay aggregatable without a migration every time the form options change.
  city text,
  source text,

  status text not null default 'pending'
    check (status in ('pending', 'invited')),

  -- Set when an admin mints a code for this entry.
  invite_code text references public.invite_codes(code) on delete set null,
  invited_at timestamptz,

  created_at timestamptz not null default now()
);

-- Queue reads (admin tab orders by created_at; stats count by status).
create index if not exists waitlist_signups_status_idx
  on public.waitlist_signups (status, created_at);

-- ============================================================================
-- RLS — admin-only through the caller's session (mirrors invite_codes).
-- The public /api/waitlist route writes with the service-role client, which
-- bypasses RLS; anon/authenticated get NO direct access to the table.
-- ============================================================================

alter table public.waitlist_signups enable row level security;

create policy waitlist_signups_admin_all on public.waitlist_signups
  for all
  using (private.auth_is_admin())
  with check (private.auth_is_admin());
