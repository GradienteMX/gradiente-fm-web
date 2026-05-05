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

// ── Top-level categories (18 roots) ────────────────────────────────────────

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
  { id: 'hauntology', name: 'Hauntology', parents: ['ambient-drone'] },
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
  { id: 'vaporwave', name: 'Vaporwave', parents: ['lofi-bedroom'] },
  { id: 'chillwave', name: 'Chillwave', parents: ['lofi-bedroom'] },
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
  { id: 'baile-funk', name: 'Baile Funk', parents: ['world-bass'] },
  { id: 'dembow', name: 'Dembow', parents: ['world-bass'] },
  { id: 'sonidero', name: 'Sonidero', parents: ['world-bass'] },
  { id: 'tropical-bass', name: 'Tropical Bass', parents: ['world-bass'] },
  { id: 'folktronica', name: 'Folktronica', parents: ['world-bass'] },
  { id: 'cumbia-digital', name: 'Cumbia Digital', parents: ['world-bass'] },
  { id: 'cumbia-sonidera', name: 'Cumbia Sonidera', parents: ['world-bass'] },
  { id: 'cumbia-villera', name: 'Cumbia Villera', parents: ['world-bass'] },
  { id: 'cumbia-experimental', name: 'Cumbia Experimental', parents: ['world-bass'] },
  { id: 'raga-electronico', name: 'Raga Electrónico', parents: ['world-bass'] },
  { id: 'gagaku-contemporaneo', name: 'Gagaku Contemporáneo', parents: ['world-bass'] },
  { id: 'banda-contemporanea', name: 'Música de Banda (contemporánea)', parents: ['world-bass'] },
  { id: 'corrido-tumbado', name: 'Corrido Tumbado / Norteño-Trap', parents: ['world-bass'] },
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
  { id: 'cumbia-electronica', name: 'Cumbia Electrónica', parents: ['world-bass'], legacy: true },
  { id: 'latin-electronic', name: 'Latin Electronic', parents: ['world-bass'], legacy: true },
  { id: 'trap', name: 'Trap / Future Bass', parents: ['hip-hop-rap'], legacy: true },
  { id: 'ballroom', name: 'Ballroom / Voguing', parents: ['hyperpop-deconstructed'], legacy: true },
  { id: 'gqom', name: 'Gqom', parents: ['world-bass'] /* high-vibe */, legacy: true },
  { id: 'afrobeats', name: 'Afrobeats', parents: ['world-bass'], legacy: true },
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
  { id: 'hip-hop-tag', name: 'Hip Hop' },
  { id: 'neo-soul-tag', name: 'Neo Soul' },
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
  { id: 'live-set', name: 'Live Set (calidad)' },
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
  return ids.map((id) => TAG_BY_ID.get(id)?.name ?? id)
}

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
