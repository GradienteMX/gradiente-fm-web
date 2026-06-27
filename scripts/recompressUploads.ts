// ============================================================================
// scripts/recompressUploads.ts — shrink existing `uploads` bucket objects
// ============================================================================
// One-time (re-runnable) backfill that recompresses every raster object in the
// `uploads` bucket to WebP q80 capped at 1440px and re-uploads it IN PLACE with
// a 1-year cacheControl. This is the historical counterpart to the live fix in
// app/api/ingest-image/route.ts + lib/imageUpload.ts: the 225 objects already
// in the bucket are mostly 2-3 MB IG screenshots that dominate Supabase
// cached-egress.
//
// Why overwrite at the SAME path (keeping the .png/.jpg filename):
//   - The public URL is unchanged, so items.image_url / foro / marketplace rows
//     keep working with ZERO database writes (sidesteps the read-only execute_sql
//     + migration-history-drift constraints entirely).
//   - Browsers and next/image key off the stored object's content-type header
//     (set to image/webp here), not the filename extension, so a webp payload at
//     a *.png path renders fine.
//   - Re-uploading invalidates the Smart CDN cache, so the smaller bytes + long
//     TTL take effect immediately.
//
// GIFs and SVGs are skipped (recompression flattens animation / rasterizes
// vectors). Objects already stored as WebP (from a prior run or the ingest
// routes) are skipped too, so a second --apply is a true no-op and never
// re-encodes WebP→WebP (q80 is lossy — re-encoding would degrade quality).
//
// Usage:
//   npx tsx scripts/recompressUploads.ts            # dry run — report only
//   npx tsx scripts/recompressUploads.ts --apply    # actually overwrite prod
//
// Requires .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
// ============================================================================

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { resolve } from 'node:path'

config({ path: resolve(process.cwd(), '.env.local') })

const BUCKET = 'uploads'
const MAX_EDGE = 1440
const ONE_YEAR = '31536000'
const APPLY = process.argv.includes('--apply')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

interface ObjEntry {
  path: string
}

// Storage `list` is one level deep and paginates. Entries with a null `id` are
// folders → recurse.
async function listAll(prefix = ''): Promise<ObjEntry[]> {
  const out: ObjEntry[] = []
  const PAGE = 100
  let offset = 0
  for (;;) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefix, { limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' } })
    if (error) throw new Error(`list ${prefix || '/'}: ${error.message}`)
    if (!data || data.length === 0) break
    for (const entry of data) {
      const full = prefix ? `${prefix}/${entry.name}` : entry.name
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const isFolder = (entry as any).id == null
      if (isFolder) {
        out.push(...(await listAll(full)))
      } else {
        out.push({ path: full })
      }
    }
    if (data.length < PAGE) break
    offset += PAGE
  }
  return out
}

const SKIP = /\.(gif|svg)$/i
const fmt = (b: number) => `${(b / 1024 / 1024).toFixed(2)} MB`

function guessType(path: string): string {
  const ext = (path.split('.').pop() ?? '').toLowerCase()
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  return 'application/octet-stream'
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY (overwriting prod)' : 'DRY RUN (report only)'}\n`)

  const all = await listAll()
  const targets = all.filter((o) => !SKIP.test(o.path))
  const skipped = all.length - targets.length
  console.log(`Found ${all.length} objects (${skipped} gif/svg skipped, ${targets.length} to process)\n`)

  let beforeTotal = 0
  let afterTotal = 0
  let ok = 0
  let failed = 0
  let skippedWebp = 0

  for (const obj of targets) {
    try {
      const { data, error } = await supabase.storage.from(BUCKET).download(obj.path)
      if (error || !data) throw new Error(error?.message ?? 'download returned no data')
      const raw = Buffer.from(await data.arrayBuffer())

      // Already WebP (prior run / ingest routes): leave it untouched. Re-encoding
      // q80 is lossy and the 1-year TTL is already set — this keeps re-runs no-ops.
      if ((data.type || '').includes('webp')) {
        skippedWebp++
        beforeTotal += raw.length
        afterTotal += raw.length
        continue
      }

      const webp = await sharp(raw)
        .rotate()
        .resize(MAX_EDGE, MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer()

      // Never inflate: keep the original bytes when WebP isn't smaller (already
      // well-compressed thumbnails). Either way we still re-upload to apply the
      // 1-year cacheControl — that's the win for these small ones.
      const useWebp = webp.length < raw.length
      const outBuf = useWebp ? webp : raw
      const outType = useWebp ? 'image/webp' : (data.type || guessType(obj.path))

      beforeTotal += raw.length
      afterTotal += outBuf.length
      const pct = raw.length ? Math.round((1 - outBuf.length / raw.length) * 100) : 0

      if (APPLY) {
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(obj.path, outBuf, {
            upsert: true,
            contentType: outType,
            cacheControl: ONE_YEAR,
          })
        if (upErr) throw new Error(upErr.message)
      }

      ok++
      console.log(`  -${pct}%  ${fmt(raw.length)} → ${fmt(outBuf.length)}  ${obj.path}${useWebp ? '' : ' (kept original)'}`)
    } catch (e) {
      failed++
      console.log(`  FAIL  ${obj.path} — ${e instanceof Error ? e.message : e}`)
    }
  }

  const saved = beforeTotal - afterTotal
  const pct = beforeTotal ? Math.round((saved / beforeTotal) * 100) : 0
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`Processed: ${ok}   Skipped (already WebP): ${skippedWebp}   Failed: ${failed}`)
  console.log(`Before: ${fmt(beforeTotal)}   After: ${fmt(afterTotal)}   Saved: ${fmt(saved)} (${pct}%)`)
  if (!APPLY) console.log(`\nDry run — nothing written. Re-run with --apply to overwrite prod.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
