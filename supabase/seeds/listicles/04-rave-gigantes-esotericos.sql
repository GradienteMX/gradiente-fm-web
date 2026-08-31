-- ============================================================================
-- 04-rave-gigantes-esotericos.sql
-- Listicle · "8 gigantes esotéricos del rave, 1990-1994"
-- Autor (ficticio): Chava Rufige
-- Portada: rave.gif
--
-- ANTES DE CORRER: sube rave.gif al bucket `uploads` y cambia REEMPLAZAR por
-- el project ref real, en la línea de image_url. hero_caption sigue
-- pendiente, describe el gif una vez que Johan lo tenga arriba.
--
-- Re-ejecutable: on conflict (id) do update.
-- ============================================================================

insert into items (
  id, slug, type,
  title, subtitle, excerpt,
  vibe_min, vibe_max,
  genres, tags,
  image_url,
  published_at, date, expires_at,
  source,
  author, read_time, editorial, pinned,
  body_preview, hero_caption, article_body,
  published, seed
) values (
  'li-rave-gigantes-esotericos',
  'rave-gigantes-esotericos',
  'listicle',

  '8 gigantes esotéricos del rave, 1990-1994',
  'Cuando el acid house se volvió ritual: chamanismo, Discordianismo y tambores tribales antes del jungle',
  'Antes de que el rave se hiciera estadio y llegara el jungle, hubo unos años donde sonaba a ritual: tambores tribales sampleados, pirámides en las portadas, un viaje de DMT narrado en vivo. Ocho discos gigantes y genuinamente raros del rave británico, del 90 al 94.',

  4, 9,

  array['rave-oldschool','breakbeat','techno-acid','trance-goa','techno-experimental','ambient','psybient','fourth-world-music'],
  array['curaduria','rave','tribal','esoterico','acid-house','goa-trance','anos-90','mistica'],

  'https://REEMPLAZAR.supabase.co/storage/v1/object/public/uploads/rave.gif',

  '2026-08-25T16:00:00Z',
  '2026-08-25T16:00:00Z',
  '2027-08-25T00:00:00Z',

  'manual:editor',

  'Chava Rufige',
  7,
  true,
  false,

  'Antes de que el rave se hiciera estadio y llegara el jungle, hubo unos años donde sonaba a ritual: tambores tribales sampleados, pirámides en las portadas, un viaje de DMT narrado en vivo. Ocho discos gigantes y genuinamente raros del rave británico, del 90 al 94.',

  'PENDIENTE: describir el gif de portada (rave.gif)',

  $json$[
  {
    "kind": "lede",
    "text": "Entre 1990 y 1994, antes de que el jungle lo cambiara todo y antes de que el rave se volviera estadio, hubo una escena británica que sonaba a ritual más que a fiesta. Tambores tribales sampleados, textos sobre chamanismo en las notas del disco, portadas con pirámides y ojos que todo lo ven. Ocho discos gigantes de esos años, todos genuinamente raros."
  },
  {
    "kind": "p",
    "text": "El disco de arranque de esta lista es un track de 1991 llamado «Bring In The Pulse (MFK Mix)», firmado como Indo Tribe. Es en realidad Brian Dougans y Gaz Cobain, el dúo detrás de The Future Sound of London, usando un alias más para su sello Jumpin' & Pumpin'. Ese es el tono exacto de esta lista: nombres falsos, alias con nombre de secta, dúos que se escondían detrás de conceptos enteros."
  },
  {
    "kind": "divider"
  },
  {
    "kind": "track",
    "rank": 1,
    "artist": "Indo Tribe",
    "title": "Bring In The Pulse (MFK Mix)",
    "year": 1991,
    "imageUrl": "https://f4.bcbits.com/img/a0076808513_10.jpg",
    "embeds": [
      {
        "platform": "youtube",
        "url": "https://www.youtube.com/watch?v=yEzEPxdjE_M"
      }
    ],
    "commentary": "Indo Tribe era un alias de Brian Dougans y Gaz Cobain, el dúo que se volvería famoso como The Future Sound of London, usado casi en exclusiva para su sello Jumpin' & Pumpin'. Bring In The Pulse mezcla percusión tribal sampleada con breaks acelerados y una capa de sintetizador que parece respirar. Salió en The Pulse EP, del 91, un año antes de que FSOL como nombre propio se volviera conocido de verdad."
  },
  {
    "kind": "track",
    "rank": 2,
    "artist": "Psychick Warriors ov Gaia",
    "title": "Exit 23 (Ritual Dance Music)",
    "year": 1990,
    "imageUrl": "https://img.youtube.com/vi/hB5fOayS6nc/hqdefault.jpg",
    "embeds": [
      {
        "platform": "youtube",
        "url": "https://www.youtube.com/watch?v=hB5fOayS6nc"
      }
    ],
    "commentary": "Un dúo de Tilburg, Países Bajos, que hizo de esto su debut: un sencillo minimalista, casi hipnótico, titulado sin ironía «Ritual Dance Music». Exit 23 mete techno de Detroit, breaks tribales y una capa ambient industrial encima, de las primeras veces que alguien le puso la palabra tribal a un disco de techno. Salió en KK Records, de Bélgica, en 1990."
  },
  {
    "kind": "track",
    "rank": 3,
    "artist": "The Prodigy",
    "title": "Voodoo People",
    "year": 1994,
    "imageUrl": "https://img.youtube.com/vi/YV78vobCyIo/hqdefault.jpg",
    "embeds": [
      {
        "platform": "youtube",
        "url": "https://www.youtube.com/watch?v=YV78vobCyIo"
      }
    ],
    "commentary": "Tercer sencillo de Music for the Jilted Generation, el disco que Liam Howlett armó como respuesta directa a la ley que ese mismo año criminalizó al rave en Reino Unido. Voodoo People samplea a The Last Poets, el riff de Nirvana en «Very Ape» y un corte de blaxploitation de Johnny Pate, todo apilado sobre una línea ácida que se acelera hasta el final. Es el gigante de verdad de esta lista, el único que llegó a las listas de popularidad."
  },
  {
    "kind": "track",
    "rank": 4,
    "artist": "The KLF",
    "title": "3am Eternal (Live At The S.S.L.)",
    "year": 1991,
    "imageUrl": "https://img.youtube.com/vi/HDsCeC6f0zc/hqdefault.jpg",
    "embeds": [
      {
        "platform": "youtube",
        "url": "https://www.youtube.com/watch?v=HDsCeC6f0zc"
      }
    ],
    "commentary": "Bill Drummond y Jimmy Cauty venían de llamarse The Justified Ancients of Mu Mu, nombre sacado directo de la trilogía Illuminatus! y su Discordianismo de broma en serio. 3am Eternal empezó como sencillo de esa era, en el 89, y esta versión, relanzada en enero del 91 y sacada del álbum The White Room, fue su segundo número uno. Un año después quemaron un millón de libras en una isla escocesa, pero esa ya es otra historia."
  },
  {
    "kind": "track",
    "rank": 5,
    "artist": "System 7",
    "title": "7:7 Expansion",
    "year": 1993,
    "imageUrl": "https://f4.bcbits.com/img/a4046939604_10.jpg",
    "embeds": [
      {
        "platform": "youtube",
        "url": "https://www.youtube.com/watch?v=Q9PgKpl7F3Y"
      }
    ],
    "commentary": "Steve Hillage y Miquette Giraudy venían de Gong, la banda de rock psicodélico y espacial de los setenta, y trajeron esa herencia cósmica directo al rave. 7:7 Expansion es el corte de su álbum 777 que mejor resume el giro hacia el techno más recto, sin perder del todo el lado ambient pop de su debut. 777 llegó al top 30 del UK Albums Chart en el 93, algo raro para un disco tan raro."
  },
  {
    "kind": "track",
    "rank": 6,
    "artist": "Eat Static",
    "title": "Prana",
    "year": 1993,
    "imageUrl": "https://f4.bcbits.com/img/a0083712626_10.jpg",
    "embeds": [
      {
        "platform": "youtube",
        "url": "https://www.youtube.com/watch?v=RBJYYHrBLfc"
      }
    ],
    "commentary": "Joie Hinton y Merv Pepler, de Ozric Tentacles, armaron este proyecto obsesionado con ovnis y abducciones. Prana abre el álbum Abduction con bleeps de ciencia ficción, samples encontrados y una base tribal trance que ayudó a definir lo que después se llamaría psy trance. Salió en Planet Dog, el sello que fundaron los mismos Ozric Tentacles."
  },
  {
    "kind": "track",
    "rank": 7,
    "artist": "Man With No Name",
    "title": "Teleport",
    "year": 1994,
    "imageUrl": "https://img.youtube.com/vi/NJUFEhk5Yzo/hqdefault.jpg",
    "embeds": [
      {
        "platform": "youtube",
        "url": "https://www.youtube.com/watch?v=NJUFEhk5Yzo"
      }
    ],
    "commentary": "Martin Freeland debutó con este sencillo, un canto vocal femenino que se abre paso entre ácidos y un sample sobre teleportación humana. Teleport salió en Dragonfly Records, el sello que terminaría definiendo el goa trance como género aparte del rave que lo parió. Es el disco de esta lista donde más claro se nota hacia dónde iba a ir todo esto después del 94."
  },
  {
    "kind": "track",
    "rank": 8,
    "artist": "Zuvuya con Terence McKenna",
    "title": "Dream Matrix Telemetry",
    "year": 1993,
    "imageUrl": "https://img.youtube.com/vi/2QEYeRIU5ls/hqdefault.jpg",
    "embeds": [
      {
        "platform": "youtube",
        "url": "https://www.youtube.com/watch?v=2QEYeRIU5ls"
      }
    ],
    "commentary": "El más esotérico de toda la lista, sin competencia. Terence McKenna, el etnobotánico y filósofo psicodélico, narra encima de la ambient tribal de Zuvuya una sola pieza larga que describe e intenta provocar un viaje de DMT. No es rave en el sentido de pista de baile, es lo que sonaba en las carpas chill-out de esos mismos raves a las seis de la mañana, cuando el ritual ya había dejado de ser solo una palabra en la portada."
  },
  {
    "kind": "divider"
  },
  {
    "kind": "p",
    "text": "Nos vemos en el chill-out, con mucha agua a la mano."
  }
]$json$::jsonb,

  true,
  false
)
on conflict (id) do update set
  slug = excluded.slug, type = excluded.type, title = excluded.title,
  subtitle = excluded.subtitle, excerpt = excluded.excerpt,
  vibe_min = excluded.vibe_min, vibe_max = excluded.vibe_max,
  genres = excluded.genres, tags = excluded.tags, image_url = excluded.image_url,
  published_at = excluded.published_at, date = excluded.date,
  expires_at = excluded.expires_at, source = excluded.source,
  author = excluded.author, read_time = excluded.read_time,
  editorial = excluded.editorial, pinned = excluded.pinned,
  body_preview = excluded.body_preview, hero_caption = excluded.hero_caption,
  article_body = excluded.article_body,
  published = excluded.published, seed = excluded.seed;
