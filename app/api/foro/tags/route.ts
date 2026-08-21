import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { TAG_NAME_MAX, getTagById, slugifyTag } from '@/lib/genres'

// GET  /api/foro/tags            → { tags: [{ id, name }] }  custom tags only
// POST /api/foro/tags { name }   → { tag: { id, name } }      create one
//
// The static catalog in lib/genres.ts stays the baseline; this endpoint owns
// the growable half (migration 0047, table `foro_tags`). The composer unions
// the two, so a tag created here is visible to everyone on the next load.
//
// Creating an id that already exists — in either the static catalog or the
// table — is not an error: we return the existing tag so the composer can
// just select it. That keeps "add a tag" idempotent from the user's side.

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('foro_tags')
    .select('id, name')
    .order('created_at', { ascending: false })

  if (error) {
    // The table may not exist yet (migration pending). Degrade to "no custom
    // tags" rather than breaking the composer — the static catalog still works.
    return NextResponse.json({ tags: [] })
  }
  return NextResponse.json({ tags: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let raw: { name?: unknown }
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  if (name.length === 0 || name.length > TAG_NAME_MAX) {
    return NextResponse.json(
      { error: `El nombre del tag debe tener 1–${TAG_NAME_MAX} caracteres.` },
      { status: 400 },
    )
  }

  const id = slugifyTag(name)
  if (id.length === 0) {
    return NextResponse.json(
      { error: 'El nombre del tag necesita al menos una letra o número.' },
      { status: 400 },
    )
  }

  // Already in the shipped catalog — nothing to persist.
  const shipped = getTagById(id)
  if (shipped) return NextResponse.json({ tag: { id: shipped.id, name: shipped.name } })

  const { data, error } = await supabase
    .from('foro_tags')
    .upsert({ id, name, created_by: user.id }, { onConflict: 'id', ignoreDuplicates: true })
    .select('id, name')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  // `ignoreDuplicates` returns no row when the tag already existed — the id
  // is what the caller needs either way.
  return NextResponse.json({ tag: data ?? { id, name } })
}
