-- 0027_update_partner_event.sql
-- Edit a PENDING partner Instagram event before publishing it — the BORRADORES
-- "EDITAR" surface. Mirrors publish_partner_event's authz (migration 0026):
-- SECURITY DEFINER so ANY team member of the event's partner can fix the
-- agent-extracted data (title/date/venue/artists/price/excerpt) AND set the
-- fields the scraper can't infer (vibe range, genres) before going live.
--
-- Scoped tight: PENDING only (published=false) and Instagram only
-- (source='scraper:instagram'), so it can never touch a live or editorial item,
-- and it leaves `source` untouched → the (source, external_id) dedup key stays
-- stable across future re-scrapes (same guarantee publish_partner_event keeps).

create or replace function update_partner_event(
  p_item_id     text,
  p_title       text,
  p_subtitle    text,
  p_excerpt     text,
  p_date        timestamptz,
  p_end_date    timestamptz,
  p_venue       text,
  p_venue_city  text,
  p_artists     text[],
  p_ticket_url  text,
  p_price       text,
  p_image_url   text,
  p_genres      text[],
  p_vibe_min    int,
  p_vibe_max    int
) returns jsonb
language plpgsql security definer set search_path = 'public'
as $$
declare
  caller uuid;
  rec record;
  v_min int;
  v_max int;
begin
  caller := auth.uid();
  if caller is null then return jsonb_build_object('ok', false, 'error', 'unauthorized'); end if;
  if p_title is null or length(btrim(p_title)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'title_required');
  end if;
  if p_date is null then
    return jsonb_build_object('ok', false, 'error', 'date_required');
  end if;

  select id, partner_id, published, source into rec from items where id = p_item_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if rec.partner_id is null
     or not exists (select 1 from public.users where id = caller and partner_id = rec.partner_id) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if rec.published then return jsonb_build_object('ok', false, 'error', 'already_published'); end if;
  if rec.source is distinct from 'scraper:instagram' then
    return jsonb_build_object('ok', false, 'error', 'not_a_draft');
  end if;

  -- clamp vibe into 0..10, keep min <= max
  v_min := greatest(0, least(10, coalesce(p_vibe_min, 5)));
  v_max := greatest(0, least(10, coalesce(p_vibe_max, 5)));
  if v_min > v_max then v_min := v_max; end if;

  update items set
    title      = btrim(p_title),
    subtitle   = nullif(btrim(coalesce(p_subtitle, '')), ''),
    excerpt    = nullif(btrim(coalesce(p_excerpt, '')), ''),
    date       = p_date,
    end_date   = p_end_date,
    venue      = nullif(btrim(coalesce(p_venue, '')), ''),
    venue_city = nullif(btrim(coalesce(p_venue_city, '')), ''),
    artists    = coalesce(p_artists, '{}'),
    ticket_url = nullif(btrim(coalesce(p_ticket_url, '')), ''),
    price      = nullif(btrim(coalesce(p_price, '')), ''),
    image_url  = nullif(btrim(coalesce(p_image_url, '')), ''),
    genres     = coalesce(p_genres, '{}'),
    vibe_min   = v_min,
    vibe_max   = v_max,
    updated_at = now()
  where id = p_item_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function update_partner_event(
  text, text, text, text, timestamptz, timestamptz, text, text, text[], text, text, text, text[], int, int
) to authenticated;

comment on function update_partner_event(text, text, text, text, timestamptz, timestamptz, text, text, text[], text, text, text, text[], int, int) is
  'Edit a pending partner Instagram event (BORRADORES). SECURITY DEFINER: any team member of the event partner may fix agent-extracted data + set vibe/genres before publishing. Pending + scraper:instagram only; source unchanged so the (source, external_id) dedup key is preserved.';
