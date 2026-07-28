import type { Genre, Tag } from './types'

// ── Genre taxonomy ──────────────────────────────────────────────────────────
//
// Two-level hierarchy (Option B from `Vibe Philosophy`): items tag with
// LEAF subgenre ids; PARENT ids are derived. Filtering by a parent rolls
// up to match any of its descendants. Cross-listed leaves (e.g.
// "Industrial Dub" lives under both `techno` and `dub-reggae`) carry
// multiple parent linkages.
//
// Legacy ids from the pre-taxonomy catalog are preserved as `legacy: true`
// entries so existing DB rows stay resolvable. New items should adopt the
// new ids; `LEGACY_ALIASES` maps the closest semantic equivalents.

// ── Top-level categories (22 roots) ────────────────────────────────────────

const ROOTS: Genre[] = [
  { id: 'techno', name: 'Techno', parents: [] },
  { id: 'house', name: 'House', parents: [] },
  { id: 'dub-reggae', name: 'Dub / Reggae', parents: [] },
  { id: 'dnb-jungle', name: 'Drum & Bass / Jungle', parents: [] },
  { id: 'dubstep-uk', name: 'Dubstep / Post-Dubstep', parents: [] },
  { id: 'ambient-drone', name: 'Ambient / Drone', parents: [] },
  { id: 'krautrock-kosmische', name: 'Krautrock / Kosmische', parents: [] },
  { id: 'fourth-world', name: 'Fourth World / Sistemas', parents: [] },
  { id: 'lofi-bedroom', name: 'Lo-Fi / Cassette / Bedroom', parents: [] },
  { id: 'hyperpop-deconstructed', name: 'Hyperpop / Deconstruido', parents: [] },
  { id: 'industrial-ebm', name: 'Industrial / EBM / Cold Wave', parents: [] },
  { id: 'post-punk-shoegaze', name: 'Post-Punk / Goth / Shoegaze', parents: [] },
  { id: 'electronica-idm', name: 'Electrónica / IDM / Glitch', parents: [] },
  { id: 'jazz', name: 'Jazz', parents: [] },
  { id: 'soul-funk-rnb', name: 'Soul / Funk / R&B', parents: [] },
  { id: 'hip-hop-rap', name: 'Hip Hop / Rap', parents: [] },
  { id: 'musique-concrete', name: 'Música Concreta / Académica', parents: [] },
  { id: 'world-bass', name: 'World / Global Bass / Latinoamérica', parents: [] },
  { id: 'arab-swana', name: 'Árabe / SWANA', parents: [] },
  { id: 'traditional-folk', name: 'Tradicional / Folclórica', parents: [] },
  { id: 'world', name: 'World / Músicas del Mundo', parents: [] },
  { id: 'latin-electronica', name: 'Electrónica Latina', parents: [] },
  // — Added 2026-07: basics that were missing or only reachable through
  //   `legacy` ids. Sourced against the Discogs style list + Wikipedia.
  { id: 'disco-italo', name: 'Disco / Italo / Hi-NRG', parents: [] },
  { id: 'trance-family', name: 'Trance / Psy / Goa', parents: [] },
  { id: 'hardcore-hardstyle', name: 'Hardcore / Gabber / Hardstyle', parents: [] },
  { id: 'breakbeat-rave', name: 'Breakbeat / Rave', parents: [] },
  { id: 'triphop-downtempo', name: 'Trip Hop / Downtempo', parents: [] },
  { id: 'synthpop-newwave', name: 'Synth-Pop / New Wave / Synthwave', parents: [] },
  { id: 'vapor-hypnagogic', name: 'Vaporwave / Hipnagógico / Hauntología', parents: [] },
  { id: 'caribbean-dancehall', name: 'Dancehall / Soca / Caribe', parents: [] },
  { id: 'tropical-tradicional', name: 'Tropical / Latinoamericana Tradicional', parents: [] },
  { id: 'rock-pop', name: 'Rock / Pop', parents: [] },
  { id: 'punk-metal', name: 'Punk / Metal / Hardcore', parents: [] },
  { id: 'clasica-contemporanea', name: 'Clásica / Contemporánea', parents: [] },
  { id: 'blues-gospel-country', name: 'Blues / Gospel / Country', parents: [] },
]

// ── Subgenres (leaves) ─────────────────────────────────────────────────────

