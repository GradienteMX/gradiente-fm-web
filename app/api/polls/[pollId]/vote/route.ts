import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST   /api/polls/[pollId]/vote { choiceIds: string[] } → cast/replace vote
// DELETE /api/polls/[pollId]/vote                          → clear vote
//
// `poll_votes` PK is (poll_id, user_id). RLS gates self-only via
// poll_votes_self_write. Revoting upserts the same PK row in place. The
// table check constraint enforces array_length(choice_ids, 1) >= 1, so we
// guard up front for a clean 400 instead of a constraint error.

export async function POST(
  request: NextRequest,
  { params }: { params: { pollId: string } }
) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { choiceIds?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const choiceIds = Array.isArray(body.choiceIds)
    ? body.choiceIds.filter((x): x is string => typeof x === 'string')
    : []
  if (choiceIds.length === 0) {
    return NextResponse.json({ error: 'choiceIds required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('poll_votes')
    .upsert(
      { poll_id: params.pollId, user_id: user.id, choice_ids: choiceIds },
      { onConflict: 'poll_id,user_id' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { pollId: string } }
) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('poll_votes')
    .delete()
    .eq('poll_id', params.pollId)
    .eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
