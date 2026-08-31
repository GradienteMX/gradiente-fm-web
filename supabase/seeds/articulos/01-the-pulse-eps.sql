-- ============================================================================
-- 01-the-pulse-eps.sql
-- Artículo (no listicle) · "The Pulse EPs"
-- Sin firma (house-voice). Tono seco, factual, sin voz editorial de listicle.
-- Fuentes: Wikipedia (Pulse 2 EP), Discogs (master 2159275 + las 4 EPs
-- originales), Boomkat.
--
-- Re-ejecutable: on conflict (id) do update.
-- ============================================================================

insert into items (
  id, slug, type,
  title, subtitle, excerpt,
  vibe_min, vibe_max,
  genres, tags,
  links,
  image_url,
  published_at, date, expires_at,
  source,
  author, read_time, editorial, pinned,
  body_preview, hero_caption, article_body,
  published, seed
) values (
  'ar-the-pulse-eps',
  'the-pulse-eps',
  'articulo',

  'The Pulse EPs',
  'Cuatro EPs de Jumpin'' & Pumpin'', 1991-1992, todos acreditados a alias distintos del mismo dúo',
  'Entre 1991 y 1992, Brian Dougans y Garry Cobain publicaron cuatro EPs en Jumpin'' & Pumpin'' bajo la serie Pulse. Cada uno aparece firmado por un alias distinto: Indo Tribe, Smart Systems, Yage, Mental Cube y The Future Sound of London. En 2008 el sello reeditó una selección de las cuatro en un solo CD.',

  5, 9,

  array['techno-bleep','breakbeat','hardcore-techno','idm','ambient','rave-oldschool'],
  array['discografia','fsol','future-sound-of-london','jumpin-and-pumpin','bleep-techno','anos-90','reedicion'],

  '[
    {"label": "Discogs — The Pulse EPs (compilación 2008, master)", "url": "https://www.discogs.com/master/2159275-The-Future-Sound-Of-London-The-Pulse-EPs"},
    {"label": "Discogs — The Pulse E.P. (1991)", "url": "https://www.discogs.com/release/98260-Indo-Tribe-The-Future-Sound-Of-London-The-Pulse-EP"},
    {"label": "Discogs — Pulse Two (1991)", "url": "https://www.discogs.com/release/58285-The-Future-Sound-Of-London-Smart-Systems-Indo-Tribe-Pulse-Two"},
    {"label": "Discogs — Pulse Three (1991)", "url": "https://www.discogs.com/release/58822-Smart-Systems-Indo-Tribe-Yage-Pulse-Three"},
    {"label": "Discogs — Pulse Four (1992)", "url": "https://www.discogs.com/release/64851-Mental-Cube-Smart-Systems-Indo-Tribe-Pulse-Four"},
    {"label": "Wikipedia — Pulse 2 EP", "url": "https://en.wikipedia.org/wiki/Pulse_2_EP"},
    {"label": "Bandcamp — Pulse EP Vol. 1", "url": "https://fsol.bandcamp.com/album/pulse-ep-vol-1"},
    {"label": "Escuchar en YouTube (The Pulse EPs, remasterizado 2008)", "url": "https://www.youtube.com/watch?v=0GzNocR9kJc"}
  ]'::jsonb,

  'https://img.youtube.com/vi/0GzNocR9kJc/maxresdefault.jpg',

  '2026-08-25T16:00:00Z',
  '2026-08-25T16:00:00Z',
  '2027-08-25T00:00:00Z',

  'manual:editor',

  '',
  6,
  true,
  false,

  'Entre 1991 y 1992, Brian Dougans y Garry Cobain publicaron cuatro EPs en Jumpin'' & Pumpin'' bajo la serie Pulse. Cada uno aparece firmado por un alias distinto: Indo Tribe, Smart Systems, Yage, Mental Cube y The Future Sound of London. En 2008 el sello reeditó una selección de las cuatro en un solo CD.',

  'Fotograma del video de YouTube «The Future Sound of London | FSoL - The Pulse EPs (Full Album) (Remastered) (2008)».',

  $json$[
  {
    "kind": "lede",
    "text": "Entre 1991 y 1992, Brian Dougans y Garry Cobain publicaron cuatro EPs en el sello Jumpin' & Pumpin' bajo el nombre en serie Pulse. Cada EP aparece acreditado a distintos alias del mismo dúo: Indo Tribe, Smart Systems, Yage, Mental Cube y The Future Sound of London. En 2008 el sello reeditó una selección de las cuatro en un solo CD, The Pulse EPs, con edits y remezclas distintas a los originales de vinil."
  },
  {
    "kind": "p",
    "text": "Jumpin' & Pumpin' era el sub-sello británico de Passion Music. Dougans y Cobain firmaron ahí antes de su sencillo de mayor éxito, «Papua New Guinea» (1992), y usaron una serie de alias para sus lanzamientos de ese periodo: Air-cut, Amorphous Androgynous, Art Science Technology, Candese, Deep Field, Homeboy, Humanoid, Indo Tribe, Intelligent Communication, Mental Cube, Metropolis, Semtex, Semi Real, Smart Systems, the Far-out Son of Lung, Yage, Yunie y Zeebox. Los créditos de compositor en las cuatro EPs de Pulse dicen Brian Dougans y Garry Cobain, impreso como «Cockbain» en los créditos de Discogs."
  },
  {
    "kind": "divider"
  },
  {
    "kind": "h2",
    "text": "The Pulse E.P. (Pulse One)"
  },
  {
    "kind": "p",
    "text": "Publicado el 11 de febrero de 1991 en Jumpin' & Pumpin', catálogo 12TOT 11 (impreso 12 TOT 11 en la portada). Serie: Pulse, uno. Estilo en Discogs: Breakbeat, Hardcore, Techno, Bleep. Grabado en Earthbeat Studios. Manufacturado y comercializado por Passion Music Ltd., distribuido por Pinnacle, publicado por Skratch Music Publishing. Portada de Offbeat Design."
  },
  {
    "kind": "list",
    "ordered": false,
    "items": [
      "A1. Indo Tribe – Bring In The Pulse (MFK Mix) — productor: Mental Cube — 5:11",
      "A2. Indo Tribe – In The Mind Of A Child (First Born Mix) — productor: Mental Cube — 5:18",
      "B1. The Future Sound Of London – Hardhead (Frothin' At The Mouth Mix) — productor: Yage — 6:07",
      "B2. The Future Sound Of London – Pulse State (831 AM Mix) — productor: Yage — 7:33"
    ]
  },
  {
    "kind": "h2",
    "text": "Pulse Two"
  },
  {
    "kind": "p",
    "text": "Publicado en 1991 en Jumpin' & Pumpin', catálogo 12TOT 14. Serie: Pulse, dos. Estilo en Discogs: Techno. Publicado por Skratch Music Publishing, copyright fonográfico de Passion Music Ltd."
  },
  {
    "kind": "list",
    "ordered": false,
    "items": [
      "A1. The Future Sound Of London – Stolen Documents (Jazz Dub) — productor: Luco",
      "A2. Smart Systems – Zip Code (Stress Ball Mix) — productor: Mental Cube",
      "B1. The Future Sound Of London – In 8 (W-O-W Mix) — productor: Mental Cube",
      "B2. Indo Tribe – I've Become What You Were (Insider Mix) — productor: Mental Cube"
    ]
  },
  {
    "kind": "p",
    "text": "Nota de Discogs: las mezclas de «Stolen Documents» y «In 8» de este EP son las mismas que después salieron en el álbum Accelerator, la segunda bajo el título «1 in 8»."
  },
  {
    "kind": "h2",
    "text": "Pulse Three"
  },
  {
    "kind": "p",
    "text": "Publicado en 1991 en Jumpin' & Pumpin', catálogo 12TOT 16 (impreso 12 TOT 16 en la portada). Serie: Pulse, tres. Estilo en Discogs: Breakbeat, Hardcore, Techno. Grabado y mezclado en Earthbeat Studios, publicado por Skratch Music Publishing. Portada de Buggy G. Riphead. Productor ejecutivo: Tim Jones. Producción e ingeniería: The Future Sound Of London."
  },
  {
    "kind": "list",
    "ordered": false,
    "items": [
      "A1. Smart Systems – Tingler (Four By Four Mix) — productor: Mental Cube — 4:32",
      "A2. Indo Tribe – Owl (I Can See You Mix) — productor: Mental Cube — 4:52",
      "B1. Indo Tribe – Bite The Bullet Baby (Jaques Reynoix Mix) — productor: Yage — 4:28",
      "B2. Yage – Calcium (Elemental Mix) — productor: Luco — 5:08"
    ]
  },
  {
    "kind": "p",
    "text": "Notas de Discogs: el título impreso en la contraportada es «PULSE EP VOL 3». La pista B1 samplea diálogo del programa de televisión Twin Peaks. «Calcium (Elemental Mix)» apareció después en la compilación Excursions In Ambience, acreditada a The Future Sound Of London."
  },
  {
    "kind": "h2",
    "text": "Pulse Four"
  },
  {
    "kind": "p",
    "text": "Publicado el 11 de mayo de 1992 en Jumpin' & Pumpin', catálogo 12TOT 25 (impreso 12 TOT 25 en la portada). Serie: Pulse, cuatro. Estilo en Discogs: Breakbeat, Hardcore, Techno. Grabado en Earthbeat Studios, publicado por Skratch Music Publishing. Diseño de Buggy G. Riphead. Ingeniería: Yage. Producción y mezcla: The Future Sound Of London."
  },
  {
    "kind": "list",
    "ordered": false,
    "items": [
      "A1. Mental Cube – I'm Not Gonna Let You Do It — 5:35",
      "A2. Smart Systems – The Creator — 4:30",
      "B1. Indo Tribe – Shrink — 4:24",
      "B2. Smart Systems – Space Virus — 5:18"
    ]
  },
  {
    "kind": "p",
    "text": "Notas de Discogs sobre samples: A1 samplea la voz de Vicky Martin, de «Not Gonna Do It (I Need A Man)» (acapella). B1 samplea el synth de «Made In Two Minutes» (Original Instrumental Mix), de Bug Kann & The Plastic Jam."
  },
  {
    "kind": "h2",
    "text": "The Pulse EPs (compilación, 2008)"
  },
  {
    "kind": "p",
    "text": "En 2008, Jumpin' & Pumpin' reeditó selecciones de las cuatro EPs en un solo CD, catálogo CD TOT 57, también distribuido por fsoldigital.com. Según las notas de Discogs, es una reedición incompleta: para caber en un solo disco, algunas pistas se editaron y otras se reemplazaron por remezclas distintas a las originales de vinil, sin cambiar el título. Estilo en Discogs: Techno, IDM, Ambient."
  },
  {
    "kind": "list",
    "ordered": true,
    "items": [
      "Indo Tribe – Bring In The Pulse (MFK Mix) — 5:12",
      "Indo Tribe – In The Mind Of A Child (First Born Mix) — 5:05",
      "The Future Sound Of London – Hardhead (Frothin' At The Mouth Mix) — 6:06",
      "The Future Sound Of London – Pulse State (831 AM Mix) — 7:19",
      "The Future Sound Of London – Stolen Documents (Jazz Dub) — 5:23",
      "Smart Systems – Zip Code (Stress Ball Mix) — 5:17",
      "The Future Sound Of London – 1-In-8 — 4:44",
      "Indo Tribe – I've Become What You Were (Insider Mix) — 4:19",
      "Smart Systems – Tingler (Four By Four Mix) — 4:35",
      "Indo Tribe – Owl (I Can See You Mix) — 4:56",
      "Indo Tribe – Bite The Bullet Baby (Jaques Reynoix Mix) — 4:33",
      "Yage – Calcium (Elemental Mix) — 4:53",
      "Mental Cube – I'm Not Gonna Let You Do It — 3:49",
      "Smart Systems – The Creator — 4:22",
      "Indo Tribe – Shrink — 4:14",
      "Smart Systems – Space Virus — 4:26"
    ]
  },
  {
    "kind": "divider"
  },
  {
    "kind": "p",
    "text": "La serie continuó décadas después con Pulse Five, publicado por el mismo dúo en el sello De:tuned."
  }
]$json$::jsonb,

  true,
  false
)
on conflict (id) do update set
  slug = excluded.slug, type = excluded.type, title = excluded.title,
  subtitle = excluded.subtitle, excerpt = excluded.excerpt,
  vibe_min = excluded.vibe_min, vibe_max = excluded.vibe_max,
  genres = excluded.genres, tags = excluded.tags, links = excluded.links,
  image_url = excluded.image_url,
  published_at = excluded.published_at, date = excluded.date,
  expires_at = excluded.expires_at, source = excluded.source,
  author = excluded.author, read_time = excluded.read_time,
  editorial = excluded.editorial, pinned = excluded.pinned,
  body_preview = excluded.body_preview, hero_caption = excluded.hero_caption,
  article_body = excluded.article_body,
  published = excluded.published, seed = excluded.seed;
