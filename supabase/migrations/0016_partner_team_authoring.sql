-- 0016_partner_team_authoring.sql
-- Partner-team content authoring RLS.
--
-- The existing `items_staff_insert` / `items_staff_update` policies gate
-- writes to the items table behind guide/admin role. This migration adds
-- two parallel policies that let approved partner-team members publish
-- scene-voice content (evento / mix / noticia / opinion / listicle) for
-- their own partner, without needing guide tier.
--
-- Trust model — partner-team membership IS the publishing approval (admin
-- already vetted the org at partner-row creation time). The marketplace_enabled
-- flag is a SEPARATE capability for listing sales and does NOT gate content
-- publishing. See wiki/90-Decisions/Partner Authoring.md.
--
-- INSERT — allow partner team member to publish content for their own
-- partner, scoped to the 5 scene-voice content types, with source stamped
-- as 'manual:partner'.

create policy items_partner_team_insert on items
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and source = 'manual:partner'
    and type in ('evento', 'mix', 'noticia', 'opinion', 'listicle')
    and exists (
      select 1 from public.users
       where id = auth.uid()
         and partner_id = items.partner_id
    )
  );

-- UPDATE — partner team members can re-publish edits to their own partner's
-- content. Same scope as insert. USING gates which rows the user can target;
-- WITH CHECK gates what the row looks like after the update. Both required
-- so a team member can't (a) edit a different partner's row or (b) re-target
-- a row to a partner they don't belong to.

create policy items_partner_team_update on items
  for update
  to authenticated
  using (
    source = 'manual:partner'
    and exists (
      select 1 from public.users
       where id = auth.uid()
         and partner_id = items.partner_id
    )
  )
  with check (
    source = 'manual:partner'
    and type in ('evento', 'mix', 'noticia', 'opinion', 'listicle')
    and exists (
      select 1 from public.users
       where id = auth.uid()
         and partner_id = items.partner_id
    )
  );
