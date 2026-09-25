import { NextResponse, type NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { WORLD_TAG } from '@/lib/data/tags'

// PATCH /api/comments/[id] { body } — the author rewrites their own words.
//
// Production's rule, as its RLS states it: `comments_author_edit_window`
// lets the author UPDATE their row for 15 minutes after posting, while it
// isn't retired. But `comments_mod_edit` also lets moderators update ANY
// row (that's how tombstones are written), so RLS alone would let a
// moderator rewrite someone else's comment. This route says what the policy
// can't: only the author edits the words — the update is filtered on
// author_id too, and RLS still re-checks the window. `edited_at` is stamped
// here; the UI shows «Editado».

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EDIT_WINDOW_MS = 15 * 60 * 1000
const MAX_BODY = 4000

export async function PATCH(request: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let raw: { body?: unknown }
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const body = typeof raw.body === 'string' ? raw.body.trim() : ''
  if (!body) return NextResponse.json({ error: 'El comentario no puede quedar vacío.' }, { status: 400 })
  if (body.length > MAX_BODY) return NextResponse.json({ error: `El comentario pasa de ${MAX_BODY} caracteres.` }, { status: 400 })
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: 'Ese comentario ya no está.' }, { status: 404 })

  const { data: row, error: readError } = await supabase
    .from('comments')
    .select('id, author_id, created_at, deletion_at')
    .eq('id', params.id)
    .maybeSingle()
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 })
  if (!row) return NextResponse.json({ error: 'Ese comentario ya no está.' }, { status: 404 })
  if (row.author_id !== user.id) return NextResponse.json({ error: 'Solo quien escribió el comentario puede editarlo.' }, { status: 403 })
  if (row.deletion_at) return NextResponse.json({ error: 'Ese comentario fue retirado: ya no se edita.' }, { status: 409 })
  if (Date.now() - Date.parse(row.created_at) > EDIT_WINDOW_MS) {
    return NextResponse.json({ error: 'La ventana para editar (15 minutos) ya cerró.' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('comments')
    .update({ body, edited_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('author_id', user.id)
    .select('id, body, edited_at')
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // Nothing updated: RLS closed the window between the check and the write.
  if (!data) return NextResponse.json({ error: 'La ventana para editar (15 minutos) ya cerró.' }, { status: 403 })

  revalidateTag(WORLD_TAG, { expire: 0 })
  return NextResponse.json({ comment: data })
}