const SUBGENRES: Genre[] = [
  // TECHNO
  { id: 'techno-industrial', name: 'Industrial Techno', parents: ['techno', 'industrial-ebm'] },
  { id: 'techno-industrial-dub', name: 'Industrial Dub', parents: ['techno', 'dub-reggae', 'industrial-ebm'] },
  { id: 'techno-broken', name: 'Broken Techno', parents: ['techno'] },
  { id: 'techno-hard', name: 'Hard Techno', parents: ['techno'] },
  { id: 'techno-acid', name: 'Acid Techno', parents: ['techno'] },
  { id: 'techno-minimal', name: 'Minimal Techno', parents: ['techno'] },
  { id: 'techno-dub', name: 'Dub Techno', parents: ['techno', 'dub-reggae'] },
  { id: 'techno-ambient', name: 'Ambient Techno', parents: ['techno', 'ambient-drone'] },
  { id: 'techno-experimental', name: 'Experimental Techno', parents: ['techno'] },
  { id: 'techno-hypnotic', name: 'Hypnotic Techno', parents: ['techno'] },
  { id: 'techno-detroit', name: 'Detroit Techno', parents: ['techno'] },
  { id: 'techno-melodic', name: 'Melodic Techno', parents: ['techno'] },

  // HOUSE
  { id: 'house-deep', name: 'Deep House', parents: ['house'] },
  { id: 'house-acid', name: 'Acid House', parents: ['house'] },
  { id: 'house-chicago', name: 'Chicago House', parents: ['house'] },
  { id: 'house-afro', name: 'Afro House', parents: ['house'] },
  { id: 'house-tech', name: 'Tech House', parents: ['house'] },
  { id: 'house-minimal', name: 'Minimal House', parents: ['house'] },
  { id: 'house-lofi', name: 'Lo-fi House', parents: ['house', 'lofi-bedroom'] },
  { id: 'house-experimental', name: 'Experimental House', parents: ['house'] },
  { id: 'house-electroacoustic', name: 'Electroacoustic House', parents: ['house'] },

  // DUB / REGGAE (those not cross-listed under TECHNO)
  { id: 'dub-roots', name: 'Roots Dub', parents: ['dub-reggae'] },
  { id: 'dub-electronic', name: 'Dub Electrónico', parents: ['dub-reggae'] },
  { id: 'dub-steppers', name: 'Steppers', parents: ['dub-reggae'] },
  { id: 'reggae-lovers-rock', name: 'Lovers Rock', parents: ['dub-reggae'] },
  { id: 'reggae', name: 'Reggae', parents: ['dub-reggae'] },
  { id: 'reggae-digital', name: 'Digital Reggae', parents: ['dub-reggae'] },
  { id: 'soundsystem-culture', name: 'Soundsystem Culture', parents: ['dub-reggae'] },

  // DRUM & BASS / JUNGLE
  { id: 'dnb-liquid', name: 'Liquid Drum & Bass', parents: ['dnb-jungle'] },
  { id: 'dnb-neurofunk', name: 'Neurofunk', parents: ['dnb-jungle'] },
  { id: 'dnb-jump-up', name: 'Jump-Up', parents: ['dnb-jungle'] },
  { id: 'jungle', name: 'Jungle', parents: ['dnb-jungle'] },
  { id: 'dnb-darkstep', name: 'Darkstep', parents: ['dnb-jungle'] },
  { id: 'dnb-techstep', name: 'Techstep', parents: ['dnb-jungle'] },
  { id: 'dnb-atmospheric', name: 'Atmospheric DnB', parents: ['dnb-jungle'] },
  { id: 'dnb-halftime', name: 'Halftime', parents: ['dnb-jungle'] },
  { id: 'footwork-juke', name: 'Footwork / Juke', parents: ['dnb-jungle'] },

  // DUBSTEP / POST-DUBSTEP
  { id: 'post-dubstep', name: 'Post-Dubstep', parents: ['dubstep-uk'] },
  { id: 'grime', name: 'Grime', parents: ['dubstep-uk'] },
  { id: 'brostep', name: 'Brostep', parents: ['dubstep-uk'] },
  { id: 'dark-garage', name: 'Dark Garage', parents: ['dubstep-uk'] },
  { id: 'future-garage', name: 'Future Garage', parents: ['dubstep-uk'] },
  { id: 'bass-music', name: 'Bass Music', parents: ['dubstep-uk'] },
  { id: 'uk-garage', name: 'UK Garage', parents: ['dubstep-uk'] },
  { id: 'two-step', name: '2-Step', parents: ['dubstep-uk'] },

  // AMBIENT / DRONE
  { id: 'ambient', name: 'Ambient', parents: ['ambient-drone'] },
  { id: 'ambient-industrial', name: 'Ambient Industrial', parents: ['ambient-drone', 'industrial-ebm'] },
  { id: 'ambient-degradado', name: 'Ambient Degradado', parents: ['ambient-drone'] },
  { id: 'ambient-ruidoso', name: 'Ambient Ruidoso', parents: ['ambient-drone'] },
  { id: 'ambient-sacro', name: 'Ambient Sacro', parents: ['ambient-drone'] },
  { id: 'ambient-tropical', name: 'Ambient Tropical', parents: ['ambient-drone'] },
  { id: 'ambient-folklorico', name: 'Ambient Folklórico', parents: ['ambient-drone'] },
  { id: 'ambient-post-rave', name: 'Ambient Post-Rave', parents: ['ambient-drone'] },
  { id: 'ambient-dub', name: 'Ambient Dub', parents: ['ambient-drone', 'dub-reggae'] },
  { id: 'ambient-granular', name: 'Ambient Granular', parents: ['ambient-drone'] },
  { id: 'ambient-maximalista', name: 'Ambient Maximalista', parents: ['ambient-drone'] },
  { id: 'ambient-latinoamericano', name: 'Ambient Latinoamericano', parents: ['ambient-drone'] },
  { id: 'dark-ambient', name: 'Dark Ambient', parents: ['ambient-drone'] },
  { id: 'drone', name: 'Drone', parents: ['ambient-drone'] },
  { id: 'environmental', name: 'Environmental Music', parents: ['ambient-drone'] },
  { id: 'hauntology', name: 'Hauntology', parents: ['ambient-drone', 'vapor-hypnagogic'] },
  { id: 'new-age', name: 'New Age (revalorizado)', parents: ['ambient-drone'] },

  // KRAUTROCK / KOSMISCHE
  { id: 'krautrock', name: 'Krautrock', parents: ['krautrock-kosmische'] },
  { id: 'kosmische', name: 'Kosmische Musik', parents: ['krautrock-kosmische'] },
  { id: 'motorik', name: 'Motorik', parents: ['krautrock-kosmische'] },
  { id: 'kraut-electronico', name: 'Kraut-Electrónico', parents: ['krautrock-kosmische'] },
  { id: 'proto-ambient', name: 'Proto-Ambient', parents: ['krautrock-kosmische', 'ambient-drone'] },
  { id: 'neue-deutsche-welle', name: 'Neue Deutsche Welle', parents: ['krautrock-kosmische'] },

  // FOURTH WORLD / SISTEMAS
  { id: 'fourth-world-music', name: 'Fourth World', parents: ['fourth-world'] },
  { id: 'systems-music', name: 'Systems Music', parents: ['fourth-world'] },
  { id: 'minimalismo-clasico', name: 'Minimalismo Clásico', parents: ['fourth-world'] },
  { id: 'exotica', name: 'Exotica', parents: ['fourth-world'] },
  { id: 'tropical-ambient', name: 'Tropical Ambient', parents: ['fourth-world', 'ambient-drone'] },
  { id: 'musique-d-ameublement', name: "Musique d'Ameublement", parents: ['fourth-world'] },
  { id: 'library-music', name: 'Library Music', parents: ['fourth-world'] },
  { id: 'radiophonic', name: 'Radiophonic', parents: ['fourth-world'] },
  { id: 'spectralism', name: 'Spectralism', parents: ['fourth-world', 'musique-concrete'] },

  // LO-FI / CASSETTE / BEDROOM
  { id: 'lo-fi', name: 'Lo-fi', parents: ['lofi-bedroom'] },
  { id: 'lo-fi-hip-hop', name: 'Lo-fi Hip Hop', parents: ['lofi-bedroom', 'hip-hop-rap'] },
  { id: 'bedroom-pop', name: 'Bedroom Pop', parents: ['lofi-bedroom'] },
  { id: 'cassette-culture', name: 'Cassette Culture', parents: ['lofi-bedroom'] },
  { id: 'vaporwave', name: 'Vaporwave', parents: ['lofi-bedroom', 'vapor-hypnagogic'] },
  { id: 'chillwave', name: 'Chillwave', parents: ['lofi-bedroom', 'vapor-hypnagogic'] },
  { id: 'seapunk', name: 'Seapunk', parents: ['lofi-bedroom'] },
  { id: 'outsider-music', name: 'Outsider Music', parents: ['lofi-bedroom'] },
  { id: 'home-recording', name: 'Home Recording', parents: ['lofi-bedroom'] },

  // HYPERPOP / DECONSTRUCTED CLUB
  { id: 'hyperpop', name: 'Hyperpop', parents: ['hyperpop-deconstructed'] },
  { id: 'pc-music', name: 'PC Music', parents: ['hyperpop-deconstructed'] },
  { id: 'digicore', name: 'Digicore', parents: ['hyperpop-deconstructed'] },
  { id: 'bubblegum-bass', name: 'Bubblegum Bass', parents: ['hyperpop-deconstructed'] },
  { id: 'nightcore', name: 'Nightcore', parents: ['hyperpop-deconstructed'] },
  { id: 'deconstructed-club', name: 'Deconstructed Club', parents: ['hyperpop-deconstructed'] },
  { id: 'club-experimental', name: 'Club Experimental', parents: ['hyperpop-deconstructed'] },
  { id: 'ballroom-vogue', name: 'Ballroom / Vogue', parents: ['hyperpop-deconstructed'] },
  { id: 'jersey-club', name: 'Jersey Club', parents: ['hyperpop-deconstructed'] },

  // INDUSTRIAL / EBM / COLD WAVE
  { id: 'industrial', name: 'Industrial', parents: ['industrial-ebm'] },
  { id: 'ebm', name: 'EBM (Electronic Body Music)', parents: ['industrial-ebm'] },
  { id: 'cold-wave', name: 'Cold Wave', parents: ['industrial-ebm', 'post-punk-shoegaze'] },
  { id: 'dark-wave', name: 'Dark Wave', parents: ['industrial-ebm', 'post-punk-shoegaze'] },
  { id: 'post-industrial', name: 'Post-Industrial', parents: ['industrial-ebm'] },
  { id: 'death-industrial', name: 'Death Industrial', parents: ['industrial-ebm'] },
  { id: 'martial-industrial', name: 'Martial Industrial', parents: ['industrial-ebm'] },
  { id: 'power-electronics', name: 'Power Electronics', parents: ['industrial-ebm'] },
  { id: 'noise', name: 'Noise', parents: ['industrial-ebm'] },

  // POST-PUNK / GOTH / SHOEGAZE
  { id: 'post-punk', name: 'Post-Punk', parents: ['post-punk-shoegaze'] },
  { id: 'post-punk-revival', name: 'Post-Punk Revival', parents: ['post-punk-shoegaze'] },
  { id: 'goth-rock', name: 'Goth Rock', parents: ['post-punk-shoegaze'] },
  { id: 'deathrock', name: 'Deathrock', parents: ['post-punk-shoegaze'] },
  { id: 'no-wave', name: 'No Wave', parents: ['post-punk-shoegaze'] },
  { id: 'noise-rock', name: 'Noise Rock', parents: ['post-punk-shoegaze'] },
  { id: 'industrial-rock', name: 'Industrial Rock', parents: ['post-punk-shoegaze', 'industrial-ebm'] },
  { id: 'shoegaze', name: 'Shoegaze', parents: ['post-punk-shoegaze'] },
  { id: 'dream-pop', name: 'Dream Pop', parents: ['post-punk-shoegaze'] },
  { id: 'slowcore', name: 'Slowcore', parents: ['post-punk-shoegaze'] },
  { id: 'post-rock', name: 'Post-Rock', parents: ['post-punk-shoegaze'] },
  { id: 'math-rock', name: 'Math Rock', parents: ['post-punk-shoegaze'] },

  // ELECTRÓNICA / IDM / GLITCH
  { id: 'idm', name: 'IDM (Intelligent Dance Music)', parents: ['electronica-idm'] },
  { id: 'braindance', name: 'Braindance', parents: ['electronica-idm'] },
  { id: 'breakcore', name: 'Breakcore', parents: ['electronica-idm'] },
  { id: 'glitch', name: 'Glitch', parents: ['electronica-idm'] },
  { id: 'microsound', name: 'Microsound', parents: ['electronica-idm'] },
  { id: 'electro', name: 'Electro', parents: ['electronica-idm'] },
  { id: 'electro-funk', name: 'Electro-Funk', parents: ['electronica-idm', 'soul-funk-rnb'] },

  // JAZZ
  { id: 'jazz-contemporaneo', name: 'Jazz Contemporáneo', parents: ['jazz'] },
  { id: 'free-jazz', name: 'Free Jazz', parents: ['jazz'] },
  { id: 'jazz-fusion', name: 'Jazz Fusión', parents: ['jazz'] },
  { id: 'jazz-modal', name: 'Jazz Modal', parents: ['jazz'] },
  { id: 'jazz-electrico', name: 'Jazz Eléctrico', parents: ['jazz'] },
  { id: 'nu-jazz', name: 'Nu-Jazz', parents: ['jazz'] },
  { id: 'spiritual-jazz', name: 'Spiritual Jazz', parents: ['jazz'] },
  { id: 'jazz-avant-garde', name: 'Jazz Avant-Garde', parents: ['jazz'] },
  { id: 'jazz-latino', name: 'Jazz Latino', parents: ['jazz', 'world-bass'] },
  { id: 'jazz-rap', name: 'Jazz Rap', parents: ['jazz', 'hip-hop-rap'] },
  { id: 'improvisacion-libre', name: 'Improvisación Libre', parents: ['jazz', 'musique-concrete'] },

  // SOUL / FUNK / R&B
  { id: 'soul', name: 'Soul', parents: ['soul-funk-rnb'] },
  { id: 'neo-soul', name: 'Neo-Soul', parents: ['soul-funk-rnb'] },
  { id: 'funk', name: 'Funk', parents: ['soul-funk-rnb'] },
  { id: 'p-funk', name: 'P-Funk', parents: ['soul-funk-rnb'] },
  { id: 'afrofuturismo', name: 'Afrofuturismo', parents: ['soul-funk-rnb'] },
  { id: 'rnb-contemporaneo', name: 'R&B Contemporáneo', parents: ['soul-funk-rnb'] },
  { id: 'pbr-and-b', name: 'PBR&B', parents: ['soul-funk-rnb'] },
  { id: 'boogie', name: 'Boogie', parents: ['soul-funk-rnb'] },

  // HIP HOP / RAP
  { id: 'hip-hop-underground', name: 'Hip Hop Underground', parents: ['hip-hop-rap'] },
  { id: 'rap-experimental', name: 'Rap Experimental', parents: ['hip-hop-rap'] },
  { id: 'abstract-hip-hop', name: 'Abstract Hip Hop', parents: ['hip-hop-rap'] },
  { id: 'hip-hop-instrumental', name: 'Hip Hop Instrumental', parents: ['hip-hop-rap'] },
  { id: 'cloud-rap', name: 'Cloud Rap', parents: ['hip-hop-rap'] },
  { id: 'drill', name: 'Drill', parents: ['hip-hop-rap'] },
  { id: 'trap-experimental', name: 'Trap Experimental', parents: ['hip-hop-rap'] },
  { id: 'chopped-and-screwed', name: 'Chopped & Screwed', parents: ['hip-hop-rap'] },

  // MÚSICA CONCRETA / ACADÉMICA
  { id: 'musique-concrete-music', name: 'Musique Concrète', parents: ['musique-concrete'] },
  { id: 'electroacustica', name: 'Electroacústica', parents: ['musique-concrete'] },
  { id: 'acusmatica', name: 'Acusmática', parents: ['musique-concrete'] },
  { id: 'computer-music', name: 'Computer Music', parents: ['musique-concrete'] },
  { id: 'sintesis-modular', name: 'Síntesis Modular', parents: ['musique-concrete'] },
  { id: 'live-coding', name: 'Live Coding / Algorítmico', parents: ['musique-concrete'] },
  { id: 'fluxus-happening', name: 'Fluxus / Happening', parents: ['musique-concrete'] },
  { id: 'spoken-word', name: 'Spoken Word / Poesía Sonora', parents: ['musique-concrete'] },

  // WORLD / GLOBAL BASS / LATINOAMÉRICA
  { id: 'afrobeat', name: 'Afrobeat', parents: ['world-bass'] },
  { id: 'afroelectronico', name: 'Afroelectrónico', parents: ['world-bass'] },
  { id: 'global-bass', name: 'Global Bass', parents: ['world-bass'] },
  { id: 'kuduro', name: 'Kuduro', parents: ['world-bass'] },
  { id: 'baile-funk', name: 'Baile Funk', parents: ['world-bass', 'latin-electronica'] },
  { id: 'dembow', name: 'Dembow', parents: ['world-bass', 'latin-electronica'] },
  { id: 'sonidero', name: 'Sonidero', parents: ['world-bass', 'latin-electronica'] },
  { id: 'tropical-bass', name: 'Tropical Bass', parents: ['world-bass', 'latin-electronica'] },
  { id: 'folktronica', name: 'Folktronica', parents: ['world-bass', 'latin-electronica'] },
  { id: 'cumbia-digital', name: 'Cumbia Digital', parents: ['world-bass', 'latin-electronica'] },
  { id: 'cumbia-sonidera', name: 'Cumbia Sonidera', parents: ['world-bass'] },
  { id: 'cumbia-villera', name: 'Cumbia Villera', parents: ['world-bass'] },
  { id: 'cumbia-experimental', name: 'Cumbia Experimental', parents: ['world-bass', 'latin-electronica'] },
  { id: 'raga-electronico', name: 'Raga Electrónico', parents: ['world-bass'] },
  { id: 'gagaku-contemporaneo', name: 'Gagaku Contemporáneo', parents: ['world-bass'] },
  { id: 'banda-contemporanea', name: 'Música de Banda (contemporánea)', parents: ['world-bass'] },
  { id: 'corrido-tumbado', name: 'Corrido Tumbado / Norteño-Trap', parents: ['world-bass'] },

  // ÁRABE / SWANA (South West Asia & North Africa)
  { id: 'arab-maqam', name: 'Maqam / Tarab', parents: ['arab-swana', 'traditional-folk'] },
  { id: 'arab-andalusi', name: 'Música Andalusí', parents: ['arab-swana', 'traditional-folk'] },
  { id: 'arab-gnawa', name: 'Gnawa', parents: ['arab-swana', 'traditional-folk'] },
  { id: 'arab-dabke', name: 'Dabke', parents: ['arab-swana'] },
  { id: 'arab-rai', name: 'Raï', parents: ['arab-swana'] },
  { id: 'arab-shaabi', name: 'Shaabi', parents: ['arab-swana'] },
  { id: 'arab-chaabi', name: 'Chaabi (Magrebí)', parents: ['arab-swana', 'traditional-folk'] },
  { id: 'arab-khaleeji', name: 'Khaleeji (Golfo)', parents: ['arab-swana'] },
  { id: 'arab-pop', name: 'Pop Árabe', parents: ['arab-swana'] },
  { id: 'arab-mahraganat', name: 'Mahraganat / Electro-Chaabi', parents: ['arab-swana', 'electronica-idm'] },
  { id: 'arab-electronic', name: 'Electrónica Árabe / SWANA', parents: ['arab-swana', 'electronica-idm'] },

  // TRADICIONAL / FOLCLÓRICA
  { id: 'musica-tradicional', name: 'Música Tradicional', parents: ['traditional-folk'] },
  { id: 'folk', name: 'Folk', parents: ['traditional-folk'] },
  { id: 'folclore-latinoamericano', name: 'Folclore Latinoamericano', parents: ['traditional-folk', 'world-bass'] },
  { id: 'son-jarocho', name: 'Son Jarocho', parents: ['traditional-folk', 'world-bass'] },
  { id: 'musica-andina', name: 'Música Andina', parents: ['traditional-folk', 'world'] },

  // WORLD / MÚSICAS DEL MUNDO
  { id: 'world-music', name: 'World Music', parents: ['world'] },
  { id: 'musicas-africanas', name: 'Músicas Africanas', parents: ['world'] },
  { id: 'musicas-asiaticas', name: 'Músicas Asiáticas', parents: ['world'] },
  { id: 'balkan-romani', name: 'Balcánica / Romani', parents: ['world', 'traditional-folk'] },

  // ELECTRÓNICA LATINA
  { id: 'neoperreo', name: 'Neoperreo', parents: ['latin-electronica', 'world-bass'] },
  { id: 'perreo-experimental', name: 'Perreo / Reggaetón Experimental', parents: ['latin-electronica'] },
  { id: 'guaracha-aleteo', name: 'Guaracha / Aleteo', parents: ['latin-electronica'] },
  { id: 'tribal-guarachero', name: 'Tribal Guarachero / 3Ball', parents: ['latin-electronica'] },
  { id: 'changa-tuki', name: 'Changa Tuki', parents: ['latin-electronica'] },
  { id: 'nu-cumbia', name: 'Nu Cumbia', parents: ['latin-electronica', 'world-bass'] },
  { id: 'electro-tropical', name: 'Electro Tropical', parents: ['latin-electronica', 'world-bass'] },
  { id: 'latin-bass', name: 'Latin Bass', parents: ['latin-electronica', 'world-bass'] },
  { id: 'electronica-andina', name: 'Electrónica Andina', parents: ['latin-electronica', 'world'] },
  { id: 'latin-club', name: 'Latin Club', parents: ['latin-electronica'] },
  { id: 'electronica-experimental-latam', name: 'Electrónica Experimental LatAm', parents: ['latin-electronica', 'electronica-idm'] },

  // ══ Added 2026-07 ════════════════════════════════════════════════════════
  // Gap-fill pass. Two kinds of entry here: (a) "very basic" genres that
  // previously existed only as `legacy` ids or not at all, now promoted to
  // first-class leaves under a proper root; (b) micro-genres the editorial
  // side actually uses (vapor family, hypnagogic pop, etc.). Names follow
  // Wikipedia/Discogs conventions; the legacy twin of each promoted id is
  // mapped in LEGACY_ALIASES below so old DB rows resolve to these.

  // TECHNO (fill)
  { id: 'techno-dark', name: 'Dark Techno', parents: ['techno', 'industrial-ebm'] },
  { id: 'techno-schranz', name: 'Schranz', parents: ['techno', 'hardcore-hardstyle'] },
  { id: 'techno-bleep', name: 'Bleep Techno', parents: ['techno'] },
  { id: 'techno-birmingham', name: 'Birmingham Techno', parents: ['techno'] },
  { id: 'techno-peak-time', name: 'Peak Time / Driving Techno', parents: ['techno'] },
  { id: 'techno-raw-deep', name: 'Raw / Deep / Hypnotic Techno', parents: ['techno'] },
  { id: 'techno-electro', name: 'Electro Techno', parents: ['techno', 'electronica-idm'] },
  { id: 'techno-trance', name: 'Trancey Techno', parents: ['techno', 'trance-family'] },

  // HOUSE (fill)
  { id: 'house-garage', name: 'Garage House', parents: ['house'] },
  { id: 'house-disco', name: 'Disco House', parents: ['house', 'disco-italo'] },
  { id: 'house-french', name: 'French House / Filter House', parents: ['house', 'disco-italo'] },
  { id: 'house-funky', name: 'Funky House', parents: ['house'] },
  { id: 'house-jackin', name: 'Jackin House', parents: ['house'] },
  { id: 'house-gospel', name: 'Gospel House', parents: ['house', 'blues-gospel-country'] },
  { id: 'house-ghetto', name: 'Ghetto House / Ghettotech', parents: ['house'] },
  { id: 'house-progressive', name: 'Progressive House', parents: ['house', 'trance-family'] },
  { id: 'house-micro', name: 'Microhouse', parents: ['house'] },
  { id: 'house-organic', name: 'Organic House', parents: ['house'] },
  { id: 'house-bass', name: 'Bass House', parents: ['house'] },
  { id: 'house-hard', name: 'Hard House', parents: ['house', 'hardcore-hardstyle'] },
  { id: 'house-amapiano', name: 'Amapiano', parents: ['house', 'world-bass'] },
  { id: 'house-gqom', name: 'Gqom', parents: ['house', 'world-bass'] },
  { id: 'house-3step', name: '3-Step', parents: ['house', 'dubstep-uk'] },
  { id: 'house-balearic', name: 'Balearic', parents: ['house', 'disco-italo'] },

  // DISCO / ITALO / HI-NRG
  { id: 'disco', name: 'Disco', parents: ['disco-italo'] },
  { id: 'nu-disco-music', name: 'Nu-Disco', parents: ['disco-italo', 'house'] },
  { id: 'italo-disco', name: 'Italo Disco', parents: ['disco-italo'] },
  { id: 'hi-nrg', name: 'Hi-NRG', parents: ['disco-italo'] },
  { id: 'space-disco', name: 'Space Disco / Cosmic', parents: ['disco-italo'] },
  { id: 'disco-dub', name: 'Disco Dub / Edits', parents: ['disco-italo', 'dub-reggae'] },
  { id: 'post-disco', name: 'Post-Disco', parents: ['disco-italo', 'soul-funk-rnb'] },

  // TRANCE
  { id: 'trance-classic', name: 'Trance', parents: ['trance-family'] },
  { id: 'trance-progressive', name: 'Progressive Trance', parents: ['trance-family'] },
  { id: 'trance-psy', name: 'Psy-Trance', parents: ['trance-family'] },
  { id: 'trance-goa', name: 'Goa Trance', parents: ['trance-family'] },
  { id: 'trance-uplifting', name: 'Uplifting Trance', parents: ['trance-family'] },
  { id: 'trance-acid', name: 'Acid Trance', parents: ['trance-family'] },
  { id: 'trance-hard', name: 'Hard Trance', parents: ['trance-family', 'hardcore-hardstyle'] },
  { id: 'trance-dream', name: 'Dream Trance', parents: ['trance-family'] },
  { id: 'trance-forest', name: 'Forest / Dark Psy', parents: ['trance-family'] },

  // HARDCORE / GABBER / HARDSTYLE
  { id: 'hardcore-techno', name: 'Hardcore Techno', parents: ['hardcore-hardstyle'] },
  { id: 'gabber', name: 'Gabber', parents: ['hardcore-hardstyle'] },
  { id: 'happy-hardcore', name: 'Happy Hardcore', parents: ['hardcore-hardstyle'] },
  { id: 'hardstyle', name: 'Hardstyle', parents: ['hardcore-hardstyle'] },
  { id: 'frenchcore', name: 'Frenchcore', parents: ['hardcore-hardstyle'] },
  { id: 'speedcore', name: 'Speedcore', parents: ['hardcore-hardstyle'] },
  { id: 'terrorcore', name: 'Terrorcore', parents: ['hardcore-hardstyle'] },
  { id: 'digital-hardcore', name: 'Digital Hardcore', parents: ['hardcore-hardstyle', 'industrial-ebm'] },
  { id: 'uptempo-hardcore', name: 'Uptempo Hardcore', parents: ['hardcore-hardstyle'] },
  { id: 'makina', name: 'Makina', parents: ['hardcore-hardstyle', 'trance-family'] },

  // BREAKBEAT / RAVE
  { id: 'breakbeat', name: 'Breakbeat', parents: ['breakbeat-rave'] },
  { id: 'big-beat', name: 'Big Beat', parents: ['breakbeat-rave'] },
  { id: 'breakbeat-hardcore', name: 'Breakbeat Hardcore', parents: ['breakbeat-rave', 'hardcore-hardstyle'] },
  { id: 'rave-oldschool', name: 'Old-School Rave', parents: ['breakbeat-rave'] },
  { id: 'nu-skool-breaks', name: 'Nu-Skool Breaks', parents: ['breakbeat-rave'] },
  { id: 'florida-breaks', name: 'Florida Breaks', parents: ['breakbeat-rave'] },
  { id: 'miami-bass', name: 'Miami Bass', parents: ['breakbeat-rave', 'hip-hop-rap'] },
  { id: 'freestyle', name: 'Freestyle', parents: ['breakbeat-rave', 'electronica-idm'] },
  { id: 'baltimore-club', name: 'Baltimore Club', parents: ['breakbeat-rave', 'hyperpop-deconstructed'] },
  { id: 'speed-garage', name: 'Speed Garage', parents: ['breakbeat-rave', 'dubstep-uk'] },
  { id: 'bassline', name: 'Bassline', parents: ['breakbeat-rave', 'dubstep-uk'] },
  { id: 'donk', name: 'Donk / Bounce', parents: ['breakbeat-rave', 'hardcore-hardstyle'] },

  // TRIP HOP / DOWNTEMPO
  { id: 'trip-hop', name: 'Trip Hop', parents: ['triphop-downtempo', 'hip-hop-rap'] },
  { id: 'downtempo-music', name: 'Downtempo', parents: ['triphop-downtempo'] },
  { id: 'chill-out', name: 'Chill Out', parents: ['triphop-downtempo', 'ambient-drone'] },
  { id: 'illbient', name: 'Illbient', parents: ['triphop-downtempo', 'ambient-drone'] },
  { id: 'nu-jazz-downtempo', name: 'Broken Beat', parents: ['triphop-downtempo', 'jazz'] },
  { id: 'acid-jazz', name: 'Acid Jazz', parents: ['triphop-downtempo', 'jazz'] },
  { id: 'psybient', name: 'Psybient / Psydub', parents: ['triphop-downtempo', 'ambient-drone'] },

  // SYNTH-POP / NEW WAVE / SYNTHWAVE
  { id: 'synth-pop', name: 'Synth-Pop', parents: ['synthpop-newwave'] },
  { id: 'new-wave', name: 'New Wave', parents: ['synthpop-newwave', 'post-punk-shoegaze'] },
  { id: 'minimal-synth', name: 'Minimal Synth', parents: ['synthpop-newwave', 'industrial-ebm'] },
  { id: 'synthwave', name: 'Synthwave / Retrowave', parents: ['synthpop-newwave'] },
  { id: 'darksynth', name: 'Darksynth', parents: ['synthpop-newwave', 'industrial-ebm'] },
  { id: 'electroclash', name: 'Electroclash', parents: ['synthpop-newwave', 'electronica-idm'] },
  { id: 'hypnagogic-pop', name: 'Hypnagogic Pop', parents: ['synthpop-newwave', 'vapor-hypnagogic'] },
  { id: 'sovietwave', name: 'Sovietwave', parents: ['synthpop-newwave', 'vapor-hypnagogic'] },
  { id: 'coldwave-synth', name: 'Synth Cold Wave', parents: ['synthpop-newwave', 'industrial-ebm'] },

  // VAPORWAVE / HIPNAGÓGICO / HAUNTOLOGÍA
  { id: 'proto-vaporwave', name: 'Proto-Vaporwave', parents: ['vapor-hypnagogic'] },
  { id: 'eccojams', name: 'Eccojams', parents: ['vapor-hypnagogic'] },
  { id: 'mallsoft', name: 'Mallsoft', parents: ['vapor-hypnagogic', 'ambient-drone'] },
  { id: 'future-funk', name: 'Future Funk', parents: ['vapor-hypnagogic', 'disco-italo'] },
  { id: 'vaportrap', name: 'Vaportrap', parents: ['vapor-hypnagogic', 'hip-hop-rap'] },
  { id: 'hardvapour', name: 'Hardvapour', parents: ['vapor-hypnagogic', 'hardcore-hardstyle'] },
  { id: 'vapornoise', name: 'Vapornoise', parents: ['vapor-hypnagogic', 'industrial-ebm'] },
  { id: 'signalwave', name: 'Signalwave / Broken Transmission', parents: ['vapor-hypnagogic'] },
  { id: 'slushwave', name: 'Slushwave', parents: ['vapor-hypnagogic', 'ambient-drone'] },
  { id: 'barber-beats', name: 'Barber Beats', parents: ['vapor-hypnagogic', 'lofi-bedroom'] },
  { id: 'utopian-virtual', name: 'Utopian Virtual', parents: ['vapor-hypnagogic', 'ambient-drone'] },
  { id: 'vhs-pop', name: 'VHS Pop', parents: ['vapor-hypnagogic'] },
  { id: 'late-night-lofi', name: 'Late Night Lo-Fi', parents: ['vapor-hypnagogic', 'lofi-bedroom'] },
  { id: 'dreampunk', name: 'Dreampunk', parents: ['vapor-hypnagogic', 'ambient-drone'] },
  { id: 'plunderphonics', name: 'Plunderphonics', parents: ['vapor-hypnagogic', 'musique-concrete'] },
  { id: 'dariacore', name: 'Dariacore / Mashcore', parents: ['vapor-hypnagogic', 'hyperpop-deconstructed'] },
  { id: 'witch-house', name: 'Witch House', parents: ['vapor-hypnagogic', 'industrial-ebm'] },
  { id: 'simpsonwave', name: 'Simpsonwave', parents: ['vapor-hypnagogic'] },
  { id: 'post-internet', name: 'Post-Internet', parents: ['vapor-hypnagogic', 'hyperpop-deconstructed'] },

  // DANCEHALL / SOCA / CARIBE
  { id: 'dancehall', name: 'Dancehall', parents: ['caribbean-dancehall', 'dub-reggae'] },
  { id: 'ragga', name: 'Ragga', parents: ['caribbean-dancehall', 'dub-reggae'] },
  { id: 'ska', name: 'Ska', parents: ['caribbean-dancehall', 'dub-reggae'] },
  { id: 'rocksteady', name: 'Rocksteady', parents: ['caribbean-dancehall', 'dub-reggae'] },
  { id: 'dub-poetry', name: 'Dub Poetry', parents: ['caribbean-dancehall', 'dub-reggae'] },
  { id: 'soca', name: 'Soca', parents: ['caribbean-dancehall'] },
  { id: 'calypso', name: 'Calypso', parents: ['caribbean-dancehall'] },
  { id: 'zouk', name: 'Zouk', parents: ['caribbean-dancehall'] },
  { id: 'kompa', name: 'Kompa', parents: ['caribbean-dancehall'] },
  { id: 'reggaeton-music', name: 'Reggaetón', parents: ['caribbean-dancehall', 'latin-electronica'] },

  // TROPICAL / LATINOAMERICANA TRADICIONAL
  { id: 'cumbia-music', name: 'Cumbia', parents: ['tropical-tradicional', 'world-bass'] },
  { id: 'salsa-music', name: 'Salsa', parents: ['tropical-tradicional'] },
  { id: 'son-cubano', name: 'Son Cubano', parents: ['tropical-tradicional'] },
  { id: 'mambo', name: 'Mambo', parents: ['tropical-tradicional'] },
  { id: 'guaguanco-rumba', name: 'Rumba / Guaguancó', parents: ['tropical-tradicional'] },
  { id: 'merengue', name: 'Merengue', parents: ['tropical-tradicional'] },
  { id: 'bachata', name: 'Bachata', parents: ['tropical-tradicional'] },
  { id: 'bolero', name: 'Bolero', parents: ['tropical-tradicional'] },
  { id: 'danzon', name: 'Danzón', parents: ['tropical-tradicional'] },
  { id: 'tango', name: 'Tango', parents: ['tropical-tradicional'] },
  { id: 'samba', name: 'Samba', parents: ['tropical-tradicional'] },
  { id: 'bossa-nova', name: 'Bossa Nova', parents: ['tropical-tradicional', 'jazz'] },
  { id: 'mpb', name: 'MPB', parents: ['tropical-tradicional'] },
  { id: 'tropicalia', name: 'Tropicália', parents: ['tropical-tradicional', 'rock-pop'] },
  { id: 'huapango', name: 'Son / Huapango', parents: ['tropical-tradicional', 'traditional-folk'] },
  { id: 'mariachi', name: 'Mariachi', parents: ['tropical-tradicional', 'traditional-folk'] },
  { id: 'norteno', name: 'Norteño', parents: ['tropical-tradicional', 'traditional-folk'] },
  { id: 'ranchera', name: 'Ranchera', parents: ['tropical-tradicional', 'traditional-folk'] },
  { id: 'nueva-cancion', name: 'Nueva Canción', parents: ['tropical-tradicional', 'traditional-folk'] },
  { id: 'chicha', name: 'Chicha / Cumbia Amazónica', parents: ['tropical-tradicional', 'world-bass'] },

  // ROCK / POP
  { id: 'rock', name: 'Rock', parents: ['rock-pop'] },
  { id: 'pop', name: 'Pop', parents: ['rock-pop'] },
  { id: 'indie-rock', name: 'Indie Rock', parents: ['rock-pop'] },
  { id: 'psych-rock', name: 'Rock Psicodélico', parents: ['rock-pop'] },
  { id: 'garage-rock', name: 'Garage Rock', parents: ['rock-pop'] },
  { id: 'prog-rock', name: 'Rock Progresivo', parents: ['rock-pop'] },
  { id: 'art-pop', name: 'Art Pop', parents: ['rock-pop'] },
  { id: 'avant-pop', name: 'Avant-Pop', parents: ['rock-pop', 'hyperpop-deconstructed'] },
  { id: 'rock-en-espanol', name: 'Rock en Español', parents: ['rock-pop'] },
  { id: 'indie-dance-music', name: 'Indie Dance', parents: ['rock-pop', 'house'] },
  { id: 'dance-punk', name: 'Dance-Punk', parents: ['rock-pop', 'post-punk-shoegaze'] },
  { id: 'surf-rock', name: 'Surf Rock', parents: ['rock-pop'] },

  // PUNK / METAL / HARDCORE
  { id: 'punk', name: 'Punk', parents: ['punk-metal'] },
  { id: 'hardcore-punk', name: 'Hardcore Punk', parents: ['punk-metal'] },
  { id: 'post-hardcore', name: 'Post-Hardcore', parents: ['punk-metal'] },
  { id: 'metal', name: 'Metal', parents: ['punk-metal'] },
  { id: 'doom-metal', name: 'Doom / Sludge', parents: ['punk-metal', 'ambient-drone'] },
  { id: 'black-metal', name: 'Black Metal', parents: ['punk-metal'] },
  { id: 'grindcore', name: 'Grindcore', parents: ['punk-metal'] },
  { id: 'powerviolence', name: 'Powerviolence', parents: ['punk-metal'] },
  { id: 'crust-punk', name: 'Crust / D-Beat', parents: ['punk-metal'] },
  { id: 'metal-industrial', name: 'Metal Industrial', parents: ['punk-metal', 'industrial-ebm'] },

  // CLÁSICA / CONTEMPORÁNEA
  { id: 'clasica', name: 'Música Clásica', parents: ['clasica-contemporanea'] },
  { id: 'barroco', name: 'Barroco', parents: ['clasica-contemporanea'] },
  { id: 'opera', name: 'Ópera', parents: ['clasica-contemporanea'] },
  { id: 'coral-sacro', name: 'Coral / Sacra', parents: ['clasica-contemporanea'] },
  { id: 'contemporanea', name: 'Música Contemporánea', parents: ['clasica-contemporanea', 'musique-concrete'] },
  { id: 'neoclasico', name: 'Neoclásico', parents: ['clasica-contemporanea'] },
  { id: 'modern-classical', name: 'Modern Classical', parents: ['clasica-contemporanea', 'ambient-drone'] },
  { id: 'chamber-music', name: 'Música de Cámara', parents: ['clasica-contemporanea'] },
  { id: 'soundtrack', name: 'Soundtrack / Score', parents: ['clasica-contemporanea', 'fourth-world'] },
  { id: 'giallo-horror-score', name: 'Giallo / Horror Score', parents: ['clasica-contemporanea', 'fourth-world'] },

  // BLUES / GOSPEL / COUNTRY
  { id: 'blues', name: 'Blues', parents: ['blues-gospel-country'] },
  { id: 'delta-blues', name: 'Delta Blues', parents: ['blues-gospel-country'] },
  { id: 'gospel', name: 'Gospel', parents: ['blues-gospel-country', 'soul-funk-rnb'] },
  { id: 'country', name: 'Country', parents: ['blues-gospel-country'] },
  { id: 'americana', name: 'Americana', parents: ['blues-gospel-country', 'traditional-folk'] },
  { id: 'bluegrass', name: 'Bluegrass', parents: ['blues-gospel-country', 'traditional-folk'] },

  // FILL — existing roots that were thin
  { id: 'disco-boogie-funk', name: 'Boogie Funk', parents: ['soul-funk-rnb', 'disco-italo'] },
  { id: 'gospel-soul', name: 'Gospel Soul', parents: ['soul-funk-rnb', 'blues-gospel-country'] },
  { id: 'northern-soul', name: 'Northern Soul', parents: ['soul-funk-rnb'] },
  { id: 'g-funk', name: 'G-Funk', parents: ['hip-hop-rap', 'soul-funk-rnb'] },
  { id: 'boom-bap', name: 'Boom Bap', parents: ['hip-hop-rap'] },
  { id: 'trap', name: 'Trap', parents: ['hip-hop-rap'] },
  { id: 'phonk', name: 'Phonk', parents: ['hip-hop-rap', 'vapor-hypnagogic'] },
  { id: 'grime-rap', name: 'UK Rap', parents: ['hip-hop-rap', 'dubstep-uk'] },
  { id: 'rap-en-espanol', name: 'Rap en Español', parents: ['hip-hop-rap'] },
  { id: 'turntablism', name: 'Turntablism', parents: ['hip-hop-rap', 'musique-concrete'] },
  { id: 'field-recording', name: 'Field Recording', parents: ['ambient-drone', 'musique-concrete'] },
  { id: 'lowercase', name: 'Lowercase', parents: ['ambient-drone', 'electronica-idm'] },
  { id: 'harsh-noise-wall', name: 'Harsh Noise Wall', parents: ['industrial-ebm'] },
  { id: 'wonky', name: 'Wonky', parents: ['electronica-idm', 'hip-hop-rap'] },
  { id: 'ambient-pop', name: 'Ambient Pop', parents: ['ambient-drone', 'rock-pop'] },
  { id: 'afrobeats', name: 'Afrobeats', parents: ['world-bass'] },
  { id: 'highlife', name: 'Highlife', parents: ['world-bass', 'world'] },
  { id: 'ethio-jazz', name: 'Ethio-Jazz', parents: ['jazz', 'world'] },
  { id: 'desert-blues', name: 'Desert Blues / Tishoumaren', parents: ['world', 'blues-gospel-country'] },
  { id: 'singeli', name: 'Singeli', parents: ['world-bass'] },
  { id: 'coupe-decale', name: 'Coupé-Décalé', parents: ['world-bass'] },
  { id: 'batida', name: 'Batida', parents: ['world-bass'] },
  { id: 'shangaan-electro', name: 'Shangaan Electro', parents: ['world-bass'] },
  { id: 'city-pop', name: 'City Pop', parents: ['rock-pop', 'vapor-hypnagogic'] },
  { id: 'j-pop', name: 'J-Pop', parents: ['rock-pop', 'world'] },
  { id: 'k-pop', name: 'K-Pop', parents: ['rock-pop', 'world'] },
  { id: 'enka', name: 'Enka', parents: ['world', 'traditional-folk'] },
  { id: 'qawwali', name: 'Qawwali', parents: ['world', 'traditional-folk'] },
  { id: 'carnatic-hindustani', name: 'Carnática / Hindustaní', parents: ['world', 'traditional-folk'] },
  { id: 'fado', name: 'Fado', parents: ['world', 'traditional-folk'] },
  { id: 'flamenco', name: 'Flamenco', parents: ['world', 'traditional-folk'] },
  { id: 'klezmer', name: 'Klezmer', parents: ['world', 'traditional-folk'] },
  { id: 'cai-luong-gamelan', name: 'Gamelan', parents: ['world', 'traditional-folk'] },
  { id: 'throat-singing', name: 'Canto de Garganta', parents: ['world', 'traditional-folk'] },
]

