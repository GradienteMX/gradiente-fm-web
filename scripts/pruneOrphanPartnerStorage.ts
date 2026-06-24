// ============================================================================
// scripts/pruneOrphanPartnerStorage.ts — delete orphaned partner pfp uploads
// ============================================================================
// The 2026-06-23 logo work briefly uploaded partner pfps to the `uploads`
// bucket as `447750a2-…/partner-<slug>-<rand>.<ext>` before we standardized on
// version-controlled static files in public/partners/. Those storage objects
// are now unreferenced (every partner.image_url points at /partners/…). This
// removes them.
//
// Scoped to the `partner-` prefix this session created — it does NOT touch the
// team's older uploads or any object still referenced by an item. Defensive:
// re-reads all item.image_url values and refuses to delete anything still in
// use.
//
// Usage:  npx tsx scripts/pruneOrphanPartnerStorage.ts          # dry run
//         npx tsx scripts/pruneOrphanPartnerStorage.ts --delete # actually remove
// ============================================================================

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { resolve } from 'node:path'

config({ path: resolve(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing env')
  process.exit(1)
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const FOLDER = '447750a2-4e18-4330-8b86-55b73ec7f8d5'

async function main() {
  const { data: list, error } = await supabase.storage
    .from('uploads')
    .list(FOLDER, { limit: 1000 })
  if (error) throw error

  const candidates = (list ?? [])
    .filter((o) => o.name.startsWith('partner-'))
    .map((o) => `${FOLDER}/${o.name}`)

  // Defensive: don't delete anything still referenced by an item.
  const { data: refs } = await supabase
    .from('items')
    .select('image_url')
    .not('image_url', 'is', null)
  const referenced = new Set((refs ?? []).map((r: { image_url: string }) => r.image_url))
  const toDelete = candidates.filter(
    (path) => ![...referenced].some((u) => typeof u === 'string' && u.includes(path)),
  )

  console.log(`partner-* objects: ${candidates.length}, still referenced: ${candidates.length - toDelete.length}, orphaned: ${toDelete.length}`)

  if (!process.argv.includes('--delete')) {
    console.log('Dry run. Re-run with --delete to remove.')
    toDelete.slice(0, 5).forEach((p) => console.log(`  would delete ${p}`))
    return
  }
  if (toDelete.length === 0) return
  const { error: delErr } = await supabase.storage.from('uploads').remove(toDelete)
  if (delErr) throw delErr
  console.log(`Deleted ${toDelete.length} orphaned objects.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
