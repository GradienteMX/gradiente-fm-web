import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeVibePrior } from '@/lib/data/vibePriors'

// GET /api/vibe-prior?genres=a,b&venue=Club%20Japan
//
// Returns a composer vibe-prior for the authenticated author (Vibe Philosophy
// idea #3 — "the system learns context"). Auth-gated: composing is insider-only,
// and the prior is computed against the caller's own history. Returns
// { prior: VibePrior | null } — null when there's no history to suggest from.
export async function GET(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const params = request.nextUrl.searchParams
  const genres = (params.get('genres') ?? '')
    .split(',')
    .map((g) => g.trim())
    .filter(Boolean)
  const venue = params.get('venue')

  const prior = await computeVibePrior({ authorId: user.id, genres, venue })
  return NextResponse.json({ prior })
}