// ── Legacy ids ─────────────────────────────────────────────────────────────
//
// Pre-taxonomy ids that existing DB rows may carry. Kept resolvable so the
// site doesn't render orphan tags. Each is parented to its closest
// taxonomy root so rollup filtering still works. New items should not use
// these ids — the dashboard composer hides `legacy: true` entries.

const LEGACY: Genre[] = [
  { id: 'afro-house', name: 'Afro House', parents: ['house'], legacy: true },
  { id: 'bass-house', name: 'Bass House', parents: ['house'], legacy: true },
  { id: 'big-room', name: 'Big Room', parents: ['house'], legacy: true },
  { id: 'breaks', name: 'Breaks / Breakbeat', parents: ['dubstep-uk'], legacy: true },
  { id: 'dance-electro-pop', name: 'Dance / Electro Pop', parents: ['hyperpop-deconstructed'], legacy: true },
  { id: 'dark-techno', name: 'Dark Techno / Noise', parents: ['techno', 'industrial-ebm'], legacy: true },
  { id: 'deep-house', name: 'Deep House', parents: ['house'], legacy: true },
  { id: 'downtempo', name: 'Downtempo / Beats', parents: ['ambient-drone'], legacy: true },
  { id: 'drum-and-bass', name: 'Drum and Bass', parents: ['dnb-jungle'], legacy: true },
  { id: 'dubstep', name: 'Dubstep', parents: ['dubstep-uk'], legacy: true },
  { id: 'electronica', name: 'Electronica', parents: ['electronica-idm'], legacy: true },
  { id: 'hard-dance', name: 'Hard Dance / Hardcore', parents: ['techno'], legacy: true },
  { id: 'hard-techno', name: 'Hard Techno', parents: ['techno'], legacy: true },
  { id: 'indie-dance', name: 'Indie Dance', parents: ['hyperpop-deconstructed'], legacy: true },
  { id: 'jackin-house', name: 'Jackin House', parents: ['house'], legacy: true },
  { id: 'melodic-techno', name: 'Melodic House & Techno', parents: ['techno', 'house'], legacy: true },
  { id: 'minimal', name: 'Minimal / Deep Tech', parents: ['techno', 'house'], legacy: true },
  { id: 'nu-disco', name: 'Nu Disco / Disco', parents: ['house'], legacy: true },
  { id: 'organic-house', name: 'Organic House / Downtempo', parents: ['house'], legacy: true },
  { id: 'peak-techno', name: 'Peak Time Techno', parents: ['techno'], legacy: true },
  { id: 'progressive-house', name: 'Progressive House', parents: ['house'], legacy: true },
  { id: 'psy-trance', name: 'Psy-Trance', parents: ['techno'], legacy: true },
  { id: 'reggaeton', name: 'Reggaeton / Latin Hip-Hop', parents: ['world-bass', 'hip-hop-rap'], legacy: true },
  { id: 'tech-house', name: 'Tech House', parents: ['house', 'techno'], legacy: true },
  { id: 'techno-peak', name: 'Techno (Peak / Driving)', parents: ['techno'], legacy: true },
  { id: 'techno-raw', name: 'Techno (Raw / Deep / Hypnotic)', parents: ['techno'], legacy: true },
  { id: 'trance', name: 'Trance (Main Floor)', parents: ['techno'], legacy: true },
  { id: 'trance-raw', name: 'Trance (Raw / Deep)', parents: ['techno'], legacy: true },
  { id: 'ukg', name: 'UKG / Garage / Grime', parents: ['dubstep-uk'], legacy: true },
  { id: 'wave', name: 'Wave', parents: ['lofi-bedroom'], legacy: true },
  { id: 'cumbia-electronica', name: 'Cumbia Electrónica', parents: ['world-bass', 'latin-electronica'], legacy: true },
  { id: 'latin-electronic', name: 'Latin Electronic', parents: ['world-bass', 'latin-electronica'], legacy: true },
  { id: 'ballroom', name: 'Ballroom / Voguing', parents: ['hyperpop-deconstructed'], legacy: true },
  { id: 'gqom', name: 'Gqom', parents: ['world-bass'] /* high-vibe */, legacy: true },
  { id: 'deconstructed', name: 'Deconstructed Club', parents: ['hyperpop-deconstructed'], legacy: true },
  { id: 'ambient-techno', name: 'Ambient Techno', parents: ['techno', 'ambient-drone'], legacy: true },
  { id: 'uk-bass', name: 'UK Bass', parents: ['dubstep-uk'], legacy: true },
  { id: 'ghetto-house', name: 'Ghetto House / Ghetto Tech', parents: ['house'], legacy: true },
  { id: 'hip-hop', name: 'Hip Hop', parents: ['hip-hop-rap'], legacy: true },
  { id: 'rnb', name: 'R&B', parents: ['soul-funk-rnb'], legacy: true },
  { id: 'cumbia', name: 'Cumbia', parents: ['world-bass'], legacy: true },
  { id: 'salsa', name: 'Salsa', parents: ['world-bass'], legacy: true },
  { id: 'dub', name: 'Dub', parents: ['dub-reggae'], legacy: true },
  { id: 'latin-jazz', name: 'Latin Jazz', parents: ['jazz', 'world-bass'], legacy: true },
  { id: 'son', name: 'Son / Huapango', parents: ['world-bass'], legacy: true },
]

