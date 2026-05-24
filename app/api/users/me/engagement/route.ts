import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// /api/users/me/engagement
// GET → returns the calling user's engagement_hp scalar. Self-only by
// design — there is no /api/users/<id>/engagement variant. The scalar is
// private per [[project_user_hp_visibility]]; rendering it for anyone
// else would defeat the no-leaderboard rule.
//
// Returns 401 to anonymous viewers — the widget that consumes this is
// only mounted inside the dashboard, which itself is auth-gated.

export async function GET() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('users')
    .select('engagement_hp, engagement_hp_last_updated_at')
    .eq('id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Cast through unknown — engagement_hp is post-0018, not in generated types yet.
  const row = data as unknown as {
    engagement_hp: number | null
    engagement_hp_last_updated_at: string | null
  }

  return NextResponse.json({
    engagement_hp: Number(row.engagement_hp ?? 0),
    engagement_hp_last_updated_at: row.engagement_hp_last_updated_at,
  })
}
