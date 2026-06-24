-- 0036_scraped_event_vibe_seed.sql
-- Adds provisional vibe seeding to the scraped-event ingest. Until now every
-- scraped event landed at a flat neutral vibe 5/5, which made the vibe-spectrum
-- filter useless across the whole agenda. The route now derives a stereotype
-- vibe band from the event's (mapped) genres (lib/scrapedGenres.ts) and passes
-- it in via the two new params below.
--
-- Guardrail (Vibe Philosophy): vibe stays editor/crowd-owned. The seed only
-- applies while a row is still UNGRADED — on conflict we re-seed vibe ONLY when
-- the existing band is the untouched default 5/5; any editor-set band is
-- preserved exactly as before. (Crowd Vibe Check medians override at read time
-- regardless.) Everything else about the function is unchanged from 0026.
--
-- Signature change: the two new params are appended with defaults of 5, so a
-- caller that omits them (e.g. an older deploy mid-rollout) behaves exactly as
-- the 0026 version did. We DROP the old 17-arg signature first so only one
-- overload exists and PostgREST never has to disambiguate.

drop function if exists ingest_scraped_event(
  text, text, text, text, text, text, text, text,
  timestamptz, timestamptz, text, text, text[], text, text, text, text[]
);

create or replace function ingest_scraped_event(
  p_source       text,
  p_external_id  text,
  p_partner_id   text,
  p_id           text,
  p_slug         text,
  p_title        text,
  p_subtitle     text,
  p_excerpt      text,
  p_date         timestamptz,
  p_end_date     timestamptz,
  p_venue        text,
  p_venue_city   text,
  p_artists      text[],
  p_ticket_url   text,
  p_price        text,
  p_image_url    text,
  p_genres       text[],
  p_vibe_min     int default 5,
  p_vibe_max     int default 5
) returns jsonb
language plpgsql security definer set search_path = 'public'
as $$
declare
  caller uuid;
  caller_role text;
  caller_partner text;
  result_id text;
  v_min int;
  v_max int;
begin
  caller := auth.uid();
  if caller is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;
  if p_source not in ('scraper:ra', 'scraper:instagram') then
    return jsonb_build_object('ok', false, 'error', 'bad_source');
  end if;
  if p_external_id is null or length(p_external_id) = 0 then
    return jsonb_build_object('ok', false, 'error', 'external_id_required');
  end if;

  -- Clamp + order the incoming seed defensively (DB constraint requires
  -- 0 <= vibe_min <= vibe_max <= 10).
  v_min := greatest(0, least(10, coalesce(p_vibe_min, 5)));
  v_max := greatest(0, least(10, coalesce(p_vibe_max, 5)));
  if v_min > v_max then
    v_min := least(v_min, v_max);
    v_max := greatest(v_min, v_max);
  end if;

  select role::text, partner_id into caller_role, caller_partner
  from users where id = caller;

  -- Partner-team members: Instagram-only, own partner only. Admins: anything.
  if coalesce(caller_role, '') <> 'admin' then
    if p_source <> 'scraper:instagram'
       or p_partner_id is null
       or caller_partner is distinct from p_partner_id then
      return jsonb_build_object('ok', false, 'error', 'forbidden');
    end if;
  end if;

  insert into items (
    id, slug, type, title, subtitle, excerpt,
    vibe_min, vibe_max,
    date, end_date, venue, venue_city, artists, ticket_url, price, image_url,
    genres, source, external_id, partner_id,
    published, editorial, elevated, published_at
  ) values (
    p_id, p_slug, 'evento', p_title, nullif(p_subtitle, ''), nullif(p_excerpt, ''),
    v_min, v_max,
    p_date, p_end_date, nullif(p_venue, ''), nullif(p_venue_city, ''),
    coalesce(p_artists, '{}'), nullif(p_ticket_url, ''), nullif(p_price, ''), nullif(p_image_url, ''),
    coalesce(p_genres, '{}'), p_source::content_source, p_external_id, p_partner_id,
    (p_source = 'scraper:ra'), false, false, now()  -- RA live; Instagram pending
  )
  on conflict (source, external_id) do update set
    title       = excluded.title,
    subtitle    = excluded.subtitle,
    excerpt     = excluded.excerpt,
    date        = excluded.date,
    end_date    = excluded.end_date,
    venue       = excluded.venue,
    venue_city  = excluded.venue_city,
    artists     = excluded.artists,
    ticket_url  = excluded.ticket_url,
    price       = excluded.price,
    image_url   = excluded.image_url,
    genres      = excluded.genres,
    -- Re-seed vibe ONLY while the row is still the untouched default (5/5).
    -- A graded band (anything other than 5/5) is editor-owned → preserved.
    vibe_min    = case when items.vibe_min = 5 and items.vibe_max = 5 then excluded.vibe_min else items.vibe_min end,
    vibe_max    = case when items.vibe_min = 5 and items.vibe_max = 5 then excluded.vibe_max else items.vibe_max end,
    partner_id  = coalesce(items.partner_id, excluded.partner_id),
    updated_at  = now()
  returning id into result_id;

  return jsonb_build_object('ok', true, 'id', result_id);
end;
$$;

grant execute on function ingest_scraped_event(
  text, text, text, text, text, text, text, text,
  timestamptz, timestamptz, text, text, text[], text, text, text, text[], int, int
) to authenticated;

comment on function ingest_scraped_event(text, text, text, text, text, text, text, text, timestamptz, timestamptz, text, text, text[], text, text, text, text[], int, int) is
  'Idempotent ingest for scraped events. Dedups on (source, external_id). RA → published=true; Instagram → published=false (partner-reviewed). Seeds a provisional vibe band (p_vibe_min/p_vibe_max, default 5/5) on insert; on conflict refreshes source-of-truth fields + re-seeds vibe ONLY while still ungraded (5/5), preserving any editor-set band and all other editor-owned columns. Authz: admin any source; partner-team Instagram-only for own partner. See wiki/70-Roadmap/Scraper Pipeline.md.';