export const GENRES: Genre[] = [...ROOTS, ...SUBGENRES, ...LEGACY]

// ── Legacy aliases ─────────────────────────────────────────────────────────
//
// Every legacy id that has a same-meaning entry in the current taxonomy maps
// to that canonical id here. This is what removes the *visible* duplicates
// ("Hard Techno" appearing twice in a picker, etc.): pickers show only
// non-legacy entries, and anything reading a stored id can normalize through
// `canonicalizeGenre` so old rows land on the canonical chip.
//
// Legacy ids with no exact modern twin (e.g. `big-room`) are deliberately
// absent — they stay resolvable but are not rewritten.

export const LEGACY_ALIASES: Record<string, string> = {
  'afro-house': 'house-afro',
  'ambient-techno': 'techno-ambient',
  'ballroom': 'ballroom-vogue',
  'bass-house': 'house-bass',
  'breaks': 'breakbeat',
  'cumbia': 'cumbia-music',
  'cumbia-electronica': 'cumbia-digital',
  'dance-electro-pop': 'synth-pop',
  'dark-techno': 'techno-dark',
  'deconstructed': 'deconstructed-club',
  'deep-house': 'house-deep',
  'downtempo': 'downtempo-music',
  'drum-and-bass': 'dnb-jungle',
  'dub': 'dub-roots',
  'dubstep': 'dubstep-uk',
  'electronica': 'electronica-idm',
  'ghetto-house': 'house-ghetto',
  'gqom': 'house-gqom',
  'hard-dance': 'hardcore-techno',
  'hard-techno': 'techno-hard',
  'hip-hop': 'hip-hop-rap',
  'indie-dance': 'indie-dance-music',
  'jackin-house': 'house-jackin',
  'latin-electronic': 'latin-electronica',
  'latin-jazz': 'jazz-latino',
  'melodic-techno': 'techno-melodic',
  'minimal': 'techno-minimal',
  'nu-disco': 'nu-disco-music',
  'organic-house': 'house-organic',
  'peak-techno': 'techno-peak-time',
  'progressive-house': 'house-progressive',
  'psy-trance': 'trance-psy',
  'reggaeton': 'reggaeton-music',
  'rnb': 'rnb-contemporaneo',
  'salsa': 'salsa-music',
  'son': 'huapango',
  'tech-house': 'house-tech',
  'techno-peak': 'techno-peak-time',
  'techno-raw': 'techno-raw-deep',
  'trance': 'trance-classic',
  'trance-raw': 'trance-progressive',
  'uk-bass': 'bass-music',
  'ukg': 'uk-garage',
  'wave': 'dreampunk',
}

