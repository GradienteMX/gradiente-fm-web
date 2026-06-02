import { createClient } from '@/lib/supabase/server'

// Composer vibe-prior — operationalizes Vibe Philosophy idea #3 ("the system
// learns context"). At compose time we suggest a vibe RANGE drawn from the
// author's past items, the venue's past events, and items sharing the chosen
// genres. Confidence narrows the band: lots of consistent history → a tight
// suggestion; little or scattered history → a wide one. The editor always
// overrides — this is a starting position, not a constraint. No new schema; it
// reads existing items. (Future: weight by crowd median via
// vibe_check_aggregates instead of the author-set midpoint.)

export interface VibePrior {
  vibeMin: number
  vibeMax: number
  sampleCount: number
  basis: string
}

export interface VibePriorInput {
  authorId: string
  genres?: string[]
  venue?: string | null
}

const W_AUTHOR = 3
const W_VENUE = 2
const W_GENRE = 1
const LIMIT = 60

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x))
}

export async function computeVibePrior(input: VibePriorInput): Promise<VibePrior | null> {
  const supabase = createClient()
  const genres = (input.genres ?? []).filter(Boolean)
  const venue = input.venue?.trim() || null

  // Dedup by item id, keeping the MAX applicable source weight per item so an
  // item that is both "yours" and "in-genre" counts once, at the author weight.
  const byId = new Map<string, { w: number; mid: number }>()
  const addRows = (
    rows: { id: string; vibe_min: number; vibe_max: number }[] | null,
    w: number,
  ): number => {
    let added = 0
    for (const r of rows ?? []) {
      const mid = (r.vibe_min + r.vibe_max) / 2
      const prev = byId.get(r.id)
      if (!prev || w > prev.w) byId.set(r.id, { w, mid })
      added++
    }
    return added
  }

  const { data: authorRows } = await supabase
    .from('items').select('id, vibe_min, vibe_max')
    .eq('published', true).eq('created_by', input.authorId).limit(LIMIT)
  const nAuthor = addRows(authorRows, W_AUTHOR)

  let nVenue = 0
  if (venue) {
    const { data: venueRows } = await supabase
      .from('items').select('id, vibe_min, vibe_max')
      .eq('published', true).eq('venue', venue).limit(LIMIT)
    nVenue = addRows(venueRows, W_VENUE)
  }

  let nGenre = 0
  if (genres.length > 0) {
    const { data: genreRows } = await supabase
      .from('items').select('id, vibe_min, vibe_max')
      .eq('published', true).overlaps('genres', genres).limit(LIMIT)
    nGenre = addRows(genreRows, W_GENRE)
  }

  const samples = Array.from(byId.values())
  const n = samples.length
  if (n === 0) return null

  const wSum = samples.reduce((s, x) => s + x.w, 0)
  const center = samples.reduce((s, x) => s + x.w * x.mid, 0) / wSum
  const variance = samples.reduce((s, x) => s + x.w * (x.mid - center) ** 2, 0) / wSum
  const sd = Math.sqrt(variance)

  // Confidence → narrowness: base uncertainty shrinks with √n; observed spread
  // (sd) widens it. Clamped so we never suggest a hair-thin or full-spectrum band.
  const halfWidth = clamp(sd + 2.5 / Math.sqrt(n), 0.75, 3)
  const lo = clamp(Math.round(center - halfWidth), 0, 10)
  const hi = clamp(Math.round(center + halfWidth), 0, 10)

  const parts: string[] = []
  if (nAuthor > 0) parts.push('tu historial')
  if (venue && nVenue > 0) parts.push(venue)
  if (genres.length > 0 && nGenre > 0) parts.push('géneros afines')
  const basis = parts.join(' · ') || `${n} piezas`

  return { vibeMin: Math.min(lo, hi), vibeMax: Math.max(lo, hi), sampleCount: n, basis }
}
