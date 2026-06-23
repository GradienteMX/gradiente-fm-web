-- 0031_seed_partners.sql
-- Bulk-seed the partner rail with 62 scene partners (labels, venues,
-- collectives, promoters, festivals, media, dealers). Generated from
-- data/partners.csv. Primary link (partner_url) follows the per-type rule:
-- labels -> Bandcamp, venues -> Instagram, collectives/mix-series -> SoundCloud.
-- 21 have a logo in public/partners/ (image_url); the rest render the
-- placeholder box until logos are added (many sources are Instagram, which
-- can't be scraped automatically — upload those via the admin composer).
--
-- Idempotent: ON CONFLICT (slug) DO NOTHING. vibe_min/max required but
-- meaningless for partners -> neutral 5. Requires enum values from 0030.

insert into items
  (id, slug, type, title, vibe_min, vibe_max, genres, tags, image_url,
   published_at, partner_kind, partner_url, partner_last_updated, published, seed)
values
  ('pa-clima-calido', 'clima-calido', 'partner', 'Clima Cálido', 5, 5, '{}', '{}', null, '2026-06-22T12:00:00+00:00', 'promoter', null, '2026-06-22T12:00:00+00:00', true, false),
  ('pa-meditatio-sonus', 'meditatio-sonus', 'partner', 'Meditatio Sonus', 5, 5, '{}', '{}', null, '2026-06-22T12:00:00+00:00', 'promoter', 'https://www.instagram.com/meditatio_sonus', '2026-06-22T12:00:00+00:00', true, false),
  ('pa-dance-your-name', 'dance-your-name', 'partner', 'Dance Your Name', 5, 5, '{}', '{}', null, '2026-06-22T12:00:00+00:00', 'promoter', null, '2026-06-22T12:00:00+00:00', true, false),
  ('pa-cuatro-cuartos-bestial-crew', 'cuatro-cuartos-bestial-crew', 'partner', 'Cuatro Cuartos Bestial Crew', 5, 5, '{}', '{}', null, '2026-06-22T12:00:00+00:00', 'colectivo', null, '2026-06-22T12:00:00+00:00', true, false),
  ('pa-mixtlan', 'mixtlan', 'partner', 'Mixtlán', 5, 5, '{}', '{}', null, '2026-06-22T12:00:00+00:00', 'promoter', 'https://ra.co/promoters/mx/mexicocity', '2026-06-22T12:00:00+00:00', true, false),
  ('pa-lichi', 'lichi', 'partner', 'Lichi', 5, 5, '{}', '{}', null, '2026-06-22T12:00:00+00:00', 'colectivo', null, '2026-06-22T12:00:00+00:00', true, false),
  ('pa-wvwv', 'wvwv', 'partner', 'wvwv', 5, 5, '{}', '{}', '/partners/wvwv.jpg', '2026-06-22T12:00:00+00:00', 'label', 'https://wvwv.bandcamp.com/', '2026-06-22T12:00:00+00:00', true, false),
  ('pa-ultradisko', 'ultradisko', 'partner', 'Ultradisko', 5, 5, '{}', '{}', null, '2026-06-22T12:00:00+00:00', 'promoter', null, '2026-06-22T12:00:00+00:00', true, false),
  ('pa-funk', 'funk', 'partner', 'funk', 5, 5, '{}', '{}', null, '2026-06-22T12:00:00+00:00', 'club', null, '2026-06-22T12:00:00+00:00', true, false),
  ('pa-honest-allies', 'honest-allies', 'partner', 'honest allies', 5, 5, '{}', '{}', null, '2026-06-22T12:00:00+00:00', 'promoter', null, '2026-06-22T12:00:00+00:00', true, false),
  ('pa-capricho', 'capricho', 'partner', 'capricho', 5, 5, '{}', '{}', null, '2026-06-22T12:00:00+00:00', 'promoter', null, '2026-06-22T12:00:00+00:00', true, false),
  ('pa-noche-negra', 'noche-negra', 'partner', 'Noche Negra', 5, 5, '{}', '{}', null, '2026-06-22T12:00:00+00:00', 'promoter', null, '2026-06-22T12:00:00+00:00', true, false),
  ('pa-melodykrafter', 'melodykrafter', 'partner', 'Melodykrafter', 5, 5, '{}', '{}', '/partners/melodykrafter.jpg', '2026-06-22T12:00:00+00:00', 'label', 'https://melodykrafter.bandcamp.com/', '2026-06-22T12:00:00+00:00', true, false),
  ('pa-avant-garde-institute', 'avant-garde-institute', 'partner', 'Avant Garde Institute', 5, 5, '{}', '{}', '/partners/avant-garde-institute.jpg', '2026-06-22T12:00:00+00:00', 'colectivo', 'https://avant-garde-institute.bandcamp.com/', '2026-06-22T12:00:00+00:00', true, false),
  ('pa-makossa-disco', 'makossa-disco', 'partner', 'Makossa Disco', 5, 5, '{}', '{}', null, '2026-06-22T12:00:00+00:00', 'label', null, '2026-06-22T12:00:00+00:00', true, false),
  ('pa-rat-back-crew', 'rat-back-crew', 'partner', 'Rat Back Crew', 5, 5, '{}', '{}', '/partners/rat-back-crew.jpg', '2026-06-22T12:00:00+00:00', 'colectivo', 'https://soundcloud.com/rat-back-crew', '2026-06-22T12:00:00+00:00', true, false),
  ('pa-saundo', 'saundo', 'partner', 'Saundo', 5, 5, '{}', '{}', '/partners/saundo.jpg', '2026-06-22T12:00:00+00:00', 'promoter', 'https://www.instagram.com/saundo.studio_', '2026-06-22T12:00:00+00:00', true, false),
  ('pa-ssensorial', 'ssensorial', 'partner', 'Ssensorial', 5, 5, '{}', '{}', null, '2026-06-22T12:00:00+00:00', 'promoter', null, '2026-06-22T12:00:00+00:00', true, false),
  ('pa-amigos-de-amigos', 'amigos-de-amigos', 'partner', 'Amigos de Amigos', 5, 5, '{}', '{}', null, '2026-06-22T12:00:00+00:00', 'festival', null, '2026-06-22T12:00:00+00:00', true, false),
  ('pa-antimateria-sonora', 'antimateria-sonora', 'partner', 'Antimateria Sonora', 5, 5, '{}', '{}', '/partners/antimateria-sonora.jpg', '2026-06-22T12:00:00+00:00', 'colectivo', 'https://soundcloud.com/antimateriasonora', '2026-06-22T12:00:00+00:00', true, false),
  ('pa-ufo-camp', 'ufo-camp', 'partner', 'UFO Camp!', 5, 5, '{}', '{}', null, '2026-06-22T12:00:00+00:00', 'festival', null, '2026-06-22T12:00:00+00:00', true, false),
  ('pa-mental', 'mental', 'partner', 'Mental', 5, 5, '{}', '{}', null, '2026-06-22T12:00:00+00:00', 'festival', null, '2026-06-22T12:00:00+00:00', true, false),
  ('pa-rey-vinilo', 'rey-vinilo', 'partner', 'Rey Vinilo', 5, 5, '{}', '{}', null, '2026-06-22T12:00:00+00:00', 'label', 'https://reyvinilo.com/', '2026-06-22T12:00:00+00:00', true, false),
  ('pa-ephemera', 'ephemera', 'partner', 'ephemera', 5, 5, '{}', '{}', null, '2026-06-22T12:00:00+00:00', 'label', null, '2026-06-22T12:00:00+00:00', true, false),
  ('pa-casa-del-lago', 'casa-del-lago', 'partner', 'Casa Del Lago', 5, 5, '{}', '{}', null, '2026-06-22T12:00:00+00:00', 'colectivo', 'https://casadellago.unam.mx/', '2026-06-22T12:00:00+00:00', true, false),
  ('pa-jungle-empire', 'jungle-empire', 'partner', 'Jungle Empire', 5, 5, '{}', '{}', '/partners/jungle-empire.jpg', '2026-06-22T12:00:00+00:00', 'colectivo', 'https://soundcloud.com/jungleempiremx', '2026-06-22T12:00:00+00:00', true, false),
  ('pa-low-freq-mx', 'low-freq-mx', 'partner', 'low freq mx', 5, 5, '{}', '{}', '/partners/low-freq-mx.jpg', '2026-06-22T12:00:00+00:00', 'colectivo', 'https://soundcloud.com/lowfreqmx', '2026-06-22T12:00:00+00:00', true, false),
  ('pa-mvmpmp', 'mvmpmp', 'partner', 'MVMPMP', 5, 5, '{}', '{}', null, '2026-06-22T12:00:00+00:00', 'label', null, '2026-06-22T12:00:00+00:00', true, false),
  ('pa-rei-room', 'rei-room', 'partner', 'rei room', 5, 5, '{}', '{}', null, '2026-06-22T12:00:00+00:00', 'venue', null, '2026-06-22T12:00:00+00:00', true, false),
  ('pa-relink-data', 'relink-data', 'partner', 'relink data', 5, 5, '{}', '{}', null, '2026-06-22T12:00:00+00:00', 'venue', null, '2026-06-22T12:00:00+00:00', true, false),
  ('pa-deposito-sonoro', 'deposito-sonoro', 'partner', 'deposito sonoro', 5, 5, '{}', '{}', '/partners/deposito-sonoro.jpg', '2026-06-22T12:00:00+00:00', 'medios', 'https://depositosonoro.com/', '2026-06-22T12:00:00+00:00', true, false),
  ('pa-mwamwa', 'mwamwa', 'partner', 'mwamwa', 5, 5, '{}', '{}', '/partners/mwamwa.jpg', '2026-06-22T12:00:00+00:00', 'label', 'https://mwamwa.bandcamp.com/', '2026-06-22T12:00:00+00:00', true, false),
  ('pa-cjantal', 'cjantal', 'partner', 'cjantal', 5, 5, '{}', '{}', '/partners/cjantal.jpg', '2026-06-22T12:00:00+00:00', 'label', 'https://cjantal.bandcamp.com/', '2026-06-22T12:00:00+00:00', true, false),
  ('pa-raxtion-music', 'raxtion-music', 'partner', 'Raxtion Music', 5, 5, '{}', '{}', '/partners/raxtion-music.jpg', '2026-06-22T12:00:00+00:00', 'label', 'https://raxtion.bandcamp.com/', '2026-06-22T12:00:00+00:00', true, false),
  ('pa-artistas-desconocidos', 'artistas-desconocidos', 'partner', 'Artistas Desconocidos', 5, 5, '{}', '{}', null, '2026-06-22T12:00:00+00:00', 'label', null, '2026-06-22T12:00:00+00:00', true, false),
  ('pa-infinite-machine', 'infinite-machine', 'partner', 'infinite machine', 5, 5, '{}', '{}', '/partners/infinite-machine.jpg', '2026-06-22T12:00:00+00:00', 'label', 'https://infinitemachine.bandcamp.com/', '2026-06-22T12:00:00+00:00', true, false),
  ('pa-maricas-records', 'maricas-records', 'partner', 'maricas records', 5, 5, '{}', '{}', '/partners/maricas-records.jpg', '2026-06-22T12:00:00+00:00', 'label', 'https://maricasrecords.bandcamp.com/', '2026-06-22T12:00:00+00:00', true, false),
  ('pa-ensamble', 'ensamble', 'partner', 'ensamble', 5, 5, '{}', '{}', null, '2026-06-22T12:00:00+00:00', 'label', 'https://ensamblerecords.bandcamp.com/', '2026-06-22T12:00:00+00:00', true, false),
  ('pa-duro', 'duro', 'partner', 'duro', 5, 5, '{}', '{}', '/partners/duro.jpg', '2026-06-22T12:00:00+00:00', 'label', 'https://durolabel.bandcamp.com/', '2026-06-22T12:00:00+00:00', true, false),
  ('pa-uauh', 'uauh', 'partner', 'UAUH', 5, 5, '{}', '{}', '/partners/uauh.jpg', '2026-06-22T12:00:00+00:00', 'label', 'https://uauhwow.bandcamp.com/', '2026-06-22T12:00:00+00:00', true, false),
  ('pa-ten-toes', 'ten-toes', 'partner', 'TEN TOES', 5, 5, '{}', '{}', '/partners/ten-toes.jpg', '2026-06-22T12:00:00+00:00', 'label', 'https://tentoesturbo.bandcamp.com/', '2026-06-22T12:00:00+00:00', true, false),
  ('pa-tra-tra', 'tra-tra', 'partner', 'tra tra', 5, 5, '{}', '{}', '/partners/tra-tra.jpg', '2026-06-22T12:00:00+00:00', 'label', 'https://tratratrax.bandcamp.com/', '2026-06-22T12:00:00+00:00', true, false),
  ('pa-dark-side-records-mx', 'dark-side-records-mx', 'partner', 'dark side records mx', 5, 5, '{}', '{}', null, '2026-06-22T12:00:00+00:00', 'label', null, '2026-06-22T12:00:00+00:00', true, false),
  ('pa-cdisidente', 'cdisidente', 'partner', 'CDisidente', 5, 5, '{}', '{}', null, '2026-06-22T12:00:00+00:00', 'label', null, '2026-06-22T12:00:00+00:00', true, false),
  ('pa-tumba-7', 'tumba-7', 'partner', 'Tumba 7', 5, 5, '{}', '{}', '/partners/tumba-7.jpg', '2026-06-22T12:00:00+00:00', 'label', 'https://tumba7tapes.bandcamp.com/', '2026-06-22T12:00:00+00:00', true, false),
  ('pa-ruido', 'ruido', 'partner', 'Ruido', 5, 5, '{}', '{}', null, '2026-06-22T12:00:00+00:00', 'label', null, '2026-06-22T12:00:00+00:00', true, false),
  ('pa-resonancias', 'resonancias', 'partner', 'Resonancias', 5, 5, '{}', '{}', null, '2026-06-22T12:00:00+00:00', 'label', null, '2026-06-22T12:00:00+00:00', true, false),
  ('pa-brutal-mx', 'brutal-mx', 'partner', 'Brutal MX', 5, 5, '{}', '{}', null, '2026-06-22T12:00:00+00:00', 'venue', 'https://www.instagram.com/brutal__mx', '2026-06-22T12:00:00+00:00', true, false),
  ('pa-memoria-local', 'memoria-local', 'partner', 'memoria local', 5, 5, '{}', '{}', null, '2026-06-22T12:00:00+00:00', 'colectivo', null, '2026-06-22T12:00:00+00:00', true, false),
  ('pa-caliente-mex', 'caliente-mex', 'partner', 'Caliente_mex', 5, 5, '{}', '{}', null, '2026-06-22T12:00:00+00:00', 'colectivo', 'https://www.instagram.com/caliente_mex', '2026-06-22T12:00:00+00:00', true, false),
  ('pa-abditorymexico', 'abditorymexico', 'partner', 'abditorymexico', 5, 5, '{}', '{}', null, '2026-06-22T12:00:00+00:00', 'colectivo', 'https://www.instagram.com/abditorymexico', '2026-06-22T12:00:00+00:00', true, false),
  ('pa-loose-blues', 'loose-blues', 'partner', 'Loose Blues', 5, 5, '{}', '{}', null, '2026-06-22T12:00:00+00:00', 'venue', 'https://www.instagram.com/loose_blues', '2026-06-22T12:00:00+00:00', true, false),
  ('pa-maad-store', 'maad-store', 'partner', 'Maad Store', 5, 5, '{}', '{}', null, '2026-06-22T12:00:00+00:00', 'dealer', 'https://www.instagram.com/maadstoremx', '2026-06-22T12:00:00+00:00', true, false),
  ('pa-revancha', 'revancha', 'partner', 'Revancha', 5, 5, '{}', '{}', '/partners/revancha.svg', '2026-06-22T12:00:00+00:00', 'dealer', 'https://revanchadf.com/', '2026-06-22T12:00:00+00:00', true, false),
  ('pa-sin-ap-sis', 'sin-ap-sis', 'partner', 'sin.ap.sis', 5, 5, '{}', '{}', null, '2026-06-22T12:00:00+00:00', 'colectivo', 'https://www.instagram.com/sin.ap.sis', '2026-06-22T12:00:00+00:00', true, false),
  ('pa-winona', 'winona', 'partner', 'Winona', 5, 5, '{}', '{}', null, '2026-06-22T12:00:00+00:00', 'venue', 'https://www.instagram.com/winona_por_siempre', '2026-06-22T12:00:00+00:00', true, false),
  ('pa-sonidero-sabotaje', 'sonidero-sabotaje', 'partner', 'Sonidero Sabotaje', 5, 5, '{}', '{}', null, '2026-06-22T12:00:00+00:00', 'colectivo', null, '2026-06-22T12:00:00+00:00', true, false),
  ('pa-encarta-97', 'encarta-97', 'partner', 'Encarta 97', 5, 5, '{}', '{}', '/partners/encarta-97.jpg', '2026-06-22T12:00:00+00:00', 'mix-series', 'https://soundcloud.com/encarta-97', '2026-06-22T12:00:00+00:00', true, false),
  ('pa-maquina-simple-ediciones', 'maquina-simple-ediciones', 'partner', 'Maquina Simple Ediciones', 5, 5, '{}', '{}', null, '2026-06-22T12:00:00+00:00', 'medios', 'https://www.instagram.com/maquinasimpleediciones', '2026-06-22T12:00:00+00:00', true, false),
  ('pa-vaneechi', 'vaneechi', 'partner', 'Vaneechi', 5, 5, '{}', '{}', null, '2026-06-22T12:00:00+00:00', 'medios', 'https://www.instagram.com/vaneechi', '2026-06-22T12:00:00+00:00', true, false),
  ('pa-las-clementinas', 'las-clementinas', 'partner', 'Las Clementinas', 5, 5, '{}', '{}', null, '2026-06-22T12:00:00+00:00', 'venue', 'https://www.instagram.com/lasclementinas', '2026-06-22T12:00:00+00:00', true, false),
  ('pa-disco-esencia', 'disco-esencia', 'partner', 'Disco Esencia', 5, 5, '{}', '{}', null, '2026-06-22T12:00:00+00:00', 'colectivo', null, '2026-06-22T12:00:00+00:00', true, false)
on conflict (slug) do nothing;
