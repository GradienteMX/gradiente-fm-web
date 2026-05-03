// ============================================================================
// scripts/seed.ts — port mock data into Supabase with seed=true flag
// ============================================================================
// One-shot, idempotent seed runner. Re-running deletes prior seed rows first
// so it converges to the same state every time.
//
// Usage:
//   npx tsx scripts/seed.ts
//
// Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
// Service-role bypasses RLS, which is the only way to seed users (auth admin
// API) + tables that reference users (FK constraint).
//
// Pre-launch checklist (see wiki/70-Roadmap/Backend Plan.md):
//   - delete from users  where seed=true   (cascades comments + foro)
//   - delete from items  where seed=true   (cascades polls + hp_events)
//   - rm .local/seed-credentials.txt
// ============================================================================

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { MOCK_USERS } from '../lib/mockUsers'
import { MOCK_ITEMS } from '../lib/mockData'
import { MOCK_COMMENTS } from '../lib/mockComments'
import { MOCK_THREADS, MOCK_REPLIES } from '../lib/mockForo'
import type { ContentItem, Comment, ForoThread, ForoReply, User } from '../lib/types'
import type { Database } from '../lib/supabase/database.types'

config({ path: resolve(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const SEED_EMAIL_DOMAIN = 'gradiente.local'  // .local TLD never resolves — safe placeholder
const SEED_PASSWORD_LEN = 24


// ── Helpers ─────────────────────────────────────────────────────────────────

function randomPassword(): string {
  // Hex from 16 random bytes is ~enough entropy; truncate to 24 chars.
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, SEED_PASSWORD_LEN)
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}


// ── Cleanup phase ───────────────────────────────────────────────────────────

async function cleanup() {
  console.log('▸ Cleanup: removing prior seed rows…')

  // 1. List + delete seed auth users by email domain. Cascades to public.users
  //    via the FK ON DELETE CASCADE, which cascades again to comments / foro / etc.
  const { data: authUsers, error: listErr } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  if (listErr) throw listErr

  const seedAuthUsers = authUsers.users.filter((u) =>
    u.email?.endsWith(`@${SEED_EMAIL_DOMAIN}`)
  )

  for (const u of seedAuthUsers) {
    const { error } = await supabase.auth.admin.deleteUser(u.id)
    if (error) console.warn(`  could not delete auth user ${u.email}:`, error.message)
  }
  if (seedAuthUsers.length > 0) {
    console.log(`  deleted ${seedAuthUsers.length} seed auth users (cascaded public.users + comments + foro)`)
  }

  // 2. Delete seeded items. Cascades to polls + hp_events + any orphan comments
  //    not already cleaned via the user cascade above.
  const { error: itemsErr, count: itemsCount } = await supabase
    .from('items')
    .delete({ count: 'exact' })
    .eq('seed', true)
  if (itemsErr) throw itemsErr
  if (itemsCount && itemsCount > 0) {
    console.log(`  deleted ${itemsCount} seed items`)
  }
}


// ── Items ───────────────────────────────────────────────────────────────────

type ItemInsert = Database['public']['Tables']['items']['Insert']

function itemToRow(item: ContentItem): ItemInsert {
  return {
    id: item.id,
    slug: item.slug,
    type: item.type,
    title: item.title,
    subtitle: item.subtitle ?? null,
    excerpt: item.excerpt ?? null,
    vibe_min: item.vibeMin,
    vibe_max: item.vibeMax,
    genres: item.genres ?? [],
    tags: item.tags ?? [],
    image_url: item.imageUrl ?? null,
    published_at: item.publishedAt,
    date: item.date ?? null,
    end_date: item.endDate ?? null,
    expires_at: item.expiresAt ?? null,
    source: item.source ?? null,
    external_id: item.externalId ?? null,
    elevated: item.elevated ?? false,
    venue: item.venue ?? null,
    venue_city: item.venueCity ?? null,
    artists: item.artists ?? null,
    ticket_url: item.ticketUrl ?? null,
    price: item.price ?? null,
    mix_url: item.mixUrl ?? null,
    embeds: (item.embeds ?? []) as unknown as Database['public']['Tables']['items']['Insert']['embeds'],
    duration: item.duration ?? null,
    tracklist: (item.tracklist ?? []) as unknown as Database['public']['Tables']['items']['Insert']['tracklist'],
    mix_series: item.mixSeries ?? null,
    recorded_in: item.recordedIn ?? null,
    mix_format: item.mixFormat ?? null,
    bpm_range: item.bpmRange ?? null,
    musical_key: item.musicalKey ?? null,
    mix_status: item.mixStatus ?? null,
    author: item.author ?? null,
    read_time: item.readTime ?? null,
    editorial: item.editorial ?? false,
    pinned: item.pinned ?? false,
    body_preview: item.bodyPreview ?? null,
    article_body: (item.articleBody ?? []) as unknown as Database['public']['Tables']['items']['Insert']['article_body'],
    footnotes: (item.footnotes ?? []) as unknown as Database['public']['Tables']['items']['Insert']['footnotes'],
    hero_caption: item.heroCaption ?? null,
    partner_kind: item.partnerKind ?? null,
    partner_url: item.partnerUrl ?? null,
    partner_last_updated: item.partnerLastUpdated ?? null,
    marketplace_enabled: item.marketplaceEnabled ?? false,
    marketplace_description: item.marketplaceDescription ?? null,
    marketplace_location: item.marketplaceLocation ?? null,
    marketplace_currency: item.marketplaceCurrency ?? null,
    marketplace_listings: (item.marketplaceListings ?? []) as unknown as Database['public']['Tables']['items']['Insert']['marketplace_listings'],
    hp: item.hp ?? null,
    hp_last_updated_at: item.hpLastUpdatedAt ?? null,
    published: true,
    seed: true,
  }
}

async function insertItems() {
  console.log(`▸ Inserting ${MOCK_ITEMS.length} items…`)
  const rows = MOCK_ITEMS.map(itemToRow)

  // Insert in batches of 100 to stay below request size limits.
  let inserted = 0
  for (const batch of chunk(rows, 100)) {
    const { error } = await supabase.from('items').insert(batch)
    if (error) throw error
    inserted += batch.length
    process.stdout.write(`  ${inserted}/${rows.length}\r`)
  }
  console.log(`  ${inserted}/${rows.length} ✓`)

  // Polls embedded on items: extract and insert separately.
  const polls = MOCK_ITEMS.flatMap((item) =>
    item.poll ? [{ item, poll: item.poll }] : []
  )
  if (polls.length > 0) {
    // Mock poll IDs are semantic strings (e.g. 'pl-fascinoma-2026-asistencia'),
    // but the polls table uses uuid. Generate fresh UUIDs — nothing else
    // references the poll id (poll ↔ item is 1:1 via item_id).
    const pollRows = polls.map(({ item, poll }) => ({
      id: randomUUID(),
      item_id: item.id,
      kind: poll.kind,
      prompt: poll.prompt,
      choices: (poll.choices ?? []) as unknown as Database['public']['Tables']['polls']['Insert']['choices'],
      multi_choice: poll.multiChoice ?? false,
      closes_at: poll.closesAt ?? null,
      created_at: poll.createdAt,
    }))
    const { error } = await supabase.from('polls').insert(pollRows)
    if (error) throw error
    console.log(`  + ${polls.length} polls`)
  }
}


// ── Users ───────────────────────────────────────────────────────────────────

interface SeedCredential {
  username: string
  email: string
  password: string
  authId: string
  role: User['role']
}

async function insertUsers(): Promise<{
  credentials: SeedCredential[]
  userIdMap: Map<string, string>
}> {
  console.log(`▸ Creating ${MOCK_USERS.length} seed auth users + public.users rows…`)
  const credentials: SeedCredential[] = []
  const userIdMap = new Map<string, string>()

  for (const u of MOCK_USERS) {
    const email = `${u.username}@${SEED_EMAIL_DOMAIN}`
    const password = randomPassword()

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { seed: true, mock_id: u.id },
    })
    if (error) throw new Error(`createUser(${email}): ${error.message}`)

    const authId = data.user.id
    userIdMap.set(u.id, authId)
    credentials.push({ username: u.username, email, password, authId, role: u.role })

    const { error: profileErr } = await supabase.from('users').insert({
      id: authId,
      username: u.username,
      display_name: u.displayName,
      role: u.role,
      is_mod: u.isMod ?? false,
      is_og: u.isOG ?? false,
      partner_id: u.partnerId ?? null,
      partner_admin: u.partnerAdmin ?? false,
      joined_at: u.joinedAt,
      seed: true,
    })
    if (profileErr) throw new Error(`insert users(${u.username}): ${profileErr.message}`)
    process.stdout.write(`  ${credentials.length}/${MOCK_USERS.length}\r`)
  }
  console.log(`  ${credentials.length}/${MOCK_USERS.length} ✓`)

  return { credentials, userIdMap }
}


