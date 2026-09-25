// ============================================================================
// STICKERS — the closed beta's kits, and the release's clean slate.
//
//   npx tsx scripts/stickersBeta.ts                 dry run: what each tester would get
//   npx tsx scripts/stickersBeta.ts --apply         grant every member their kit (idempotent:
//                                                   anyone who already has one is skipped)
//   npx tsx scripts/stickersBeta.ts --wipe          dry run of the release wipe (counts only)
//   npx tsx scripts/stickersBeta.ts --wipe --yes    RELEASE: delete everything from the beta
//                                                   (batch 'beta-2026': copies, placements,
//                                                   stub claims, vouchers) and reset serials
//
// The kit (lib/stickers/beta.ts): the same six copies for everyone, covering
// every material — their franja's mark when they have one, two already on
// the case at staggered ages — plus three store vouchers; admins also get a
// test sheet of every finish in their binder. Deterministic per user.
//
// Requires migration 0052 applied, and .env.local with
// NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (production!).
// ============================================================================

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { resolve } from 'node:path'

import { betaKit, STICKER_BATCH } from '../lib/stickers/beta'
import { catalogFromDb, grantBetaKit, wipeBeta } from '../lib/stickers/store'
import type { Role } from '../lib/types'

config({ path: resolve(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
const APPLY = process.argv.includes('--apply')
const WIPE = process.argv.includes('--wipe')
const YES = process.argv.includes('--yes')

async function main() {
  // Writing needs 0052; the dry run only reads users and items.
  if (APPLY || WIPE) {
    const probe = await db.from('sticker_copies').select('uid', { count: 'exact', head: true })
    if (probe.error) {
      console.error('The sticker tables are missing — apply supabase/migrations/0052_stickers.sql in the SQL editor first.')
      console.error(probe.error.message)
      process.exit(1)
    }
  }

  if (WIPE) {
    const { count: copies } = await db.from('sticker_copies').select('uid', { count: 'exact', head: true }).eq('batch', STICKER_BATCH)
    const { count: placed } = await db.from('sticker_placements').select('uid, sticker_copies!inner(batch)', { count: 'exact', head: true }).eq('sticker_copies.batch', STICKER_BATCH)
    console.log(`Beta rows: ${copies ?? 0} copies (${placed ?? '?'} pressed on cases).`)
    if (!YES) {
      console.log('Dry run — add --yes to wipe them for the release.')
      return
    }
    const out = await wipeBeta(db)
    console.log(`Wiped: ${out.copies} copies (and their placements), ${out.claims} stub claims, ${out.vouchers} voucher rows. Serial counters reset.`)
    return
  }

  const catalog = await catalogFromDb(db)
  const ids = Object.keys(catalog)
  if (!ids.length) {
    console.error('The catalog came out empty (no published franjas or nights?) — nothing to grant.')
    process.exit(1)
  }
  const { data: users, error } = await db.from('users').select('id, username, role, franja_id').order('joined_at', { ascending: true })
  if (error) throw error
  const members = (users ?? []) as Array<{ id: string; username: string; role: Role; franja_id: string | null }>
  console.log(`Catalog: ${ids.length} stickers. Members: ${members.length}.`)

  if (!APPLY) {
    const byRole = new Map<string, { people: number; copies: number; placed: number }>()
    for (const u of members) {
      const kit = betaKit({ id: u.id, role: u.role, franjaId: u.franja_id }, catalog)
      const r = byRole.get(u.role) ?? { people: 0, copies: 0, placed: 0 }
      r.people++
      r.copies += kit.copies.length
      r.placed += kit.placements.length
      byRole.set(u.role, r)
    }
    for (const [role, r] of byRole) console.log(`  ${role.padEnd(8)} ${String(r.people).padStart(3)} people · ${r.copies} copies · ${r.placed} pressed`)
    const sample = members[0]
    if (sample) {
      const kit = betaKit({ id: sample.id, role: sample.role, franjaId: sample.franja_id }, catalog)
      console.log(`\nSample — @${sample.username} (${sample.role}):`)
      kit.copies.forEach((c, i) => {
        const p = kit.placements.find((pl) => pl.copy === i)
        console.log(`  ${c.via.padEnd(6)} ${catalog[c.stickerId]?.name ?? c.stickerId}${p ? `  → pressed on the ${p.face}, ${p.ageDays} days ago` : ''}`)
      })
      console.log(`  + ${kit.vouchers} store vouchers`)
    }
    console.log('\nDry run — add --apply to grant.')
    return
  }

  let granted = 0
  let skipped = 0
  for (const u of members) {
    const r = await grantBetaKit(db, u, catalog)
    if (r.granted) {
      granted++
      console.log(`  @${u.username}: ${r.copies} copies, ${r.placed} pressed`)
    } else skipped++
  }
  console.log(`Done: ${granted} kits granted, ${skipped} members already had one.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