// Resolve a possibly-legacy id to its current canonical id. Unknown ids and
// legacy ids without a twin pass through unchanged.
export function canonicalizeGenre(id: string): string {
  return LEGACY_ALIASES[id] ?? id
}

// Canonicalize a list and drop duplicates that collapse onto the same id.
export function canonicalizeGenres(ids: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of ids) {
    const c = canonicalizeGenre(id)
    if (seen.has(c)) continue
    seen.add(c)
    out.push(c)
  }
  return out
}

// The pickable taxonomy — what every composer/tag UI should render. Legacy
// ids are excluded so no genre ever appears twice in a list.
export function getSelectableGenres(): Genre[] {
  return [...ROOTS, ...SUBGENRES]
}

// ── Lookups ────────────────────────────────────────────────────────────────

const GENRE_BY_ID: Map<string, Genre> = new Map(GENRES.map((g) => [g.id, g]))

// Children index — for each parent id, the leaves whose `parents` list it.
const CHILDREN_BY_PARENT: Map<string, string[]> = (() => {
  const m = new Map<string, string[]>()
  for (const g of GENRES) {
    for (const p of g.parents) {
      const arr = m.get(p) ?? []
      arr.push(g.id)
      m.set(p, arr)
    }
  }
  return m
})()

export function getGenreById(id: string): Genre | undefined {
  return GENRE_BY_ID.get(id)
}