// ── Comments ────────────────────────────────────────────────────────────────

async function insertComments(userIdMap: Map<string, string>) {
  console.log(`▸ Inserting ${MOCK_COMMENTS.length} seed comments…`)

  // Pre-allocate UUIDs so children can reference parents without insertion order.
  const commentIdMap = new Map<string, string>()
  for (const c of MOCK_COMMENTS) commentIdMap.set(c.id, randomUUID())

  const rows = MOCK_COMMENTS.map((c: Comment) => {
    const authorId = userIdMap.get(c.authorId)
    if (!authorId) {
      throw new Error(`comment ${c.id} references unknown author ${c.authorId}`)
    }
    return {
      id: commentIdMap.get(c.id)!,
      item_id: c.contentItemId,
      parent_id: c.parentId ? commentIdMap.get(c.parentId) ?? null : null,
      author_id: authorId,
      body: c.body,
      created_at: c.createdAt,
      edited_at: c.editedAt ?? null,
      deletion_moderator_id: c.deletion ? userIdMap.get(c.deletion.moderatorId) ?? null : null,
      deletion_reason: c.deletion?.reason ?? null,
      deletion_at: c.deletion?.deletedAt ?? null,
      seed: true,
    }
  })

  const { error } = await supabase.from('comments').insert(rows)
  if (error) throw error

  // Reactions live in comment_reactions, not on the comment itself.
  const reactions = MOCK_COMMENTS.flatMap((c) =>
    c.reactions.map((r) => ({
      comment_id: commentIdMap.get(c.id)!,
      user_id: userIdMap.get(r.userId),
      kind: r.kind,
      created_at: r.createdAt,
    }))
  ).filter((r): r is { comment_id: string; user_id: string; kind: 'provocative' | 'signal'; created_at: string } =>
    r.user_id !== undefined
  )

  if (reactions.length > 0) {
    const { error: reactErr } = await supabase.from('comment_reactions').insert(reactions)
    if (reactErr) throw reactErr
    console.log(`  + ${reactions.length} reactions`)
  }
  console.log(`  ${rows.length}/${MOCK_COMMENTS.length} ✓`)
}


