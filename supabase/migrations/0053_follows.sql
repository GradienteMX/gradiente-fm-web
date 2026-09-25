-- ============================================================================
-- 0053 — FRANJA FOLLOWS («SEGUIR»)
--
-- A member follows a franja so its news shapes THEIR Taller (the «Siguiendo»
-- shelf in COLECCIÓN). Private by design: nobody sees who follows whom, and
-- no count exists anywhere — not on the franja's page, not in /central. The
-- rows are read only by their owner (the private overlay, lib/data/world.ts)
-- and written only through app/api/follows/[franjaId] (POST follows, DELETE
-- stops), cloned from the saves routes.
--
-- Production kept follows per device in localStorage
-- (main:lib/dashboard/localState.ts, «UPGRADE PATH»); this is the table that
-- note anticipated, pointed at franjas (items of type 'franja') rather than
-- the entities registry, because franjas are items.
--
-- Until this is applied the route answers 503 («todavía no está disponible»)
-- and the private overlay reads an empty list — the site keeps working.
--
-- Apply via the Supabase SQL editor — NEVER `supabase db push`
-- (migration-history drift; see wiki + memory). Idempotent.
-- ============================================================================

create table if not exists public.franja_follows (
  user_id    uuid not null references public.users(id) on delete cascade,
  -- an items row of type 'franja' (checked by the trigger below)
  franja_id  text not null references public.items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, franja_id)
);

-- A franja's page never asks «who follows me» — only the follower reads
-- their own rows (the PK serves that). This index is for the cascade when a
-- franja is deleted.
create index if not exists franja_follows_franja_idx on public.franja_follows (franja_id);

comment on table public.franja_follows is
  'Franjas a member follows. Private: RLS self-only, never counted or shown to anyone else. Written through /api/follows/[franjaId] (0053).';

-- The target must be a franja row. A trigger (not a CHECK) because the rule
-- reads another table — same shape as item_franjas (0051).
create or replace function private.franja_follows_target_is_franja()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from items i where i.id = new.franja_id and i.type = 'franja') then
    raise exception 'franja_follows.franja_id % is not a franja', new.franja_id
      using errcode = '23503';
  end if;
  return new;
end;
$$;

drop trigger if exists franja_follows_target_check on public.franja_follows;
create trigger franja_follows_target_check
  before insert or update on public.franja_follows
  for each row execute function private.franja_follows_target_is_franja();

-- ============================================================================
-- RLS — self-only, like user_saves (user_saves_self_only).
-- ============================================================================

alter table public.franja_follows enable row level security;

drop policy if exists franja_follows_self_only on public.franja_follows;
create policy franja_follows_self_only on public.franja_follows
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
