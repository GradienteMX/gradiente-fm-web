import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// /api/users/me/trophies
// GET → returns the calling user's earned trophy keys. Used by the comment
// composer to render the inline-text emoji unlock buttons (only trophies
// THIS user has earned get displayed as affordances; tokens for unearned
// trophies stay invisible). Self-only by virtue of the session.
//
// Anonymous viewers don't have trophies — return 401 so the composer
// doesn't waste a fetch cycle.

export async function GET() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('user_trophies')
    .select('trophy_key, earned_at')
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Cast through unknown — user_trophies isn't in generated types yet.
  const rows = (data ?? []) as unknown as { trophy_key: string; earned_at: string }[]
  return NextResponse.json({
    keys: rows.map((r) => r.trophy_key),
  })
}
