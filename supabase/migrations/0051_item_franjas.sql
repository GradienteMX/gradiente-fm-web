-- 0051_item_franjas.sql
-- ============================================================================
-- Franja subject links + owner-writable scene links.
--
--   §1 item_franjas — "this piece is ABOUT these franjas". A join table in the
--      exact shape of item_entities (0029), pointing at items rows of
--      type='franja'. Distinct from items.franja_id, which is AUTHORSHIP
--      attribution (//PRESENTA). A review can now be linked to the label
--      franja it discusses without the label having written it.
--   §2 private.auth_can_link_item(item_id) — who may attach links to an item:
--      staff, the item's own author, or a team member of the item's franja.
--      SECURITY DEFINER so the items lookup is not itself filtered by items RLS.
--   §3 item_entities write policy re-pointed at §2. Until now only
--      guide/admin could write item_entities, so a curator/insider publishing
--      their own piece had every artist/label link silently dropped (the
--      publish route treats link sync as non-fatal). Owners can link now.
--
-- APPLY BY HAND: paste this file into the Supabase SQL editor and run. Never
-- `supabase db push` (prod schema_migrations stops at 0016 — see
-- wiki/Next Session.md). Idempotent; safe as one transaction.
-- ============================================================================

-- ── §1 item_franjas ──────────────────────────────────────────────────────────
create table if not exists item_franjas (
  item_id    text not null references items(id) on delete cascade,
  franja_id  text not null references items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (item_id, franja_id),
  constraint item_franjas_not_self check (item_id <> franja_id)
);

create index if not exists item_franjas_franja_idx on item_franjas(franja_id);
create index if not exists item_franjas_item_idx   on item_franjas(item_id);

comment on table item_franjas is
  'Subject links: the franjas a content item is about. Authorship attribution '
  'lives on items.franja_id instead.';

-- The target must be a franja row. A trigger (not a CHECK) because the rule
-- reads another table.
create or replace function private.item_franjas_target_is_franja()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from items i where i.id = new.franja_id and i.type = 'franja') then
    raise exception 'item_franjas.franja_id % is not a franja', new.franja_id
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists item_franjas_target_check on item_franjas;
create trigger item_franjas_target_check
  before insert or update on item_franjas
  for each row execute function private.item_franjas_target_is_franja();

-- ── §2 who may link ──────────────────────────────────────────────────────────
create or replace function private.auth_can_link_item(p_item_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.auth_is_guide_or_admin()
      or exists (
        select 1
          from items i
         where i.id = p_item_id
           and (
             i.created_by = (select auth.uid())
             or (
               i.franja_id is not null
               and i.franja_id = (select u.franja_id from users u where u.id = (select auth.uid()))
             )
           )
      );
$$;

grant execute on function private.auth_can_link_item(text) to anon, authenticated, service_role;

alter table item_franjas enable row level security;

drop policy if exists item_franjas_authed_read on item_franjas;
create policy item_franjas_authed_read on item_franjas
  for select
  using ((select auth.uid()) is not null);

drop policy if exists item_franjas_owner_write on item_franjas;
create policy item_franjas_owner_write on item_franjas
  for all
  to authenticated
  using (private.auth_can_link_item(item_id))
  with check (private.auth_can_link_item(item_id));

-- ── §3 item_entities: owners can link too ────────────────────────────────────
drop policy if exists item_entities_author_write on item_entities;
create policy item_entities_author_write on item_entities
  for all
  to authenticated
  using (private.auth_can_link_item(item_id))
  with check (private.auth_can_link_item(item_id));
