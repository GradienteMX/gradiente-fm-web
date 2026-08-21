-- ============================================================================
-- 02-nivel-acuatico.sql
-- Listicle · "7 rolas bien acuáticas"
-- Autora (ficticia): Nena Tempest
-- Portada: PENDIENTE, Johan da el nombre del gif
--
-- ANTES DE CORRER: sube el gif al bucket `uploads` y cambia REEMPLAZAR por el
-- project ref y PORTADA.gif por el nombre real, en la línea de image_url.
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
  'li-nivel-acuatico',
  'rolas-bien-acuaticas',
  'listicle',

  '7 rolas bien acuáticas',
  'Del jazz modal del 65 al cartucho de SNES del 94',
  'Jazz del 65, ambient japonés, post-metal, un soundtrack de Sega CD y el nivel del agua de Donkey Kong Country. Siete rolas y un pilón que se sale un poco del tema, a ver si lo topan.',

  1, 7,

  array['ambient-drone','ambient','environmental','new-age','jazz-modal','electro','punk-metal','rock-pop'],
  array['curaduria','agua','videojuegos','ambient','jazz','soundtrack','anos-90'],

  'https://REEMPLAZAR.supabase.co/storage/v1/object/public/uploads/PORTADA.gif',

  '2026-08-19T16:00:00Z',
  '2026-08-19T16:00:00Z',
  '2027-08-19T00:00:00Z',

  'manual:editor',

  'Nena Tempest',
  5,
  true,
  false,

  'Les comparto unas rolas bien acuáticas. Hay jazz del 65, ambient japonés, post-metal, un soundtrack de Sega CD y el nivel del agua de Donkey Kong Country. Lo único que las junta es que suenan a estar sumergido.',

  'PENDIENTE: describir el gif de portada',

  $json$[
  {
    "kind": "lede",
    "text": "Les comparto unas rolas bien acuáticas. Hay jazz del 65, ambient japonés, post-metal, un soundtrack de Sega CD y el nivel del agua de Donkey Kong Country. Lo único que las junta es que suenan a estar sumergido."
  },
  {
    "kind": "p",
    "text": "Ahí van siete y un pilón que se sale un poco del tema, a ver si topan cuál."
  },
  {
    "kind": "divider"
  },
  {
    "kind": "track",
    "rank": 1,
    "artist": "Hiroshi Yoshimura",
    "title": "Wet Land",
    "year": 1993,
    "imageUrl": "https://img.youtube.com/vi/Z3m7HXeiHpg/hqdefault.jpg",
    "embeds": [
      {
        "platform": "youtube",
        "url": "https://www.youtube.com/watch?v=Z3m7HXeiHpg"
      }
    ],
    "commentary": "Yoshimura hacía kankyō ongaku, la música ambiental japonesa que se encargaba por edificio o por muestra de perfume. Wet Land es de sus discos tardíos y trabaja con humedad más que con agua abierta: goteo, vapor, estanque quieto. «Singing Stream» es la que más se acerca a estar sumergido."
  },
  {
    "kind": "track",
    "rank": 2,
    "artist": "Spencer Nilsen",
    "title": "Ecco the Dolphin (Sega CD)",
    "year": 1993,
    "imageUrl": "https://img.youtube.com/vi/8y7yUREVvGg/maxresdefault.jpg",
    "embeds": [
      {
        "platform": "youtube",
        "url": "https://www.youtube.com/watch?v=8y7yUREVvGg"
      }
    ],
    "commentary": "La versión de Sega CD cambió el chiptune por audio grabado, y Nilsen le puso sintetizadores de disco de new age noventero. El juego traumatizó a toda una generación de niños que solo querían jugar con un delfín, y buena parte de eso fue la música. Suena más a disco de escuchar en casa que a banda sonora de consola."
  },
  {
    "kind": "track",
    "rank": 3,
    "artist": "Drexciya",
    "title": "Bubble Metropolis",
    "year": 1993,
    "imageUrl": "https://img.youtube.com/vi/ycbcA--NtZM/hqdefault.jpg",
    "embeds": [
      {
        "platform": "youtube",
        "url": "https://www.youtube.com/watch?v=ycbcA--NtZM"
      }
    ],
    "commentary": "James Stinson y Gerald Donald inventaron a los drexciyanos: hijos de las mujeres embarazadas que arrojaron de los barcos negreros, y que aprendieron a respirar bajo el agua. Toda su discografía cuenta pedazos de esa civilización submarina. Salió en Underground Resistance con el número UR-026 y suena a electro de Detroit con presión de profundidad."
  },
  {
    "kind": "track",
    "rank": 4,
    "artist": "Isis",
    "title": "Oceanic",
    "year": 2002,
    "imageUrl": "https://f4.bcbits.com/img/a0262554903_10.jpg",
    "embeds": [
      {
        "platform": "youtube",
        "url": "https://www.youtube.com/watch?v=mHtpU4aABPI"
      },
      {
        "platform": "bandcamp",
        "url": "https://isistheband.bandcamp.com/album/oceanic-remastered"
      }
    ],
    "commentary": "Post-metal de Los Ángeles con una historia de ahogamiento atrás. Aaron Turner lo montó con riffs que suben y bajan como marea y con Maria Christopher haciendo las voces limpias encima. Salió en Ipecac, el sello de Mike Patton, en 2002."
  },
  {
    "kind": "track",
    "rank": 5,
    "artist": "Dolphins Into The Future",
    "title": "…On Sea-Faring Isolation",
    "year": 2009,
    "imageUrl": "https://f4.bcbits.com/img/a0828685829_10.jpg",
    "embeds": [
      {
        "platform": "youtube",
        "url": "https://www.youtube.com/watch?v=pLZsSJVkfj8"
      },
      {
        "platform": "bandcamp",
        "url": "https://dolphinsintothefuture.bandcamp.com/album/on-sea-faring-isolation"
      }
    ],
    "commentary": "Lieven Martens, de Amberes, armó este disco como tributo a los escritos de John C. Lilly sobre el aislamiento en altamar. Lilly es el neurocientífico que en los sesenta montó una casa inundada en las Islas Vírgenes para vivir con delfines e intentar enseñarles inglés, inventó el tanque de privación sensorial y acabó metiéndose LSD adentro a ver si así se entendían mejor. El disco no narra nada de eso, se queda nomás con la parte de estar solo en medio del océano: sintetizador barato, grabaciones de agua encima y «Lone Voyager» de nueve minutos a la mitad. Salió en Not Not Fun en 2009."
  },
  {
    "kind": "track",
    "rank": 6,
    "artist": "Brian Eno",
    "title": "Deep Blue Day",
    "year": 1983,
    "imageUrl": "https://upload.wikimedia.org/wikipedia/en/a/a0/Brianenoapollo.jpg",
    "embeds": [
      {
        "platform": "youtube",
        "url": "https://www.youtube.com/watch?v=Yla9PJvTU6Y"
      }
    ],
    "commentary": "La hizo con Daniel Lanois y su hermano Roger para For All Mankind, un documental sobre el programa Apollo. Terminó siendo la pieza más acuática de un disco sobre el espacio, con pedal steel guitar flotando encima de todo. Casi todo mundo la conoce por la escena del baño en Trainspotting."
  },
  {
    "kind": "track",
    "rank": 7,
    "artist": "Herbie Hancock",
    "title": "Maiden Voyage",
    "year": 1965,
    "imageUrl": "https://upload.wikimedia.org/wikipedia/en/7/7a/Maiden_Voyage_%28Hancock%29.jpg",
    "embeds": [
      {
        "platform": "youtube",
        "url": "https://www.youtube.com/watch?v=S6OdWfecdE0"
      }
    ],
    "commentary": "Grabado por Rudy Van Gelder en marzo del 65, con Freddie Hubbard, George Coleman, Ron Carter y Tony Williams. Hancock lo pensó como un disco sobre el mar y de ahí salió el acorde suspendido que desde entonces significa «esto flota». Medio siglo después, casi todo lo que suena a agua en esta lista le debe algo."
  },
  {
    "kind": "track",
    "rank": 8,
    "artist": "David Wise",
    "title": "Aquatic Ambience",
    "year": 1994,
    "imageUrl": "https://img.youtube.com/vi/j_GRUdeqpoc/maxresdefault.jpg",
    "embeds": [
      {
        "platform": "youtube",
        "url": "https://www.youtube.com/watch?v=j_GRUdeqpoc"
      }
    ],
    "commentary": "Wise se tardó cinco semanas y la armó en un Korg Wavestation, agarrando ocho formas de onda y tocándolas en secuencia. Hay quien le dice el «Eleanor Rigby» de la música de videojuegos: Trent Reznor la ha elogiado y Childish Gambino la sampleó en «Eat Your Vegetables» en 2012. Que la mejor pieza de esta lista haya salido de un cartucho de SNES es de las cosas que más me gusta contar."
  },
  {
    "kind": "divider"
  },
  {
    "kind": "p",
    "text": "Quedaron fuera «Under Ice» de Kate Bush, Debussy con «La cathédrale engloutie», «Pacific State» de 808 State con todo y gaviotas, el disco entero de Loscil nombrado por submarinos, y «Oceania» de Björk. Dato para cerrar: cuando Nintendo sacó su app de música en octubre de 2024, Aquatic Ambience venía adentro desde el primer día."
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
