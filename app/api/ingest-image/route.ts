import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/ingest-image  (multipart form-data: file, externalId?)
//
// Persist a flyer image into our own `uploads` bucket and return the permanent
// public URL. This exists because Instagram `og:image` URLs are signed +
// single-session: they 403 server-side ("URL signature mismatch") and stop
// rendering in-browser within hours, so the rehost-the-URL path in /api/ingest
// can't capture them. Instead the agentic scrape captures the flyer as bytes IN
// the live IG browser session (a screenshot of the rendered image — the only
// way past the signature/CORS wall) and posts those bytes here.
//
// Auth: the caller's session (cookie). The upload writes to `${user.id}/ig/...`
// — the storage RLS (0003) gates writes to the caller's own folder, so no
// service role is needed. Deterministic path on externalId so a re-capture
// overwrites instead of orphaning. See reference_instagram_scrape_flow memory.

export const runtime = 'nodejs'

function sanitizeId(s: string): string {
  return s.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 40)
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'expected multipart form-data' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file field required' }, { status: 400 })
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'file must be an image' }, { status: 400 })
  }
  if (file.size === 0 || file.size > 12_000_000) {
    return NextResponse.json({ error: 'image size out of range' }, { status: 400 })
  }

  const ext = file.type.includes('png')
    ? 'png'
    : file.type.includes('webp')
      ? 'webp'
      : 'jpg'
  const externalId = sanitizeId((form.get('externalId') ?? '').toString())
  const stamp = externalId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const path = `${user.id}/ig/${stamp}.${ext}`

  const bytes = await file.arrayBuffer()
  const { error } = await supabase.storage
    .from('uploads')
    .upload(path, bytes, { contentType: file.type, upsert: true, cacheControl: '3600' })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const url = supabase.storage.from('uploads').getPublicUrl(path).data.publicUrl
  return NextResponse.json({ ok: true, url })
}
