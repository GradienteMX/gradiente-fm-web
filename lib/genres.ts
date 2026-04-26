import type { Genre, Tag } from './types'

export const GENRES: Genre[] = [
  // ── Beatport Official ──────────────────────────────────────
  { id: 'afro-house', name: 'Afro House', category: 'electronic' },
  { id: 'ambient', name: 'Ambient', category: 'experimental' },
  { id: 'bass-house', name: 'Bass House', category: 'electronic' },
  { id: 'big-room', name: 'Big Room', category: 'electronic' },
  { id: 'breaks', name: 'Breaks / Breakbeat', category: 'electronic' },
  { id: 'dance-electro-pop', name: 'Dance / Electro Pop', category: 'club' },
  { id: 'dark-techno', name: 'Dark Techno / Noise', category: 'electronic' },
  { id: 'deep-house', name: 'Deep House', category: 'electronic' },
  { id: 'downtempo', name: 'Downtempo / Beats', category: 'experimental' },
  { id: 'drum-and-bass', name: 'Drum and Bass', category: 'electronic' },
  { id: 'dubstep', name: 'Dubstep', category: 'electronic' },
  { id: 'electro', name: 'Electro / Detroit', category: 'electronic' },
  { id: 'electronica', name: 'Electronica', category: 'experimental' },
  { id: 'hard-dance', name: 'Hard Dance / Hardcore', category: 'electronic' },
  { id: 'hard-techno', name: 'Hard Techno', category: 'electronic' },
  { id: 'house', name: 'House', category: 'electronic' },
  { id: 'indie-dance', name: 'Indie Dance', category: 'club' },
  { id: 'jackin-house', name: 'Jackin House', category: 'electronic' },
  { id: 'jungle', name: 'Jungle / Jungle Techno', category: 'electronic' },
  { id: 'lo-fi', name: 'Lo-Fi', category: 'experimental' },
  { id: 'melodic-techno', name: 'Melodic House & Techno', category: 'electronic' },
  { id: 'minimal', name: 'Minimal / Deep Tech', category: 'electronic' },
  { id: 'nu-disco', name: 'Nu Disco / Disco', category: 'club' },
  { id: 'organic-house', name: 'Organic House / Downtempo', category: 'organic' },
  { id: 'peak-techno', name: 'Peak Time Techno', category: 'electronic' },
  { id: 'progressive-house', name: 'Progressive House', category: 'electronic' },
  { id: 'psy-trance', name: 'Psy-Trance', category: 'electronic' },
  { id: 'reggaeton', name: 'Reggaeton / Latin Hip-Hop', category: 'club' },
  { id: 'tech-house', name: 'Tech House', category: 'electronic' },
  { id: 'techno-peak', name: 'Techno (Peak / Driving)', category: 'electronic' },
  { id: 'techno-raw', name: 'Techno (Raw / Deep / Hypnotic)', category: 'electronic' },
  { id: 'trance', name: 'Trance (Main Floor)', category: 'electronic' },
  { id: 'trance-raw', name: 'Trance (Raw / Deep)', category: 'electronic' },
  { id: 'ukg', name: 'UKG / Garage / Grime', category: 'club' },
  { id: 'wave', name: 'Wave', category: 'experimental' },
  // ── Extended Electronic ─────────────────────────────────────
  { id: 'hyperpop', name: 'Hyperpop', category: 'club' },
  { id: 'footwork', name: 'Footwork / Juke', category: 'club' },
  { id: 'cumbia-electronica', name: 'Cumbia Electrónica', category: 'club' },
  { id: 'latin-electronic', name: 'Latin Electronic', category: 'club' },
  { id: 'industrial', name: 'Industrial / EBM', category: 'experimental' },
  { id: 'noise', name: 'Noise / Experimental', category: 'experimental' },
  { id: 'idm', name: 'IDM / Braindance', category: 'experimental' },
  { id: 'trap', name: 'Trap / Future Bass', category: 'club' },
  { id: 'ballroom', name: 'Ballroom / Voguing', category: 'club' },
  { id: 'jersey-club', name: 'Jersey Club', category: 'club' },
  { id: 'gqom', name: 'Gqom', category: 'club' },
  { id: 'afrobeats', name: 'Afrobeats', category: 'club' },
  { id: 'deconstructed', name: 'Deconstructed Club', category: 'experimental' },
  { id: 'ambient-techno', name: 'Ambient Techno', category: 'experimental' },
  { id: 'uk-bass', name: 'UK Bass', category: 'club' },
  { id: 'ghetto-house', name: 'Ghetto House / Ghetto Tech', category: 'club' },
  // ── Organic & World ─────────────────────────────────────────
  { id: 'neo-soul', name: 'Neo Soul', category: 'organic' },
  { id: 'hip-hop', name: 'Hip Hop', category: 'organic' },
  { id: 'rnb', name: 'R&B', category: 'organic' },
  { id: 'jazz', name: 'Jazz', category: 'organic' },
  { id: 'funk', name: 'Funk', category: 'organic' },
  { id: 'soul', name: 'Soul', category: 'organic' },
  { id: 'cumbia', name: 'Cumbia', category: 'organic' },
  { id: 'salsa', name: 'Salsa', category: 'organic' },
  { id: 'dub', name: 'Dub / Reggae', category: 'organic' },
  { id: 'latin-jazz', name: 'Latin Jazz', category: 'organic' },
  { id: 'son', name: 'Son / Huapango', category: 'organic' },
]

