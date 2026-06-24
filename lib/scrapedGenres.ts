import { getGenreById } from './genres'

// ── Scraped-event genre + vibe seeding ──────────────────────────────────────
//
// Resident Advisor tags ~85% of its events with coarse genres (House, Techno,
// Tech House, …). We map those display names onto the Gradiente taxonomy ids
// (lib/genres.ts) so the agenda's genre filter works on scraped content, and
// we derive a PROVISIONAL vibe band from those genres.
//
// Per Vibe Philosophy idea #2 ("genre is a lie"), the vibe seed below is an
// honest stereotype, NOT a truth claim. It exists only so a fresh scraped event
// isn't a flat neutral 5/5 the moment it lands. It is overridden by:
//   * an editor regrading the item (the ingest RPC preserves a graded band on
//     re-scrape), and
//   * the crowd Vibe Check median once it crosses threshold (read-time override
//     in lib/vibeChecks.ts).
// So this is a starting position the system refines, in the spirit of
// computeVibePrior() — not a label the user is stuck with.

// RA display name (normalized) → Gradiente genre id. Keys are lowercased and
// space-collapsed; matching is done through `norm()`. Unmapped RA names are
// dropped (no tag) rather than guessed.
const RA_GENRE_TO_ID: Record<string, string> = {
  'house': 'house',
  'deep house': 'house-deep',
  'tech house': 'house-tech',
  'afro house': 'house-afro',
  'minimal / deep tech': 'techno-minimal',
  'minimal': 'techno-minimal',
  'techno': 'techno',
  'hard techno': 'techno-hard',
  'hardcore / gabba': 'techno-hard',
  'electro': 'electro',
  'electronica': 'electronica',
  'experimental': 'idm',
  'leftfield': 'idm',
  'disco': 'nu-disco',
  'disco / nu disco': 'nu-disco',
  'indie dance / nu disco': 'nu-disco',
  'funk / soul': 'soul-funk-rnb',
  'soul': 'soul',
  'funk': 'funk',
  'hip-hop': 'hip-hop-rap',
  'hip hop': 'hip-hop-rap',
  'reggaeton': 'reggaeton',
  'drum & bass': 'drum-and-bass',
  'drum and bass': 'drum-and-bass',
  'jungle': 'jungle',
  'garage': 'uk-garage',
  'uk garage': 'uk-garage',
  'bass': 'uk-bass',
  'dubstep': 'dubstep',
  'dubstep / grime / bass': 'dubstep',
  'trance': 'trance',
  'psy-trance': 'psy-trance',
  'psytrance': 'psy-trance',
  'trance / psy-trance': 'psy-trance',
  'ambient': 'ambient',
  'downtempo / balearic': 'downtempo',
  'downtempo': 'downtempo',
  'balearic': 'downtempo',
  'industrial': 'industrial',
  'breakbeat': 'breaks',
  'breaks': 'breaks',
  'dancehall / ragga': 'reggae',
  'reggae / dub': 'reggae',
  'reggae': 'reggae',
}

// Stereotype vibe anchor per mapped id (0 glacial → 10 volcán). Self-contained
// so seeding never depends on the deprecated foro-side GENRE_VIBE map; values
// mirror its placements. Only the ids RA_GENRE_TO_ID can produce need anchors.
const SEED_VIBE_BY_ID: Record<string, number> = {
  ambient: 0,
  downtempo: 1,
  reggae: 3,
  soul: 3,
  'soul-funk-rnb': 3,
  'house-deep': 3,
  funk: 4,
  house: 4,
  electronica: 4,
  'nu-disco': 4,
  'hip-hop-rap': 4,
  'techno-minimal': 4,
  idm: 5,
  electro: 5,
  'house-tech': 5,
  'house-afro': 6,
  techno: 6,
  breaks: 6,
  'uk-garage': 6,
  reggaeton: 6,
  'drum-and-bass': 7,
  dubstep: 7,
  'uk-bass': 7,
  trance: 7,
  'techno-hard': 8,
  jungle: 8,
  'psy-trance': 9,
  industrial: 9,
}

function norm(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim()
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x))
}

// Map raw RA genre display names → known Gradiente genre ids. Drops unmapped
// names and de-dups (an event tagged both "Techno" and "Hard Techno" keeps
// both distinct ids). Pass-through for values that are ALREADY valid ids, so
// callers can hand us a mix without double-mapping.
export function mapScrapedGenres(rawNames: string[] | null | undefined): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of rawNames ?? []) {
    if (typeof raw !== 'string' || !raw.trim()) continue
    const mapped = RA_GENRE_TO_ID[norm(raw)] ?? (getGenreById(raw) ? raw : null)
    if (mapped && !seen.has(mapped)) {
      seen.add(mapped)
      out.push(mapped)
    }
  }
  return out
}

// Derive a provisional vibe band from mapped genre ids. Returns null when no id
// carries an anchor (caller falls back to the neutral 5/5 default). A single
// anchored genre yields a ±1 band (it's a guess, not a measurement); multiple
// span their anchors, padded ±1. Always a valid VibeScore pair with min <= max.
export function seedVibeFromGenreIds(
  ids: string[],
): { vibeMin: number; vibeMax: number } | null {
  const vals = ids
    .map((id) => SEED_VIBE_BY_ID[id])
    .filter((v): v is number => typeof v === 'number')
  if (vals.length === 0) return null
  const lo = clamp(Math.min(...vals) - 1, 0, 10)
  const hi = clamp(Math.max(...vals) + 1, 0, 10)
  return { vibeMin: Math.min(lo, hi), vibeMax: Math.max(lo, hi) }
}