// ── Foro ────────────────────────────────────────────────────────────────────

async function insertForo(userIdMap: Map<string, string>) {
  console.log(`▸ Inserting ${MOCK_THREADS.length} threads + ${MOCK_REPLIES.length} replies…`)

  const threadIdMap = new Map<string, string>()
  for (const t of MOCK_THREADS) threadIdMap.set(t.id, randomUUID())
  const replyIdMap = new Map<string, string>()
  for (const r of MOCK_REPLIES) replyIdMap.set(r.id, randomUUID())

  const threadRows = MOCK_THREADS.map((t: ForoThread) => {
    const authorId = userIdMap.get(t.authorId)
    if (!authorId) throw new Error(`thread ${t.id} unknown author ${t.authorId}`)
    return {
      id: threadIdMap.get(t.id)!,
      author_id: authorId,
      subject: t.subject,
      body: t.body,
      image_url: t.imageUrl,
      genres: t.genres,
      created_at: t.createdAt,
      bumped_at: t.bumpedAt,
      deletion_moderator_id: t.deletion ? userIdMap.get(t.deletion.moderatorId) ?? null : null,
      deletion_reason: t.deletion?.reason ?? null,
      deletion_at: t.deletion?.deletedAt ?? null,
      archived: false,
      seed: true,
    }
  })

  const { error: threadErr } = await supabase.from('foro_threads').insert(threadRows)
  if (threadErr) throw threadErr

  const replyRows = MOCK_REPLIES.map((r: ForoReply) => {
    const authorId = userIdMap.get(r.authorId)
    if (!authorId) throw new Error(`reply ${r.id} unknown author ${r.authorId}`)
    const threadId = threadIdMap.get(r.threadId)
    if (!threadId) throw new Error(`reply ${r.id} unknown thread ${r.threadId}`)
    return {
      id: replyIdMap.get(r.id)!,
      thread_id: threadId,
      author_id: authorId,
      body: r.body,
      image_url: r.imageUrl ?? null,
      created_at: r.createdAt,
      quoted_reply_ids: (r.quotedReplyIds ?? []).map((id) => replyIdMap.get(id) ?? id),
      deletion_moderator_id: r.deletion ? userIdMap.get(r.deletion.moderatorId) ?? null : null,
      deletion_reason: r.deletion?.reason ?? null,
      deletion_at: r.deletion?.deletedAt ?? null,
    }
  })

  if (replyRows.length > 0) {
    const { error: replyErr } = await supabase.from('foro_replies').insert(replyRows)
    if (replyErr) throw replyErr
  }
  console.log(`  ${threadRows.length} threads + ${replyRows.length} replies ✓`)
}


// ── Credentials file ────────────────────────────────────────────────────────

function writeCredentials(creds: SeedCredential[]) {
  const dir = resolve(process.cwd(), '.local')
  mkdirSync(dir, { recursive: true })
  const path = resolve(dir, 'seed-credentials.txt')

  const lines = [
    '# Gradiente FM — seed user credentials',
    `# Generated ${new Date().toISOString()}`,
    '#',
    '# These accounts are MOCK — every row carries seed=true and is hidden from',
    '# the public via RLS. Delete before opening the beta. See',
    '# wiki/70-Roadmap/Backend Plan.md § "Mock data migration strategy".',
    '#',
    '',
    ...creds.map(
      (c) => `${c.username.padEnd(20)}  role=${c.role.padEnd(8)}  email=${c.email.padEnd(40)}  password=${c.password}`
    ),
    '',
  ]
  writeFileSync(path, lines.join('\n'), 'utf8')
  console.log(`▸ Wrote ${creds.length} credentials → ${path}`)
}


// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const startedAt = Date.now()
  await cleanup()
  await insertItems()
  const { credentials, userIdMap } = await insertUsers()
  await insertComments(userIdMap)
  await insertForo(userIdMap)
  writeCredentials(credentials)
  console.log(`\n✓ Seed complete in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`)
}

main().catch((err) => {
  console.error('\n✗ Seed failed:', err)
  process.exit(1)
})
