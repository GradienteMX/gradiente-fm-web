import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// /api/users/me
// PATCH → self-update of user-managed profile fields (display_name, bio,
//         firma, location, avatar_url).
//
// Self-only by virtue of the session — we never accept a target user id from
// the body. RLS (`users_self_update`) is the final gate; it already pins
// role / is_mod / is_og / partner_id / partner_admin so even if the request
// body slipped one of those in we'd fail the with-check. We still ignore
// unknown fields here for hygiene.

interface PatchBody {
  display_name?: string
  bio?: string | null
  firma?: string | null
  location?: string | null
  avatar_url?: string | null
}

const MAX_BIO_LEN = 600
const MAX_FIRMA_LEN = 140
const MAX_LOCATION_LEN = 80
const MAX_DISPLAY_NAME_LEN = 60

export async function PATCH(_request: NextRequest) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: PatchBody = {}
  try {
    body = await _request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Build patch from sent fields only. `null` is meaningful — lets the user
  // clear bio / firma / location / avatar. `display_name` is the one field
  // we won't accept empty (it's not-null in the schema).
  const patch: Record<string, string | null> = {}

  if (body.display_name !== undefined) {
    const v = body.display_name.trim()
    if (!v) return NextResponse.json({ error: 'display_name cannot be empty' }, { status: 400 })
    if (v.length > MAX_DISPLAY_NAME_LEN) {
      return NextResponse.json({ error: `display_name max ${MAX_DISPLAY_NAME_LEN} chars` }, { status: 400 })
    }
    patch.display_name = v
  }
  if (body.bio !== undefined) {
    if (body.bio !== null && body.bio.length > MAX_BIO_LEN) {
      return NextResponse.json({ error: `bio max ${MAX_BIO_LEN} chars` }, { status: 400 })
    }
    patch.bio = body.bio === null ? null : body.bio.trim() || null
  }
  if (body.firma !== undefined) {
    if (body.firma !== null && body.firma.length > MAX_FIRMA_LEN) {
      return NextResponse.json({ error: `firma max ${MAX_FIRMA_LEN} chars` }, { status: 400 })
    }
    patch.firma = body.firma === null ? null : body.firma.trim() || null
  }
  if (body.location !== undefined) {
    if (body.location !== null && body.location.length > MAX_LOCATION_LEN) {
      return NextResponse.json({ error: `location max ${MAX_LOCATION_LEN} chars` }, { status: 400 })
    }
    patch.location = body.location === null ? null : body.location.trim() || null
  }
  if (body.avatar_url !== undefined) {
    // Don't validate the URL shape here — clients should only ever send a
    // value returned by `compressAndUploadImage` (uploads bucket public URL)
    // or null. RLS doesn't gate the column itself, but the uploads bucket
    // RLS gated the write that produced the URL.
    patch.avatar_url = body.avatar_url
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Empty patch' }, { status: 400 })
  }

  // `patch` mixes never-null (display_name) and nullable columns; the post-0017
  // columns (bio/firma/location/avatar_url) aren't in the generated row type
  // yet. Cast through unknown to placate both — RLS is the final gate.
  const { data, error } = await supabase
    .from('users')
    .update(patch as unknown as Record<string, string>)
    .eq('id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ user: data })
}
