import { NextResponse, type NextRequest } from 'next/server'
import sharp from 'sharp'
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
//
// Egress: IG captures arrive as multi-MB full-res PNG screenshots — the single
// biggest driver of Supabase cached-egress. Before upload we transcode to WebP
// at q80 capped to 1440px (sharp), which cuts each flyer ~6-10×, and set a
// 1-year cacheControl so the CDN + browsers stop re-fetching. Animated GIFs are
// left untouched (recompression flattens them) but still get the long TTL.

export const runtime = 'nodejs'

// Long cache: flyers are immutable once captured (deterministic path), so a
// 1-year TTL is safe and keeps the Smart CDN + browser from re-pulling bytes.
const ONE_YEAR = '31536000'
// Cap the longest edge. IG flyers display small in the grid; 1440 is plenty
// for the largest overlay while shedding most of the screenshot's pixels.
const MAX_EDGE = 1440

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

  const externalId = sanitizeId((form.get('externalId') ?? '').toString())
  const stamp = externalId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  // Transcode raster captures to WebP; pass GIFs/SVGs through unprocessed —
  // recompression flattens GIF animation and would rasterize SVG vectors (the
  // backfill skips these for the same reason).
  const isSvg = file.type.includes('svg')
  const passthrough = file.type.includes('gif') || isSvg
  const raw = Buffer.from(await file.arrayBuffer())

  let body: Buffer = raw
  let ext = isSvg ? 'svg' : 'gif'
  let contentType = isSvg ? 'image/svg+xml' : 'image/gif'
  if (!passthrough) {
    try {
      body = await sharp(raw)
        .rotate() // honor EXIF orientation before stripping metadata
        .resize(MAX_EDGE, MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer()
      ext = 'webp'
      contentType = 'image/webp'
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'image transcode failed' },
        { status: 422 },
      )
    }
  }

  const path = `${user.id}/ig/${stamp}.${ext}`
  const { error } = await supabase.storage
    .from('uploads')
    .upload(path, body, { contentType, upsert: true, cacheControl: ONE_YEAR })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const url = supabase.storage.from('uploads').getPublicUrl(path).data.publicUrl
  return NextResponse.json({ ok: true, url })
}