export const TAGS: Tag[] = [
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
  { id: 'modular', name: 'Modular / Hardware' },
  { id: 'vinyl-only', name: 'Vinyl Only' },
]

export function getGenreById(id: string): Genre | undefined {
  return GENRES.find((g) => g.id === id)
}

export function getTagById(id: string): Tag | undefined {
  return TAGS.find((t) => t.id === id)
}

export function getGenreNames(ids: string[]): string[] {
  return ids.map((id) => getGenreById(id)?.name ?? id)
}

// ── Genre → vibe mapping ───────────────────────────────────────────────────
//
// Anchors a subset of genres on the 0–10 vibe spectrum (0 = glacial,
// 10 = volcán). Used by the VibeSlider to surface "GENRES IN RANGE" hints
// and by the foro catalog to vibe-filter threads via their tagged genres.
// Genres not listed here have no implied vibe and won't match the slider —
// they always pass through filters.

export const GENRE_VIBE: Record<string, number> = {
  'ambient': 0,
  'lo-fi': 1, 'downtempo': 1,
  'organic-house': 2, 'ambient-techno': 2, 'dub': 2,
  'deep-house': 3, 'minimal': 3, 'jazz': 3, 'neo-soul': 3,
  'house': 4, 'electronica': 4, 'melodic-techno': 4, 'nu-disco': 4, 'indie-dance': 4,
  'tech-house': 5, 'electro': 5, 'idm': 5, 'latin-electronic': 5,
  'techno-raw': 6, 'progressive-house': 6, 'afro-house': 6, 'breaks': 6,
  'peak-techno': 7, 'drum-and-bass': 7, 'ukg': 7, 'uk-bass': 7,
  'hard-techno': 8, 'dark-techno': 8, 'jungle': 8, 'footwork': 8, 'hard-dance': 8,
  'industrial': 9, 'noise': 9, 'deconstructed': 9,
  'psy-trance': 10, 'hyperpop': 10, 'gqom': 10,
}

export function vibeForGenre(id: string): number | null {
  return id in GENRE_VIBE ? GENRE_VIBE[id] : null
}

// Returns true if any of the supplied genre ids has a GENRE_VIBE in the
// inclusive range [min, max]. Genres not in GENRE_VIBE are ignored. If the
// thread has no mapped genres at all, it passes (treated as untagged →
// always visible) — this avoids hiding threads tagged with edge genres
// that haven't been anchored on the spectrum.
export function genresIntersectVibeRange(
  ids: string[],
  min: number,
  max: number,
): boolean {
  const mapped = ids.map(vibeForGenre).filter((v): v is number => v !== null)
  if (mapped.length === 0) return true
  return mapped.some((v) => v >= min && v <= max)
}

export function getTagNames(ids: string[]): string[] {
  return ids.map((id) => getTagById(id)?.name ?? id)
}
