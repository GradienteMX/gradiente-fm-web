-- ============================================================================
-- 03-hipnagogico-2007-2012.sql
-- Listicle · "8 discos esenciales del hypnagogic pop, 2007-2012"
-- Autora (ficticia): Naty Geocities
-- Portada: 2008.gif
--
-- ANTES DE CORRER: sube 2008.gif al bucket `uploads` y cambia REEMPLAZAR por
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
  'li-hipnagogico-2007-2012',
  'hypnagogic-pop-2007-2012',
  'listicle',

  '8 discos esenciales del hypnagogic pop, 2007-2012',
  'Cuando la nostalgia por los ochenta terminó inventando la nostalgia de internet',
  'Antes de que existiera la palabra vaporwave, un puñado de discos en sellos como Hippos in Tanks, Arbutus y Tri Angle sampleó comerciales viejos, sintetizadores baratos y el sonido de arranque de Windows para inventar un futuro que nunca llegó. Ocho discos de esa escena, con James Ferraro abriendo la lista.',

  1, 6,

  array['hypnagogic-pop','proto-vaporwave','vaporwave','witch-house','synth-pop','dream-pop','post-internet','pbr-and-b','idm','ambient'],
  array['curaduria','hippos-in-tanks','vaporwave','hypnagogic-pop','nostalgia','internet','windows','y2k','anos-2000','vhs'],

  'https://REEMPLAZAR.supabase.co/storage/v1/object/public/uploads/2008.gif',

  '2026-08-25T16:00:00Z',
  '2026-08-25T16:00:00Z',
  '2027-08-25T00:00:00Z',

  'manual:editor',

  'Naty Geocities',
  7,
  true,
  false,

  'Antes de que existiera la palabra vaporwave, un puñado de discos en sellos como Hippos in Tanks, Arbutus y Tri Angle sampleó comerciales viejos, sintetizadores baratos y el sonido de arranque de Windows para inventar un futuro que nunca llegó. Ocho discos de esa escena, con James Ferraro abriendo la lista.',

  'PENDIENTE: describir el gif de portada (2008.gif)',

  $json$[
  {
    "kind": "lede",
    "text": "Hippos in Tanks fue un sello de Los Ángeles que existió apenas cinco años, del 2010 al 2015, fundado por Barron Machat y Travis Woolsey. En ese rato editó algunos de los discos más raros y más influyentes de la década. La idea de arranque era hacerle nostalgia a los ochenta con sintetizadores baratos, VHS y comerciales viejos. Lo que salió fue otra cosa por completo."
  },
  {
    "kind": "p",
    "text": "El crítico David Keenan le puso nombre en 2009, en la revista The Wire: hypnagogic pop, el estado entre dormir y despertar. La escena giraba alrededor de sellos chicos, Hippos in Tanks el más importante de todos, con satélites en Arbutus en Montreal y Tri Angle en Nueva York. El gesto que compartían: samplear comerciales viejos, tocar sintetizadores MIDI de gama baja, grabar todo con una fidelidad sucia a propósito. Nadie lo llevó tan lejos como James Ferraro, así que empezamos por ahí."
  },
  {
    "kind": "divider"
  },
  {
    "kind": "track",
    "rank": 1,
    "artist": "James Ferraro",
    "title": "Far Side Virtual",
    "year": 2011,
    "imageUrl": "https://f4.bcbits.com/img/a3403730010_10.jpg",
    "embeds": [
      {
        "platform": "youtube",
        "url": "https://www.youtube.com/watch?v=d9ndKlm-G3s"
      }
    ],
    "commentary": "Far Side Virtual es la obra central de todo este momento, el disco que más lejos llevó la idea hasta volverla irreconocible como nostalgia. Ferraro construyó dieciséis piezas de muzak corporativo perfecto: el tono de encendido de una Mac, un mensaje de Skype entrando, jazz de elevador hecho enteramente en software barato, el silencio artificial de un aeropuerto. No hay guitarras podridas ni sintetizadores vintage aquí, todo suena nuevo, limpio, casi optimista, y esa es la trampa del disco: en vez de mirar hacia atrás a los ochenta, mira hacia un futuro corporativo que en 2011 ya se sentía inevitable y que hoy, año 2026, ya pasó, sin resultar tan brillante como prometía. Fact Magazine lo llamó una obra maestra el mismo año que salió. Con el tiempo se volvió el documento fundacional, a veces sin que Ferraro reciba el crédito, de todo lo que después se llamaría vaporwave."
  },
  {
    "kind": "track",
    "rank": 2,
    "artist": "Games",
    "title": "That We Can Play",
    "year": 2010,
    "imageUrl": "https://img.youtube.com/vi/lDua86QCms8/hqdefault.jpg",
    "embeds": [
      {
        "platform": "youtube",
        "url": "https://www.youtube.com/watch?v=lDua86QCms8"
      }
    ],
    "commentary": "Games era el nombre que usaban Daniel Lopatin, el mismo detrás de Oneohtrix Point Never un poco más adelante en esta lista, y Joel Ford, antes de que una disputa legal por el nombre los obligara a rebautizarse Ford & Lopatin. That We Can Play fue su debut, grabado con sintetizadores y secuenciadores viejos para sonar a synth pop ochentero, con Laurel Halo cantando en «Strawberry Skies». El EP cierra con un remix de Gatekeeper sobre esa misma canción, no de Grimes como a veces se recuerda, aunque la confusión tiene sentido: la que sí canta ahí es Laurel Halo. Es el lado más amable de todo el catálogo de Lopatin, casi un disco de pop de verdad."
  },
  {
    "kind": "track",
    "rank": 3,
    "artist": "Oneohtrix Point Never",
    "title": "Replica",
    "year": 2011,
    "imageUrl": "https://f4.bcbits.com/img/a2920217675_10.jpg",
    "embeds": [
      {
        "platform": "youtube",
        "url": "https://www.youtube.com/watch?v=Iefc_iwNLb8"
      }
    ],
    "commentary": "Daniel Lopatin, la mitad seria de Games, dejó los sintetizadores atrás por primera vez en su propio catálogo y construyó todo el disco a partir de comerciales de televisión de los ochenta y noventa, sacadas de compilaciones de VHS. El resultado es un ciclo de canciones hecho enteramente de basura publicitaria vuelta ambient, la misma técnica que Ferraro explota en Far Side Virtual pero llevada a un lugar más abstracto y menos limpio. «Power of Persuasion» resume el gesto completo."
  },
  {
    "kind": "p",
    "text": "Estos tres discos son el corazón conceptual de la lista: el futuro prometido y nunca entregado, sonando a comercial de televisión. El resto queda más cerca de la nostalgia como se entendía originalmente, antes de que el género se volteara sobre sí mismo: ochentas de verdad, VHS de verdad, radio AM."
  },
  {
    "kind": "track",
    "rank": 4,
    "artist": "Grimes / d'Eon",
    "title": "Darkbloom",
    "year": 2011,
    "imageUrl": "https://f4.bcbits.com/img/a4057291810_10.jpg",
    "embeds": [
      {
        "platform": "youtube",
        "url": "https://www.youtube.com/watch?v=8pye1d018aQ"
      },
      {
        "platform": "youtube",
        "url": "https://www.youtube.com/watch?v=yuMufoHT4vQ"
      }
    ],
    "commentary": "Split entre dos artistas de Montreal, lanzado a la vez por Arbutus e Hippos in Tanks, cada uno grabó su lado por separado. El de Grimes trae la energía oscura de Halfaxa junto con el dream pop de Geidi Primes, un año antes de Visions y del estrellato. Aquí va la ironía completa: en Gradiente no somos fans de Grimes como figura pública, pero Darkbloom es un disco genuinamente bueno, con canciones pegajosas de verdad, «Vanessa» a la cabeza. d'Eon responde del otro lado con footwork de Chicago y new jack swing metidos en la misma lógica hipnagógica, en «Transparency»."
  },
  {
    "kind": "track",
    "rank": 5,
    "artist": "Rangers",
    "title": "Suburban Tours",
    "year": 2010,
    "imageUrl": "https://img.youtube.com/vi/nLRfj74pTmg/hqdefault.jpg",
    "embeds": [
      {
        "platform": "youtube",
        "url": "https://www.youtube.com/watch?v=nLRfj74pTmg"
      }
    ],
    "commentary": "Joe Knight lo grabó solo, primero en Denton y luego en San Francisco, y quedó como una de las piezas fundacionales del hypnagogic pop, en Olde English Spelling Bee. Suena a AOR de los ochenta escuchado en una copia de una copia, con la melodía todavía reconocible pero la textura ya podrida. La crítica lo describió como «memoria de una memoria», que es exactamente el efecto: nostalgia sin ningún objeto real detrás."
  },
  {
    "kind": "track",
    "rank": 6,
    "artist": "Balam Acab",
    "title": "See Birds",
    "year": 2010,
    "imageUrl": "https://img.youtube.com/vi/y06h3rLRRh4/hqdefault.jpg",
    "embeds": [
      {
        "platform": "youtube",
        "url": "https://www.youtube.com/watch?v=y06h3rLRRh4"
      }
    ],
    "commentary": "Alec Koone tenía dieciocho años cuando grabó esto, y fue el primer lanzamiento de Tri Angle Records, el sello que después definiría el witch house y su vuelta más oscura hacia el R&B. See Birds suena a dubstep desacelerado hasta casi detenerse, con voces pitcheadas hacia abajo hasta sonar a fantasmas. Menos sobre nostalgia que el resto de esta lista, pero sale del mismo impulso: samplear, ralentizar, dejar que el material se pudra."
  },
  {
    "kind": "track",
    "rank": 7,
    "artist": "Hype Williams",
    "title": "One Nation",
    "year": 2011,
    "imageUrl": "https://img.youtube.com/vi/dUWgDaSZI04/hqdefault.jpg",
    "embeds": [
      {
        "platform": "youtube",
        "url": "https://www.youtube.com/watch?v=dUWgDaSZI04"
      }
    ],
    "commentary": "Dean Blunt e Inga Copeland grabaron bajo el nombre de un director de videos de hip hop de los noventa, sin explicar nunca por qué. One Nation es lo-fi de verdad y no como pose: dub apagado, samples de spoken word, canciones que se cortan antes de resolver. Blunt dijo que buscaban lo contrario a la sobreproducción del resto de la electrónica del momento, y funcionó: nadie más sonaba así en 2011."
  },
  {
    "kind": "track",
    "rank": 8,
    "artist": "Autre Ne Veut",
    "title": "Body EP",
    "year": 2011,
    "imageUrl": "https://img.youtube.com/vi/R4IYk49lFLs/hqdefault.jpg",
    "embeds": [
      {
        "platform": "youtube",
        "url": "https://www.youtube.com/watch?v=R4IYk49lFLs"
      }
    ],
    "commentary": "Arthur Ashin cantaba R&B distorsionado hasta el colapso emocional, con la voz forzada como si el sistema no pudiera contener lo que traía adentro. «Sweetheart» es el momento más humano y más roto de toda esta lista. Body EP salió el mismo año en que empezó a acuñarse el término PBR&B para nombrar esto, aunque a él nunca le gustó la etiqueta."
  },
  {
    "kind": "divider"
  },
  {
    "kind": "p",
    "text": "Barron Machat, uno de los dos fundadores de Hippos in Tanks, murió en abril de 2015 en un choque en Miami. El sello no sacó nada después de eso."
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
