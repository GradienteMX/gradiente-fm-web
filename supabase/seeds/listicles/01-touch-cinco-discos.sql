-- ============================================================================
-- 01-touch-cinco-discos.sql
-- Listicle · "6 discos clásicos de Touch (y un pilón)"
-- Autor (ficticio): lalo_timestretch
-- Portada: touch.gif
--
-- ANTES DE CORRER: sube touch.gif al bucket `uploads` y cambia REEMPLAZAR
-- por el project ref real en la línea de image_url.
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
  'li-touch-cinco-discos',
  'discos-clasicos-de-touch',
  'listicle',

  '6 discos clásicos de Touch (y un pilón)',
  'Un label que desde 1982 piensa la foto, el texto y el sonido en conjunto',
  'Touch es un label de ambient y composición contemporánea experimental que existe desde 1982. Seis de sus clásicos, de las grabaciones de campo de Chris Watson a las sinusoides de Ryoji Ikeda… más un pilón de Rough Trade que funciona como mapa.',

  0, 4,

  array['ambient-drone','drone','environmental','glitch','musique-concrete-music','idm'],
  array['curaduria','touch','sello','ambient','field-recording','uk','discos','clasicos'],

  'https://REEMPLAZAR.supabase.co/storage/v1/object/public/uploads/touch.gif',

  '2026-08-19T10:00:00Z',
  '2026-08-19T10:00:00Z',
  '2027-08-19T00:00:00Z',

  'manual:editor',

  'lalo_timestretch',
  4,
  true,
  false,

  'Touch es un label de ambient y composición contemporánea experimental que existe desde 1982. Nunca han tenido género como tal… pero sí han tenido oído. Seis de los clásicos que más aprecio, y un pilón.',

  'touch.gif · seis clásicos del catálogo y un pilón',

  $json$[
  {
    "kind": "lede",
    "text": "Touch es un label de ambient y composición contemporánea experimental que existe desde 1982. Jon Wozencroft y Mike Harding lo montaron como una editorial más que como un sello: con énfasis en la foto de portada, el texto y el sonido como algo que siempre piensa en conjunto. Nunca han tenido género como tal… pero sí han tenido oído. Les comparto seis de los clásicos que más aprecio."
  },
  {
    "kind": "p",
    "text": "Touch tiene una filosofía que es algo como….. grabar algo real, tocarlo lo mínimo y dejar que el silencio haga lo demás…. De ahí salen piezas de grabaciones de campo, el glitch y la síntesis granular, manipulación de instrumentos acústicos… piezas con tocadiscos podridos de Liverpool… y géneros únicos como el “restrained music de Eleh” (uno de los favoritos por estos rumbos)."
  },
  {
    "kind": "divider"
  },
  {
    "kind": "track",
    "rank": 1,
    "artist": "Varios · Rough Trade Shops",
    "title": "Electronic 01",
    "year": 2002,
    "imageUrl": "https://img.youtube.com/vi/8JGZzMpToAI/maxresdefault.jpg",
    "embeds": [
      {
        "platform": "youtube",
        "url": "https://www.youtube.com/watch?v=8JGZzMpToAI&list=PLmb2UjVIlH0jsjZoiq-_kfnxQADwsr5wK"
      }
    ],
    "commentary": "Arranco con un pilón que viene de otra casa… Rough Trade Shops armó para Mute una compilación doble de 41 tracks que barre cuarenta años de electrónica: Joe Meek en 1960, el Radiophonic Workshop con el tema de Doctor Who, Kraftwerk, «Warm Leatherette» de The Normal. Lo pongo primero porque funciona como el mapa que el catálogo de Touch da por sabido. Drowned in Sound le puso 9 de 10 en su momento."
  },
  {
    "kind": "divider"
  },
  {
    "kind": "track",
    "rank": 2,
    "artist": "Chris Watson",
    "title": "Weather Report",
    "year": 2003,
    "imageUrl": "https://f4.bcbits.com/img/a4148335130_10.jpg",
    "embeds": [
      {
        "platform": "youtube",
        "url": "https://www.youtube.com/watch?v=oWJJlYAbckc"
      },
      {
        "platform": "bandcamp",
        "url": "https://chriswatsonreleases.bandcamp.com/album/weather-report"
      }
    ],
    "commentary": "TO:47. Watson fundó Cabaret Voltaire y después se pasó treinta años grabando fauna para la BBC. Son tres piezas y tres escalas de tiempo: catorce horas en el Masai Mara, cuatro meses de otoño escocés, y diez mil años de hielo del Vatnajökull vaciándose hacia el mar de Noruega. Casi no hay manipulación… todo el trabajo lo hace el montaje."
  },
  {
    "kind": "track",
    "rank": 3,
    "artist": "Philip Jeck",
    "title": "Stoke",
    "year": 2002,
    "imageUrl": "https://f4.bcbits.com/img/a1617977480_10.jpg",
    "embeds": [
      {
        "platform": "youtube",
        "url": "https://www.youtube.com/watch?v=KDy9MKCY5yI"
      },
      {
        "platform": "bandcamp",
        "url": "https://philipjeck.bandcamp.com/album/stoke"
      }
    ],
    "commentary": "TO:56. Jeck trabajaba con tocadiscos Dansette de los sesenta, discos comprados por kilo y una Casio. Siete piezas cortas donde el ruido de superficie funciona como instrumento. «Pax» es una voz de blues ralentizada sobre órgano y a mí me sigue pareciendo lo más triste del catálogo."
  },
  {
    "kind": "track",
    "rank": 4,
    "artist": "Oren Ambarchi",
    "title": "Grapes from the Estate",
    "year": 2004,
    "imageUrl": "https://f4.bcbits.com/img/a2249408761_10.jpg",
    "embeds": [
      {
        "platform": "youtube",
        "url": "https://www.youtube.com/watch?v=CcNy9JcheVw"
      },
      {
        "platform": "bandcamp",
        "url": "https://orenambarchi.bandcamp.com/album/grapes-from-the-estate"
      }
    ],
    "commentary": "TO:61. Ambarchi toca la guitarra como si fuera un oscilador… acá le agrega campanas, piano y unos graves que se sienten antes de oírse. Cuatro piezas largas grabadas en Sídney. A volumen bajo se escucha como otro disco distinto, es de esos que cambian por completo según cómo los pongas."
  },
  {
    "kind": "track",
    "rank": 5,
    "artist": "Biosphere",
    "title": "Substrata",
    "year": 1997,
    "imageUrl": "https://f4.bcbits.com/img/a1535970875_10.jpg",
    "embeds": [
      {
        "platform": "youtube",
        "url": "https://www.youtube.com/watch?v=7QaCsr4hIrw"
      },
      {
        "platform": "bandcamp",
        "url": "https://biosphere.bandcamp.com/album/substrata"
      }
    ],
    "commentary": "Geir Jenssen lo grabó en Tromsø con diálogo de película sampleado y sintetizadores que suenan a hielo. Salió en Origo Sound y Touch lo reeditó en 2001 como Substrata² (TO:50), que es la versión por la que casi todos lo conocen. Aparece en cada lista de mejor disco ambient de la historia y por acá no lo vamos a discutir."
  },
  {
    "kind": "track",
    "rank": 6,
    "artist": "Fennesz",
    "title": "Venice",
    "year": 2004,
    "imageUrl": "https://f4.bcbits.com/img/a4275110981_10.jpg",
    "embeds": [
      {
        "platform": "youtube",
        "url": "https://www.youtube.com/watch?v=luKqybLrBho"
      },
      {
        "platform": "bandcamp",
        "url": "https://fenneszreleases.bandcamp.com/album/venice-20"
      }
    ],
    "commentary": "TO:53. Venía de Endless Summer, que salió en Mego y no acá… en Venice la guitarra procesada se vuelve niebla y la melodía se queda visible debajo del daño digital. David Sylvian canta en «Transit». Es el Touch que más gente ha escuchado sin saber que era Touch."
  },
  {
    "kind": "track",
    "rank": 7,
    "artist": "Ryoji Ikeda",
    "title": "+/-",
    "year": 1996,
    "imageUrl": "https://f4.bcbits.com/img/a0599803843_10.jpg",
    "embeds": [
      {
        "platform": "youtube",
        "url": "https://www.youtube.com/watch?v=2FW4cAG036s"
      },
      {
        "platform": "bandcamp",
        "url": "https://ryojiikedareleases.bandcamp.com/album/-"
      }
    ],
    "commentary": "TO:30. Tonos de prueba, sinusoides y frecuencias en el borde de lo audible… las secciones «Headphonics» son ritmo puro sin instrumento. Cierra con una sinusoide de sesenta segundos que uno alcanza a notar hasta que se va. Fue el primer disco de Ikeda en el label y treinta años después me sigue pareciendo el más difícil de todos."
  },
  {
    "kind": "divider"
  },
  {
    "kind": "p",
    "text": "Se quedaron fuera Hildur Guðnadóttir, Mika Vainio y Jana Winderen… y está Touch Radio, que lleva años subiendo grabaciones de campo sin cobrar nada.\n\nSaludossss"
  }
]$json$::jsonb,

  true,
  false
)
on conflict (id) do update set
  slug          = excluded.slug,
  type          = excluded.type,
  title         = excluded.title,
  subtitle      = excluded.subtitle,
  excerpt       = excluded.excerpt,
  vibe_min      = excluded.vibe_min,
  vibe_max      = excluded.vibe_max,
  genres        = excluded.genres,
  tags          = excluded.tags,
  image_url     = excluded.image_url,
  published_at  = excluded.published_at,
  date          = excluded.date,
  expires_at    = excluded.expires_at,
  source        = excluded.source,
  author        = excluded.author,
  read_time     = excluded.read_time,
  editorial     = excluded.editorial,
  pinned        = excluded.pinned,
  body_preview  = excluded.body_preview,
  hero_caption  = excluded.hero_caption,
  article_body  = excluded.article_body,
  published     = excluded.published,
  seed          = excluded.seed;