export function getGenreNames(ids: string[]): string[] {
  return ids.map((id) => GENRE_BY_ID.get(id)?.name ?? id)
}

// Top-level category roots — useful for the dashboard composer's
// hierarchical genre picker.
export function getRootGenres(): Genre[] {
  return ROOTS
}

// All non-legacy subgenres of a parent (single level — direct children).
export function getDirectChildren(parentId: string): Genre[] {
  return (CHILDREN_BY_PARENT.get(parentId) ?? [])
    .map((id) => GENRE_BY_ID.get(id))
    .filter((g): g is Genre => !!g && !g.legacy)
}

// Returns the set of ids that "match" when filtering by `id`. For a leaf,
// just [id]. For a parent, [id, …all descendant ids]. Legacy ids parented
// to a root are pulled in when filtering by that root, so old DB rows
// keep working under new top-level filters.
export function getRollup(id: string): string[] {
  const visited = new Set<string>()
  const out: string[] = []
  const visit = (curId: string) => {
    if (visited.has(curId)) return
    visited.add(curId)
    out.push(curId)
    const children = CHILDREN_BY_PARENT.get(curId)
    if (!children) return
    for (const c of children) visit(c)
  }
  visit(id)
  return out
}

// True if any of `itemGenres` (a content item's tags) is matched by the
// active filter set. Each filter id rolls up via `getRollup`. Empty
// filter array = no filter (returns true).
export function itemMatchesGenreFilter(
  itemGenres: string[],
  activeFilters: string[],
): boolean {
  if (activeFilters.length === 0) return true
  if (itemGenres.length === 0) return false
  const targets = new Set<string>()
  for (const f of activeFilters) {
    for (const id of getRollup(f)) targets.add(id)
  }
  return itemGenres.some((g) => targets.has(g))
}

