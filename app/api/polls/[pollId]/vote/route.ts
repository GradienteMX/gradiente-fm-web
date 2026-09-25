import { NextResponse, type NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { WORLD_TAG } from '@/lib/data/tags'

// POST   /api/polls/[pollId]/vote { choiceIds: string[] } → cast/replace vote
// DELETE /api/polls/[pollId]/vote                          → clear vote
//
// `poll_votes` PK is (poll_id, user_id). RLS gates self-only via
// poll_votes_self_write. Revoting upserts the same PK row in place. The
// table check constraint enforces array_length(choice_ids, 1) >= 1, so we
// guard up front for a clean 400 instead of a constraint error. Tallies
// travel with the public world (counted there, never who), so both writes
// expire it.

export async function POST(
  request: NextRequest,
  { params: paramsP }: { params: Promise<{ pollId: string }> }
) {
  const params = await paramsP
  const supabase = await createClient()
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

  if (error) {
    // 23503: the poll (or its piece) is gone. 22P02: not a poll id at all.
    if (error.code === '23503' || error.code === '22P02') return NextResponse.json({ error: 'Esa encuesta ya no está.' }, { status: 404 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  revalidateTag(WORLD_TAG, { expire: 0 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: NextRequest,
  { params: paramsP }: { params: Promise<{ pollId: string }> }
) {
  const params = await paramsP
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('poll_votes')
    .delete()
    .eq('poll_id', params.pollId)
    .eq('user_id', user.id)
  if (error) {
    // 23503: the poll (or its piece) is gone. 22P02: not a poll id at all.
    if (error.code === '23503' || error.code === '22P02') return NextResponse.json({ error: 'Esa encuesta ya no está.' }, { status: 404 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  revalidateTag(WORLD_TAG, { expire: 0 })
  return NextResponse.json({ ok: true })
}