// ── Tags (transversal qualities, separate from the genre axis) ─────────────

export const TAGS: Tag[] = [
  // — Original event/format tags (kept for back-compat with existing items)
  { id: 'festival', name: 'Festival' },
  { id: 'workshop', name: 'Workshop' },
  { id: 'charla', name: 'Charla / Talk' },
  { id: 'lgbtq', name: 'LGBTQ+' },
  { id: 'club-night', name: 'Club Night' },
  { id: 'open-air', name: 'Open Air' },
  { id: 'day-party', name: 'Day Party' },
  { id: 'rave', name: 'Rave' },
  { id: 'art-show', name: 'Art Show / Expo' },
  { id: 'label-night', name: 'Label Night' },
  { id: 'b2b', name: 'B2B' },
  { id: 'live', name: 'Live Set' },
  { id: 'anl', name: 'All Night Long' },
  { id: 'benefit', name: 'Benefit / Recaudación' },
  { id: 'radio', name: 'Radio Show' },
  { id: 'free', name: 'Entrada Libre' },
  { id: 'residency', name: 'Residency' },
  { id: 'showcase', name: 'Showcase' },
  { id: 'closing-party', name: 'Closing Party' },
  // `hip-hop-tag` / `neo-soul-tag` duplicate the genre axis and `live-set`
  // duplicates `live` — kept resolvable for old rows, hidden from pickers.
  { id: 'hip-hop-tag', name: 'Hip Hop', legacy: true },
  { id: 'neo-soul-tag', name: 'Neo Soul', legacy: true },
  { id: 'feminist', name: 'Feminista' },
  { id: 'community', name: 'Comunitario' },
  { id: 'vinyl-only', name: 'Vinyl Only' },
  // — Transversal qualities (new — qualities that cross genre lines)
  { id: 'greyscale', name: 'Greyscale' },
  { id: 'degradado', name: 'Degradado / Corroded' },
  { id: 'devocional', name: 'Devocional' },
  { id: 'ritual', name: 'Ritual' },
  { id: 'maximalista', name: 'Maximalista' },
  { id: 'minimalista', name: 'Minimalista' },
  { id: 'granular', name: 'Granular' },
  { id: 'dancefloor', name: 'Dancefloor' },
  { id: 'sala-grande', name: 'Sala Grande' },
  { id: 'audifonos', name: 'Audífonos / Headphone' },
  { id: 'outdoor', name: 'Outdoor' },
  { id: 'after', name: 'After' },
  { id: 'soundsystem', name: 'Soundsystem' },
  { id: 'modular', name: 'Modular' },
  { id: 'acustico', name: 'Acústico' },
  { id: 'voz', name: 'Voz' },
  { id: 'instrumental', name: 'Instrumental' },
  { id: 'live-set', name: 'Live Set (calidad)', legacy: true },
  { id: 'cdmx', name: 'CDMX' },
  { id: 'latinoamericano', name: 'Latinoamericano' },
  { id: 'diasporico', name: 'Diaspórico' },
  { id: 'afrofuturista', name: 'Afrofuturista' },
]

const TAG_BY_ID: Map<string, Tag> = new Map(TAGS.map((t) => [t.id, t]))

export function getTagById(id: string): Tag | undefined {
  return TAG_BY_ID.get(id)
}

export function getTagNames(ids: string[]): string[] {
  return ids.map(tagLabel)
}

// The pickable tag catalog — legacy duplicates excluded.
export function getSelectableTags(): Tag[] {
  return TAGS.filter((t) => !t.legacy)
}

// Display label for any tag id, including user-created ones that aren't in
// the static catalog. Unknown ids are humanized from the slug rather than
// rendered raw, so a tag created in the foro composer reads correctly even
// before the custom-tag registry has loaded.
export function tagLabel(id: string): string {
  const known = TAG_BY_ID.get(id)
  if (known) return known.name
  return id
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// Normalize free text typed by a user into a stable tag id: lowercase,
// accent-stripped, non-alphanumerics collapsed to single hyphens. Returns ''
// when nothing usable remains — callers should reject that.
export function slugifyTag(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

// Longest tag label we accept from the composer.
export const TAG_NAME_MAX = 40

// ── Vibe heuristic (legacy / foro-side) ────────────────────────────────────
//
// Now-deprecated stereotype map. Two reasons it stays:
//   1. The slider chip strip's GENRE_VIBE-fallback path uses it when no
//      ContentGrid has reported feed contents (e.g. on /foro and routes
//      without a feed).
//   2. The foro catalog filters threads-by-genre against the slider's vibe
//      range via `genresIntersectVibeRange`. Foro threads have no vibe
//      field of their own, so this map is the only way to gate them.
//
// Per Vibe Philosophy idea 2, GENRE_VIBE is a stereotype shortcut, not the
// truth. Coverage doesn't need to be exhaustive — uncovered ids fall
// through to "always pass" in the foro filter, keeping new genres visible
// rather than hidden.

export const GENRE_VIBE: Record<string, number> = {
  // Legacy entries (preserved verbatim from pre-taxonomy era)
  'ambient': 0,
  'lo-fi': 1, 'downtempo': 1,
  'organic-house': 2, 'ambient-techno': 2, 'dub': 2,
  'deep-house': 3, 'minimal': 3, 'neo-soul': 3,
  'house': 4, 'electronica': 4, 'melodic-techno': 4, 'nu-disco': 4, 'indie-dance': 4,
  'tech-house': 5, 'electro': 5, 'idm': 5, 'latin-electronic': 5,
  'techno-raw': 6, 'progressive-house': 6, 'afro-house': 6, 'breaks': 6,
  'peak-techno': 7, 'drum-and-bass': 7, 'ukg': 7, 'uk-bass': 7,
  'hard-techno': 8, 'dark-techno': 8, 'jungle': 8, 'footwork-juke': 8, 'hard-dance': 8,
  'industrial': 9, 'noise': 9, 'deconstructed': 9,
  'psy-trance': 10, 'hyperpop': 10, 'gqom': 10,
  // New taxonomy anchors (rough placements — curators override per item)
  'jazz': 3, 'jazz-modal': 2, 'spiritual-jazz': 3, 'free-jazz': 8,
  'house-deep': 3, 'house-tech': 5, 'house-acid': 5,
  'techno-minimal': 4, 'techno-dub': 3, 'techno-detroit': 5,
  'techno-hard': 8, 'techno-acid': 7, 'techno-industrial': 9,
  'dub-roots': 2, 'reggae': 3, 'reggae-digital': 4,
  'dnb-liquid': 6, 'dnb-neurofunk': 8, 'dnb-darkstep': 9,
  'post-dubstep': 5, 'grime': 7, 'future-garage': 4, 'uk-garage': 6,
  'dark-ambient': 1, 'drone': 1, 'ambient-industrial': 3,
  'krautrock': 4, 'kosmische': 2, 'motorik': 5,
  'systems-music': 1, 'minimalismo-clasico': 2,
  'vaporwave': 1, 'chillwave': 2, 'cassette-culture': 2,
  'pc-music': 9, 'digicore': 9, 'deconstructed-club': 9, 'jersey-club': 8, 'ballroom-vogue': 8,
  'ebm': 8, 'cold-wave': 5, 'power-electronics': 10,
  'shoegaze': 4, 'dream-pop': 3, 'post-rock': 4,
  'breakcore': 9, 'glitch': 6, 'electro-funk': 5,
  'soul': 3, 'funk': 4, 'p-funk': 5, 'boogie': 5,
  'cloud-rap': 4, 'drill': 7, 'trap-experimental': 6, 'jazz-rap': 4,
  'musique-concrete-music': 5, 'electroacustica': 4,
  'afrobeat': 5, 'baile-funk': 7, 'dembow': 6, 'cumbia-digital': 5,
  // Árabe / SWANA
  'arab-maqam': 2, 'arab-andalusi': 2, 'arab-gnawa': 4, 'arab-dabke': 7,
  'arab-rai': 5, 'arab-shaabi': 6, 'arab-chaabi': 4, 'arab-khaleeji': 4,
  'arab-pop': 5, 'arab-mahraganat': 8, 'arab-electronic': 6,
  // Tradicional / World
  'musica-tradicional': 2, 'folk': 2, 'folclore-latinoamericano': 3,
  'son-jarocho': 4, 'musica-andina': 2, 'world-music': 3,
  'musicas-africanas': 5, 'musicas-asiaticas': 3, 'balkan-romani': 7,
  // Electrónica Latina
  'neoperreo': 7, 'perreo-experimental': 7, 'guaracha-aleteo': 8,
  'tribal-guarachero': 8, 'changa-tuki': 8, 'nu-cumbia': 5,
  'electro-tropical': 6, 'latin-bass': 7, 'electronica-andina': 3,
  'latin-club': 7, 'electronica-experimental-latam': 6,
  // New roots — anchor each so the slider's chip strip sorts them into the
  // right place instead of defaulting them all to the middle of the range.
  'disco-italo': 5, 'trance-family': 7, 'hardcore-hardstyle': 10,
  'breakbeat-rave': 6, 'triphop-downtempo': 2, 'synthpop-newwave': 4,
  'vapor-hypnagogic': 1, 'caribbean-dancehall': 6, 'tropical-tradicional': 4,
  'rock-pop': 5, 'punk-metal': 8, 'clasica-contemporanea': 2,
  'blues-gospel-country': 3,
  // — 2026-07 gap-fill anchors
  'disco': 5, 'nu-disco-music': 4, 'italo-disco': 5, 'hi-nrg': 7,
  'space-disco': 4, 'post-disco': 4, 'house-disco': 5, 'house-french': 5,
  'house-garage': 5, 'house-progressive': 6, 'house-amapiano': 4,
  'house-gqom': 8, 'house-balearic': 2, 'house-micro': 4, 'house-hard': 8,
  'trance-classic': 6, 'trance-progressive': 5, 'trance-psy': 9,
  'trance-goa': 8, 'trance-uplifting': 7, 'trance-acid': 7, 'trance-hard': 9,
  'trance-dream': 4, 'trance-forest': 9,
  'hardcore-techno': 10, 'gabber': 10, 'happy-hardcore': 9, 'hardstyle': 9,
  'frenchcore': 10, 'speedcore': 10, 'terrorcore': 10, 'digital-hardcore': 10,
  'uptempo-hardcore': 10, 'makina': 9, 'techno-schranz': 10,
  'techno-dark': 9, 'techno-peak-time': 7, 'techno-raw-deep': 6,
  'techno-bleep': 5, 'techno-birmingham': 8, 'techno-electro': 6, 'techno-trance': 7,
  'breakbeat': 6, 'big-beat': 6, 'breakbeat-hardcore': 8, 'rave-oldschool': 7,
  'nu-skool-breaks': 6, 'miami-bass': 6, 'freestyle': 5, 'baltimore-club': 8,
  'speed-garage': 7, 'bassline': 7, 'donk': 8,
  'trip-hop': 2, 'downtempo-music': 2, 'chill-out': 1, 'illbient': 2,
  'acid-jazz': 4, 'psybient': 2, 'nu-jazz-downtempo': 4,
  'synth-pop': 4, 'new-wave': 4, 'minimal-synth': 4, 'synthwave': 4,
  'darksynth': 7, 'electroclash': 6, 'hypnagogic-pop': 1, 'sovietwave': 2,
  'proto-vaporwave': 1, 'eccojams': 1, 'mallsoft': 0, 'future-funk': 5,
  'vaportrap': 3, 'hardvapour': 9, 'vapornoise': 8, 'signalwave': 1,
  'slushwave': 0, 'barber-beats': 1, 'utopian-virtual': 1, 'vhs-pop': 2,
  'late-night-lofi': 1, 'dreampunk': 1, 'plunderphonics': 4, 'dariacore': 9,
  'witch-house': 5, 'simpsonwave': 1, 'post-internet': 6, 'phonk': 6,
  'dancehall': 6, 'ragga': 7, 'ska': 5, 'rocksteady': 3, 'dub-poetry': 3,
  'soca': 7, 'calypso': 4, 'zouk': 4, 'kompa': 4, 'reggaeton-music': 6,
  'cumbia-music': 4, 'salsa-music': 5, 'son-cubano': 3, 'mambo': 5,
  'guaguanco-rumba': 5, 'merengue': 6, 'bachata': 3, 'bolero': 1,
  'danzon': 2, 'tango': 3, 'samba': 5, 'bossa-nova': 2, 'mpb': 3,
  'tropicalia': 4, 'huapango': 4, 'mariachi': 4, 'norteno': 4,
  'ranchera': 3, 'nueva-cancion': 2, 'chicha': 4,
  'rock': 5, 'pop': 4, 'indie-rock': 4, 'psych-rock': 4, 'garage-rock': 6,
  'prog-rock': 4, 'art-pop': 3, 'avant-pop': 5, 'rock-en-espanol': 5,
  'indie-dance-music': 5, 'dance-punk': 6, 'surf-rock': 5,
  'punk': 8, 'hardcore-punk': 9, 'post-hardcore': 7, 'metal': 8,
  'doom-metal': 5, 'black-metal': 9, 'grindcore': 10, 'powerviolence': 10,
  'crust-punk': 9, 'metal-industrial': 9,
  'clasica': 2, 'barroco': 2, 'opera': 3, 'coral-sacro': 1,
  'contemporanea': 3, 'neoclasico': 1, 'modern-classical': 1,
  'chamber-music': 2, 'soundtrack': 2, 'giallo-horror-score': 4,
  'blues': 3, 'delta-blues': 3, 'gospel': 4, 'country': 3,
  'americana': 3, 'bluegrass': 4,
  'disco-boogie-funk': 5, 'gospel-soul': 4, 'northern-soul': 5,
  'g-funk': 4, 'boom-bap': 4, 'trap': 6, 'grime-rap': 6,
  'rap-en-espanol': 5, 'turntablism': 6,
  'field-recording': 0, 'lowercase': 0, 'harsh-noise-wall': 10,
  'wonky': 5, 'ambient-pop': 2,
  'afrobeats': 5, 'highlife': 4, 'ethio-jazz': 3, 'desert-blues': 3,
  'singeli': 9, 'coupe-decale': 6, 'batida': 7, 'shangaan-electro': 8,
  'city-pop': 3, 'j-pop': 5, 'k-pop': 6, 'enka': 2, 'qawwali': 4,
  'carnatic-hindustani': 2, 'fado': 2, 'flamenco': 4, 'klezmer': 5,
  'cai-luong-gamelan': 2, 'throat-singing': 1,
}

export function vibeForGenre(id: string): number | null {
  return id in GENRE_VIBE ? GENRE_VIBE[id] : null
}

// True if any supplied genre id intersects [min, max] in the GENRE_VIBE
// map. Genres without an entry are ignored. If NO supplied id is mapped,
// passes through (treated as untagged → always visible) — same semantics
// as the pre-taxonomy version, so foro threads tagged with new genres
// don't disappear before GENRE_VIBE is updated.
export function genresIntersectVibeRange(
  ids: string[],
  min: number,
  max: number,
): boolean {
  const mapped = ids.map(vibeForGenre).filter((v): v is number => v !== null)
  if (mapped.length === 0) return true
  return mapped.some((v) => v >= min && v <= max)
}
