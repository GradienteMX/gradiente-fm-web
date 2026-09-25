/**
 * WORLD — the pure core.
 *
 * The client keeps no database of its own. It keeps a *snapshot* the server
 * read (lib/data/world.ts: the public world every member sees, plus the
 * viewer's private rows) and applies what this person does on top of it,
 * action by action, the instant they do it. `reduce` is that step. The
 * provider (world.tsx) keeps the actions until the server has them, and
 * replays the ones still unsettled over every fresh snapshot.
 *
 * The mechanics are production's own, mirrored so a gesture shows at once:
 *
 *   HL (item)      spawn 20/50 · exponential decay · click .5 / open 1.5 /
 *                  save 4 / comment 3 · novelty-weighted ×0.6–1.5 (private)
 *   Presence       the viewer's own scalar (users.engagement_hp) moves with
 *                  what they do; someone else's is never held here (admins
 *                  hold the ledger rows, never the scalar)
 *   Calibration    the crowd band arrives aggregated on each item; the only
 *                  reading held is the viewer's, and it adjusts the count
 *   Polls          tallies arrive aggregated; the viewer's vote moves them
 *   Harvest        once · 40 % echo · 1.7× decay afterwards
 *   Trophies       read from user_trophies; the server grants them (cron),
 *                  the client never invents one
 *
 * Nothing here touches React, the DOM, or the clock: every action carries
 * its own timestamp, so replay is deterministic.
 */

import { produce, type Draft as ImmerDraft } from 'immer'
import type {
  ActivityRow,
  Comment,
  ContentItem,
  ContentType,
  Draft,
  ForoReply,
  ForoThread,
  HpLedgerRow,
  MarketplaceListing,
  PresenceRow,
  ReactionKind,
  User,
} from '@/lib/types'
import { currentHp } from '@/lib/curation'
import { TROPHY_CATALOG, type TrophyKey } from '@/lib/trophies'
import { buildStickerCatalog } from '@/lib/stickers/catalog'
import { PLACEMENT_BLEED, PLACEMENT_SCALE, type CardFace, type StickerCopy, type StickerDef, type StickerPlacement, type StickerVia } from '@/lib/stickers/types'
import type { AdminWorld, PollTally, PrivateWorld, PublicWorld } from './snapshot'

// ── constants (mirrors of the SQL knobs) ────────────────────────────────────

export const SPAWN_HP_DEFAULT = 20
export const SPAWN_HP_EDITORIAL = 50
export const KIND_WEIGHTS = { click: 0.5, open: 1.5, save: 4, comment: 3 } as const
export type ReaderKind = keyof typeof KIND_WEIGHTS

export const ECHO_FACTOR = 0.4
export const HARVEST_MULTIPLIER = 1.7

export const PRESENCE_WEIGHTS = {
  reaction_received: 1,
  comment_saved: 2,
  item_saved: 3,
  comment_received: 1,
  vibe_check_cast: 0.5,
  vibe_check_accurate: 2,
} as const

export const PUBLISH_WEIGHT: Partial<Record<ContentType, number>> = {
  noticia: 2,
  evento: 3,
  mix: 5,
  review: 5,
  editorial: 5,
  articulo: 5,
  opinion: 4,
  listicle: 4,
}

const PRESENCE_HALF_LIFE_H = 1440 // 60 days
const AFFINITY_HALF_LIFE_D = 45
const NOVELTY = { min: 0.6, max: 1.5, gamma: 1, coldStart: 15, w: { genre: 0.5, type: 0.2, vibe: 0.3 } }

export const FORO_THREAD_CAP = 30

/** A night's stub can be claimed until a week after it ends. */
export const STUB_WINDOW_MS = 7 * 86_400_000

// ── state ───────────────────────────────────────────────────────────────────

/** One person's calibration of a piece: [low, high] on the 0–10 axis. */
export type Reading = [number, number]

export interface InviteRow {
  code: string
  name: string
  role: User['role']
  isMod?: boolean
  franjaId?: string
  franjaAdmin?: boolean
  folio: string
  issued: string
  createdAt: string
  expiresAt?: string
  usedBy?: string
  usedAt?: string
}

export interface WaitlistRow {
  id: string
  alias: string
  email: string
  city: string
  source?: string
  at: string
  status: 'espera' | 'invitado' | 'registrado'
}

export interface ReportRow {
  id: string
  reporterId: string
  targetType: 'item' | 'comment' | 'foro_thread' | 'foro_reply' | 'listing'
  targetId: string
  reason: 'spam' | 'acoso' | 'odio' | 'sexual' | 'violencia' | 'enganoso' | 'copyright' | 'otro'
  note?: string
  at: string
  status: 'abierto' | 'resuelto' | 'descartado'
  resolution?: string
  /** When it was closed (resolved or dismissed). */
  resolvedAt?: string
}

export interface ListingComment {
  id: string
  listingId: string
  franjaId: string
  authorId: string
  body: string
  parentId: string | null
  isSeller: boolean
  at: string
}

export interface World {
  /** When the server snapshot this world was built from was read (ms). */
  seedNow: number
  /** Who is looking: their user id, or null (anonymous, or the dev preview). */
  viewer: string | null
  /** Central's ledgers are laid in (an admin on /central): everyone's presence rows, save counts, the access pipeline. */
  admin: boolean
  items: Record<string, ContentItem>
  /** Oldest first (the snapshot by publication), then what was published here. */
  order: string[]
  users: Record<string, User>
  comments: Record<string, Comment>
  threads: Record<string, ForoThread>
  replies: Record<string, ForoReply>
  /** The viewer's own readings: itemId → (viewerId → band). The crowd lives on the items. */
  readings: Record<string, Record<string, Reading>>
  /** The viewer's saves: viewerId → (itemId → saved at). */
  saves: Record<string, Record<string, string>>
  savedComments: Record<string, Record<string, string>>
  /** The viewer's votes: pollId → (viewerId → choice ids). */
  pollVotes: Record<string, Record<string, string[]>>
  /** Every poll's result, as the server counted it and as the viewer's vote moves it. */
  pollTally: Record<string, PollTally>
  drafts: Record<string, Draft>
  /** Item HL gestures: the whole ledger for admins, this session's own gestures for everyone else. */
  ledger: HpLedgerRow[]
  /** Presence rows: the viewer's own (admins: every creator's). */
  presence: PresenceRow[]
  presenceKeys: Record<string, true>
  /** The viewer's presence scalar only. */
  userHp: Record<string, { hp: number; at: string }>
  trophies: Record<string, Partial<Record<TrophyKey, string>>>
  /** Admins only: itemId → saves (a count, never who). */
  saveCounts: Record<string, number> | null
  affinity: Record<string, { at: string; w: Record<string, number> }>
  /** The viewer's followed franjas: viewerId → franja ids (private, franja_follows). */
  follows: Record<string, string[]>
  reports: ReportRow[]
  waitlist: WaitlistRow[]
  invites: InviteRow[]
  listingComments: ListingComment[]
  /** The activity watermark, per device (localStorage — see efectos/personas.ts), never on the server. */
  activitySeen: Record<string, string>
  /** Throttle for click/open per (user,item). */
  lastTouch: Record<string, number>
  /** Sticker catalog — derived from franjas and nights at init, never logged. */
  stickers: Record<string, StickerDef>
  /** Every sticker copy anyone holds, by uid (applied or not). */
  binder: Record<string, StickerCopy>
  /** Copies pressed onto a credencial, by uid. */
  placements: Record<string, StickerPlacement>
  /** Next serial per limited-edition sticker. */
  stickerSerials: Record<string, number>
  /** Nights' stubs ever claimed, `userId:stickerId` → when (survives scraping). */
  stubsClaimed: Record<string, string>
  /** The viewer's closed-beta store vouchers left (lib/stickers/beta.ts). */
  stickerVouchers: number
}

// ── actions ─────────────────────────────────────────────────────────────────

type At = { at: string }

export type Action =
  | ({ t: 'touch'; userId: string; itemId: string; kind: 'click' | 'open' } & At)
  | ({ t: 'save'; userId: string; itemId: string; on: boolean } & At)
  | ({ t: 'reading'; userId: string; itemId: string; band: Reading | null } & At)
  | ({ t: 'comment'; comment: Comment } & At)
  | ({ t: 'comment-edit'; id: string; body: string } & At)
  | ({ t: 'comment-tombstone'; id: string; moderatorId: string; reason: string } & At)
  | ({ t: 'comment-restore'; id: string } & At)
  | ({ t: 'react'; userId: string; commentId: string; kind: ReactionKind | null } & At)
  | ({ t: 'save-comment'; userId: string; commentId: string; on: boolean } & At)
  | ({ t: 'vote'; userId: string; pollId: string; choiceIds: string[] } & At)
  | ({ t: 'thread'; thread: ForoThread } & At)
  | ({ t: 'reply'; reply: ForoReply } & At)
  | ({ t: 'foro-tombstone'; target: 'thread' | 'reply'; id: string; moderatorId: string; reason: string | null } & At)
  | ({ t: 'draft-save'; draft: Draft } & At)
  | ({ t: 'draft-delete'; id: string } & At)
  | ({ t: 'publish'; draftId: string | null; item: ContentItem; authorId: string } & At)
  | ({ t: 'item-delete'; itemId: string } & At)
  | ({ t: 'pin'; itemId: string; on: boolean } & At)
  | ({ t: 'harvest'; userId: string; itemId: string } & At)
  | ({ t: 'hp-adjust'; adminId: string; itemId: string; delta: number; note: string } & At)
  | ({ t: 'profile'; userId: string; patch: Partial<Pick<User, 'displayName' | 'bio' | 'firma' | 'location' | 'avatarUrl'>> } & At)
  | ({ t: 'user-admin'; userId: string; patch: Partial<Pick<User, 'role' | 'isMod' | 'isOG' | 'franjaId' | 'franjaAdmin'>> } & At)
  | ({ t: 'follow'; userId: string; franjaId: string; on: boolean } & At)
  | ({ t: 'report'; report: ReportRow } & At)
  | ({ t: 'report-resolve'; id: string; status: 'resuelto' | 'descartado'; resolution: string } & At)
  | ({ t: 'waitlist-status'; id: string; status: WaitlistRow['status'] } & At)
  /** Central removes a waitlist signal (spam, duplicates, a person asking out). */
  | ({ t: 'waitlist-delete'; id: string } & At)
  | ({ t: 'invite'; row: InviteRow } & At)
  | ({ t: 'franja-patch'; franjaId: string; patch: Partial<ContentItem> } & At)
  | ({ t: 'listing-upsert'; franjaId: string; listing: MarketplaceListing } & At)
  | ({ t: 'listing-delete'; franjaId: string; listingId: string } & At)
  | ({ t: 'listing-comment'; comment: ListingComment } & At)
  | ({ t: 'seen'; userId: string } & At)
  /** Authors withdraw their own listing question/answer; a question leaves with its answers. */
  | ({ t: 'listing-comment-delete'; id: string; userId: string } & At)
  /** A sticker copy enters someone's binder: a store purchase, a ticket, a gift. */
  | ({ t: 'sticker-get'; userId: string; stickerId: string; uid: string; via: StickerVia } & At)
  /** Pressed onto the credencial — permanent (it can only be scraped). */
  | ({ t: 'sticker-apply'; userId: string; uid: string; face: CardFace; x: number; y: number; rot: number; scale: number } & At)
  /** One pass of the scraper; at full wear the sticker is gone. */
  | ({ t: 'sticker-scrape'; userId: string; uid: string; amount: number; /** The wear this pass leaves (replays can't scrape twice). */ wear?: number } & At)

export type ActionType = Action['t']

// ── from the snapshot ───────────────────────────────────────────────────────

function byId<T extends { id: string }>(rows: T[]): Record<string, T> {
  const out: Record<string, T> = {}
  for (const r of rows) out[r.id] = r
  return out
}

/**
 * The world as the server read it: the public snapshot, with the viewer's
 * own rows laid in when someone is signed in, and Central's ledgers when an
 * admin has /central open (`admin`, read by that page only). Anonymous (and
 * the development preview) get the public part and no viewer.
 */
export function initWorld(pub: PublicWorld, priv: PrivateWorld | null, admin: AdminWorld | null = null): World {
  const items: Record<string, ContentItem> = {}
  const order: string[] = []
  // The snapshot arrives newest first; the order is kept oldest first so what
  // gets published here lands at the end, where it happened.
  for (let i = pub.items.length - 1; i >= 0; i--) {
    const it = pub.items[i]
    items[it.id] = it
    order.push(it.id)
  }

  const users = byId(pub.users)
  const viewer = priv ? priv.me.id : null
  const nowIso = new Date(pub.at).toISOString()

  const w: World = {
    seedNow: pub.at,
    viewer,
    admin: Boolean(priv && admin),
    items,
    order,
    users,
    comments: byId(pub.comments),
    threads: byId(pub.threads),
    replies: byId(pub.replies),
    readings: {},
    saves: {},
    savedComments: {},
    pollVotes: {},
    pollTally: structuredClone(pub.polls),
    drafts: {},
    ledger: [],
    presence: [],
    presenceKeys: {},
    userHp: {},
    trophies: pub.trophies,
    saveCounts: null,
    affinity: {},
    follows: {},
    reports: [],
    waitlist: [],
    invites: [],
    listingComments: pub.listingComments,
    activitySeen: {},
    lastTouch: {},
    // The catalog is derived from the franjas and nights on the field; the
    // copies and placements are the real rows (migration 0052) — never a
    // made-up collection.
    stickers: buildStickerCatalog(pub.items),
    binder: {},
    placements: Object.fromEntries((pub.placements ?? []).map((p) => [p.uid, p])),
    stickerSerials: { ...(pub.stickerSerials ?? {}) },
    stubsClaimed: {},
    stickerVouchers: 0,
  }

  if (priv && viewer) {
    // The freshest copy of the viewer's own row wins over the shared snapshot's.
    w.users[viewer] = priv.me
    if (priv.stickers) {
      for (const c of priv.stickers.copies) w.binder[c.uid] = c
      for (const [stickerId, at] of Object.entries(priv.stickers.claims)) w.stubsClaimed[`${viewer}:${stickerId}`] = at
      w.stickerVouchers = priv.stickers.vouchers
    }
    for (const [itemId, band] of Object.entries(priv.readings)) {
      w.readings[itemId] = { [viewer]: band }
      // One cast per piece counts, ever: re-calibrating never adds presence twice.
      w.presenceKeys[`cast:${itemId}:${viewer}`] = true
    }
    w.saves[viewer] = { ...priv.saves }
    w.savedComments[viewer] = { ...priv.savedComments }
    for (const [pollId, choices] of Object.entries(priv.votes)) w.pollVotes[pollId] = { [viewer]: choices }
    // A draft is keyed by its item's id (production's natural key); when that
    // id is already published, the draft is an edit of it.
    for (const d of priv.drafts) w.drafts[d.id] = items[d.item.id] && !d.publishedId ? { ...d, publishedId: d.item.id } : d
    w.userHp[viewer] = priv.presence ?? { hp: 0, at: nowIso }
    w.follows[viewer] = [...(priv.follows ?? [])]
    w.presence = admin ? admin.presence : priv.presenceRows
    w.reports = priv.reports
    if (admin) {
      w.ledger = admin.ledger
      w.waitlist = admin.waitlist
      w.invites = admin.invites
      w.saveCounts = { ...admin.saveCounts }
    }
  }
  return w
}

// ── polls: choice resolution (mirrors production's lib/polls.ts) ────────────

export interface ResolvedChoice {
  id: string
  label: string
  sub?: string
}

export const ATTENDANCE_CHOICES: ResolvedChoice[] = [
  { id: 'voy', label: 'VOY' },
  { id: 'tal-vez', label: 'TAL VEZ' },
  { id: 'no-puedo', label: 'NO PUEDO' },
]

/**
 * The live choices of an item's poll. The ids are the ones stored in
 * `poll_votes.choice_ids` — `track-N` for a list's tracks, `tk-N` for a
 * tracklist, the fixed attendance trio, a freeform poll's own — so the
 * server's tallies land on the right rows.
 */
export function resolvePollChoices(item: ContentItem): ResolvedChoice[] {
  const poll = item.poll
  if (!poll) return []
  switch (poll.kind) {
    case 'attendance':
      return ATTENDANCE_CHOICES
    case 'from-tracklist':
      return (item.tracklist ?? []).map((t, i) => ({ id: `tk-${i}`, label: t.title, sub: t.artist }))
    case 'from-list':
      return (item.articleBody ?? [])
        .filter((b): b is Extract<NonNullable<ContentItem['articleBody']>[number], { kind: 'track' }> => b.kind === 'track')
        .map((b, i) => ({ id: `track-${i}`, label: b.title, sub: b.artist }))
    case 'freeform':
      return (poll.choices ?? []).map((c) => ({ id: c.id, label: c.label }))
  }
}

// ── mechanics ───────────────────────────────────────────────────────────────

type W = ImmerDraft<World>

function vibeBucket(item: ContentItem): string {
  const mid = (item.vibeMin + item.vibeMax) / 2
  return mid <= 3 ? 'low' : mid <= 6 ? 'mid' : 'high'
}

/** Novelty multiplier for this user touching this item (private, never shown). */
export function noveltyMultiplier(w: World | W, userId: string, item: ContentItem, atIso: string): number {
  const aff = w.affinity[userId]
  if (!aff) return 1
  const decay = Math.pow(0.5, (Date.parse(atIso) - Date.parse(aff.at)) / 86_400_000 / AFFINITY_HALF_LIFE_D)
  const get = (k: string) => (aff.w[k] ?? 0) * decay
  const sumPrefix = (p: string) =>
    Object.entries(aff.w).reduce((s, [k, v]) => (k.startsWith(p) ? s + v * decay : s), 0)
  const typeTotal = sumPrefix('type:')
  if (typeTotal < NOVELTY.coldStart) return 1
  let num = 0
  let den = 0
  const genreTotal = sumPrefix('genre:')
  if (genreTotal > 0 && item.genres.length) {
    const phi = item.genres.reduce((s, g) => s + get('genre:' + g) / genreTotal, 0) / item.genres.length
    num += NOVELTY.w.genre * phi
    den += NOVELTY.w.genre
  }
  if (typeTotal > 0) {
    num += NOVELTY.w.type * (get('type:' + item.type) / typeTotal)
    den += NOVELTY.w.type
  }
  const vibeTotal = sumPrefix('vibe:')
  if (vibeTotal > 0) {
    num += NOVELTY.w.vibe * (get('vibe:' + vibeBucket(item)) / vibeTotal)
    den += NOVELTY.w.vibe
  }
  const phi = den > 0 ? num / den : 0
  const m = NOVELTY.min + (NOVELTY.max - NOVELTY.min) * Math.pow(1 - phi, NOVELTY.gamma)
  return Math.min(NOVELTY.max, Math.max(NOVELTY.min, m))
}

function touchAffinity(w: W, userId: string, item: ContentItem, atIso: string) {
  const prev = w.affinity[userId]
  const decay = prev ? Math.pow(0.5, (Date.parse(atIso) - Date.parse(prev.at)) / 86_400_000 / AFFINITY_HALF_LIFE_D) : 1
  const weights: Record<string, number> = {}
  if (prev) for (const [k, v] of Object.entries(prev.w)) weights[k] = v * decay
  const n = item.genres.length
  for (const g of item.genres) weights['genre:' + g] = (weights['genre:' + g] ?? 0) + 1 / n
  weights['type:' + item.type] = (weights['type:' + item.type] ?? 0) + 1
  weights['vibe:' + vibeBucket(item)] = (weights['vibe:' + vibeBucket(item)] ?? 0) + 1
  w.affinity[userId] = { at: atIso, w: weights }
}

function hpNow(item: ContentItem, atIso: string): number {
  return currentHp(item, new Date(atIso))
}

/** Item-side HL event: decays to `at`, adds the weighted amount, re-anchors. */
function recordItemHp(w: W, userId: string, itemId: string, kind: ReaderKind, atIso: string) {
  const item = w.items[itemId] as ContentItem | undefined
  if (!item || item.type === 'franja') return
  const base = KIND_WEIGHTS[kind]
  const m = noveltyMultiplier(w, userId, item, atIso)
  const weight = base * m
  const now = hpNow(item, atIso)
  w.items[itemId].hp = now + weight
  w.items[itemId].hpLastUpdatedAt = atIso
  w.ledger.push({ itemId, kind, baseWeight: base, weight, at: atIso })
  touchAffinity(w, userId, item, atIso)
}

function presenceNow(w: World | W, userId: string, atIso: string): number {
  const p = w.userHp[userId]
  if (!p) return 0
  const dt = Math.max(0, (Date.parse(atIso) - Date.parse(p.at)) / 3_600_000)
  return p.hp * Math.pow(0.5, dt / PRESENCE_HALF_LIFE_H)
}

export function currentPresence(w: World, userId: string, atIso: string): number {
  return presenceNow(w, userId, atIso)
}

/**
 * A presence gesture, shown at once where this world may hold it: the
 * viewer's own ledger and scalar, and — for admins — every creator's ledger
 * rows. Anyone else's presence is private and never written here.
 */
function recordPresence(w: W, userId: string | undefined, kind: PresenceRow['kind'], weight: number, key: string, atIso: string) {
  if (!userId || !w.users[userId]) return
  if (userId !== w.viewer && !w.admin) return
  if (w.presenceKeys[key]) return
  w.presenceKeys[key] = true
  w.presence.push({ userId, kind, weight, at: atIso, key })
  if (w.userHp[userId]) w.userHp[userId] = { hp: presenceNow(w, userId, atIso) + weight, at: atIso }
}

/**
 * The viewer's own reading moves the crowd count at once. The medians can
 * only be recomputed when theirs is the only reading here; otherwise the
 * other readings aren't in this world and the band stays the server's until
 * the next snapshot.
 */
function adjustCrowd(it: ImmerDraft<ContentItem>, had: Reading | null, next: Reading | null) {
  const others = Math.max(0, (it.vibeCheckCount ?? 0) - (had ? 1 : 0))
  const count = others + (next ? 1 : 0)
  if (count === 0) {
    delete it.vibeCheckCount
    delete it.vibeCheckMedianMin
    delete it.vibeCheckMedianMax
    return
  }
  it.vibeCheckCount = count
  if (others === 0 && next) {
    it.vibeCheckMedianMin = next[0]
    it.vibeCheckMedianMax = next[1]
  }
}

// ── ranks & counts (derived) ────────────────────────────────────────────────

export function reactionsReceived(w: World | W, userId: string) {
  let signal = 0
  let provocative = 0
  for (const c of Object.values(w.comments)) {
    if (c.authorId !== userId || c.deletion) continue
    for (const r of c.reactions) {
      if (r.userId === userId) continue
      if (r.kind === 'signal') signal++
      else provocative++
    }
  }
  return { signal, provocative }
}

/** The crowd band of a piece as this world knows it (the server's count, moved by the viewer's reading). */
export function crowdStats(w: World, itemId: string): { count: number; medianMin?: number; medianMax?: number } {
  const it = w.items[itemId]
  if (!it?.vibeCheckCount) return { count: 0 }
  return { count: it.vibeCheckCount, medianMin: it.vibeCheckMedianMin, medianMax: it.vibeCheckMedianMax }
}

// ── reducer ─────────────────────────────────────────────────────────────────

const THROTTLE_MS = 60 * 60 * 1000

export function reduce(world: World, a: Action): World {
  return produce(world, (w) => {
    switch (a.t) {
      case 'touch': {
        const key = `${a.userId}:${a.itemId}:${a.kind}`
        const t = Date.parse(a.at)
        if (w.lastTouch[key] && t - w.lastTouch[key] < THROTTLE_MS) return
        w.lastTouch[key] = t
        recordItemHp(w, a.userId, a.itemId, a.kind, a.at)
        return
      }
      case 'save': {
        const mine = (w.saves[a.userId] ??= {})
        if (a.on) {
          if (mine[a.itemId]) return
          mine[a.itemId] = a.at
          if (w.saveCounts) w.saveCounts[a.itemId] = (w.saveCounts[a.itemId] ?? 0) + 1
          recordItemHp(w, a.userId, a.itemId, 'save', a.at)
          const creator = w.items[a.itemId]?.createdById
          if (creator && creator !== a.userId)
            recordPresence(w, creator, 'item_saved', PRESENCE_WEIGHTS.item_saved, `item_saved:${a.itemId}:${a.userId}`, a.at)
        } else {
          if (!mine[a.itemId]) return
          delete mine[a.itemId]
          if (w.saveCounts?.[a.itemId]) w.saveCounts[a.itemId] -= 1
        }
        return
      }
      case 'reading': {
        const r = (w.readings[a.itemId] ??= {})
        const had = r[a.userId] ?? null
        const it = w.items[a.itemId]
        if (a.band) {
          const band: Reading = [Math.min(a.band[0], a.band[1]), Math.max(a.band[0], a.band[1])]
          r[a.userId] = band
          if (it) adjustCrowd(it, had, band)
          recordPresence(w, a.userId, 'vibe_check_cast', PRESENCE_WEIGHTS.vibe_check_cast, `cast:${a.itemId}:${a.userId}`, a.at)
        } else if (had) {
          delete r[a.userId]
          if (it) adjustCrowd(it, had, null)
        }
        return
      }
      case 'comment': {
        const c = a.comment
        w.comments[c.id] = c
        recordItemHp(w, c.authorId, c.contentItemId, 'comment', a.at)
        const creator = w.items[c.contentItemId]?.createdById
        if (creator && creator !== c.authorId)
          recordPresence(w, creator, 'comment_received', PRESENCE_WEIGHTS.comment_received, `comment_received:${c.contentItemId}:${c.authorId}:${a.at.slice(0, 10)}`, a.at)
        return
      }
      case 'comment-edit': {
        const c = w.comments[a.id]
        if (!c) return
        c.body = a.body
        c.editedAt = a.at
        return
      }
      case 'comment-tombstone': {
        const c = w.comments[a.id]
        if (!c) return
        c.deletion = { moderatorId: a.moderatorId, reason: a.reason, deletedAt: a.at }
        return
      }
      case 'comment-restore': {
        const c = w.comments[a.id]
        if (c) delete c.deletion
        return
      }
      case 'react': {
        const c = w.comments[a.commentId]
        if (!c) return
        c.reactions = c.reactions.filter((r) => r.userId !== a.userId)
        if (a.kind) {
          c.reactions.push({ userId: a.userId, kind: a.kind, createdAt: a.at })
          if (c.authorId !== a.userId)
            recordPresence(w, c.authorId, 'reaction_received', PRESENCE_WEIGHTS.reaction_received, `reaction_received:${c.id}:${a.userId}`, a.at)
        }
        return
      }
      case 'save-comment': {
        const mine = (w.savedComments[a.userId] ??= {})
        if (a.on) {
          mine[a.commentId] = a.at
          const c = w.comments[a.commentId]
          if (c && c.authorId !== a.userId)
            recordPresence(w, c.authorId, 'comment_saved', PRESENCE_WEIGHTS.comment_saved, `comment_saved:${c.id}:${a.userId}`, a.at)
        } else delete mine[a.commentId]
        return
      }
      case 'vote': {
        const v = (w.pollVotes[a.pollId] ??= {})
        const prev = v[a.userId]
        const tally = (w.pollTally[a.pollId] ??= { voters: 0, counts: {} })
        if (prev?.length) {
          tally.voters = Math.max(0, tally.voters - 1)
          for (const c of prev) tally.counts[c] = Math.max(0, (tally.counts[c] ?? 0) - 1)
        }
        if (a.choiceIds.length) {
          v[a.userId] = a.choiceIds
          tally.voters += 1
          for (const c of a.choiceIds) tally.counts[c] = (tally.counts[c] ?? 0) + 1
        } else delete v[a.userId]
        return
      }
      case 'thread': {
        w.threads[a.thread.id] = a.thread
        return
      }
      case 'reply': {
        w.replies[a.reply.id] = a.reply
        const t = w.threads[a.reply.threadId]
        if (t) t.bumpedAt = a.reply.createdAt
        return
      }
      case 'foro-tombstone': {
        const target = a.target === 'thread' ? w.threads[a.id] : w.replies[a.id]
        if (!target) return
        if (a.reason === null) delete target.deletion
        else target.deletion = { moderatorId: a.moderatorId, reason: a.reason, deletedAt: a.at }
        return
      }
      case 'draft-save': {
        w.drafts[a.draft.id] = a.draft
        return
      }
      case 'draft-delete': {
        delete w.drafts[a.id]
        return
      }
      case 'publish': {
        const existing = w.items[a.item.id]
        const isNew = !existing
        const spawn = a.item.editorial ? SPAWN_HP_EDITORIAL : SPAWN_HP_DEFAULT
        const item: ContentItem = {
          ...a.item,
          createdById: existing?.createdById ?? a.authorId,
          publishedAt: existing?.publishedAt ?? a.at,
          hp: existing ? existing.hp : spawn,
          hpLastUpdatedAt: existing ? existing.hpLastUpdatedAt : a.at,
        }
        w.items[item.id] = item
        if (isNew) w.order.push(item.id)
        if (a.draftId) delete w.drafts[a.draftId]
        if (isNew && item.type !== 'franja' && !item.franjaId) {
          recordPresence(w, a.authorId, 'publish', PUBLISH_WEIGHT[item.type] ?? 2, `publish:${item.id}`, a.at)
        }
        return
      }
      case 'item-delete': {
        delete w.items[a.itemId]
        w.order = w.order.filter((id) => id !== a.itemId)
        return
      }
      case 'pin': {
        const it = w.items[a.itemId]
        if (it) it.pinned = a.on
        return
      }
      case 'harvest': {
        const it = w.items[a.itemId]
        if (!it || it.harvestedAt || it.createdById !== a.userId) return
        const now = hpNow(it, a.at)
        const echo = now * ECHO_FACTOR
        it.hp = now - echo
        it.hpLastUpdatedAt = a.at
        it.hpDecayMultiplier = HARVEST_MULTIPLIER
        it.harvestedAt = a.at
        it.harvestedAmount = echo
        w.ledger.push({ itemId: it.id, kind: 'harvest', baseWeight: -echo, weight: -echo, at: a.at })
        recordPresence(w, a.userId, 'harvest', echo, `harvest:${it.id}`, a.at)
        return
      }
      case 'hp-adjust': {
        const it = w.items[a.itemId]
        if (!it) return
        const now = hpNow(it, a.at)
        const next = Math.max(0, now + a.delta)
        it.hp = next
        it.hpLastUpdatedAt = a.at
        w.ledger.push({ itemId: it.id, kind: 'admin_adjust', baseWeight: a.delta, weight: next - now, at: a.at, note: a.note })
        return
      }
      case 'profile': {
        const u = w.users[a.userId]
        if (u) Object.assign(u, a.patch)
        return
      }
      case 'user-admin': {
        const u = w.users[a.userId]
        if (u) Object.assign(u, a.patch)
        return
      }
      case 'follow': {
        const list = (w.follows[a.userId] ??= [])
        const has = list.includes(a.franjaId)
        if (a.on && !has) list.push(a.franjaId)
        if (!a.on && has) w.follows[a.userId] = list.filter((f) => f !== a.franjaId)
        return
      }
      case 'report': {
        if (w.reports.some((r) => r.reporterId === a.report.reporterId && r.targetId === a.report.targetId)) return
        w.reports.push(a.report)
        return
      }
      case 'report-resolve': {
        const r = w.reports.find((x) => x.id === a.id)
        if (r) {
          r.status = a.status
          r.resolution = a.resolution
          r.resolvedAt = a.at
        }
        return
      }
      case 'waitlist-status': {
        const r = w.waitlist.find((x) => x.id === a.id)
        if (r) r.status = a.status
        return
      }
      case 'waitlist-delete': {
        w.waitlist = w.waitlist.filter((x) => x.id !== a.id)
        return
      }
      case 'invite': {
        w.invites.push(a.row)
        return
      }
      case 'franja-patch': {
        const f = w.items[a.franjaId]
        if (f) Object.assign(f, a.patch, { franjaLastUpdated: a.at })
        return
      }
      case 'listing-upsert': {
        const f = w.items[a.franjaId]
        if (!f) return
        const list = f.marketplaceListings ?? (f.marketplaceListings = [])
        const idx = list.findIndex((l) => l.id === a.listing.id)
        if (idx >= 0) list[idx] = a.listing
        else list.unshift(a.listing)
        return
      }
      case 'listing-delete': {
        const f = w.items[a.franjaId]
        if (!f?.marketplaceListings) return
        f.marketplaceListings = f.marketplaceListings.filter((l) => l.id !== a.listingId)
        return
      }
      case 'listing-comment': {
        w.listingComments.push(a.comment)
        return
      }
      case 'seen': {
        w.activitySeen[a.userId] = a.at
        return
      }
      case 'sticker-get': {
        const def = w.stickers[a.stickerId]
        if (!def || !w.users[a.userId] || w.binder[a.uid]) return
        // A night's stub needs a ticket, and one ticket is one stub — even
        // after it's been scraped off. Claims close a week after the night.
        if (def.via === 'boleto') {
          if (a.via !== 'boleto') return
          const key = `${a.userId}:${def.id}`
          if (w.stubsClaimed[key]) return
          const ev = def.eventId ? w.items[def.eventId] : undefined
          const end = ev ? Date.parse(ev.endDate ?? ev.date ?? '') : NaN
          if (Number.isFinite(end) && Date.parse(a.at) > end + STUB_WINDOW_MS) return
          w.stubsClaimed[key] = a.at
        }
        if (a.via === 'beta') {
          if (w.stickerVouchers <= 0) return
          w.stickerVouchers -= 1
        }
        let serial: number | undefined
        if (def.edition) {
          serial = (w.stickerSerials[def.id] ?? 0) + 1
          if (serial > def.edition) return
          w.stickerSerials[def.id] = serial
        }
        w.binder[a.uid] = { uid: a.uid, stickerId: def.id, userId: a.userId, at: a.at, via: a.via, serial }
        return
      }
      case 'sticker-apply': {
        const copy = w.binder[a.uid]
        if (!copy || copy.userId !== a.userId || w.placements[a.uid]) return
        const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
        let z = 0
        for (const pl of Object.values(w.placements)) if (pl.userId === a.userId) z = Math.max(z, pl.z)
        w.placements[a.uid] = {
          uid: a.uid,
          userId: a.userId,
          face: a.face,
          x: clamp(a.x, -PLACEMENT_BLEED, 1 + PLACEMENT_BLEED),
          y: clamp(a.y, -PLACEMENT_BLEED, 1 + PLACEMENT_BLEED),
          rot: a.rot,
          scale: clamp(a.scale, PLACEMENT_SCALE[0], PLACEMENT_SCALE[1]),
          z: z + 1,
          at: a.at,
          wear: 0,
        }
        return
      }
      case 'sticker-scrape': {
        const pl = w.placements[a.uid]
        if (!pl || pl.userId !== a.userId) return
        pl.wear = a.wear !== undefined ? Math.min(1, Math.max(pl.wear, a.wear)) : Math.min(1, pl.wear + Math.max(0, a.amount))
        if (pl.wear >= 1) {
          delete w.placements[a.uid]
          delete w.binder[a.uid]
        }
        return
      }
      case 'listing-comment-delete': {
        const target = w.listingComments.find((c) => c.id === a.id)
        if (!target || target.authorId !== a.userId) return
        w.listingComments = w.listingComments.filter((c) => c.id !== a.id && c.parentId !== a.id)
        return
      }
    }
  })
}

// ── derived selectors (pure) ────────────────────────────────────────────────

export function trophiesFor(w: World, userId: string) {
  const earned = w.trophies[userId] ?? {}
  return TROPHY_CATALOG.map((t) => ({ ...t, earnedAt: earned[t.key as TrophyKey] ?? null }))
}

/** Everything that happened to a user's work or words, newest first. */
export function activityFor(w: World, userId: string): ActivityRow[] {
  const rows: ActivityRow[] = []
  const myItems = new Set(Object.values(w.items).filter((i) => i.createdById === userId).map((i) => i.id))
  const myComments = new Set(Object.values(w.comments).filter((c) => c.authorId === userId).map((c) => c.id))
  for (const c of Object.values(w.comments)) {
    if (c.authorId === userId || c.deletion) continue
    if (c.parentId && myComments.has(c.parentId)) {
      rows.push({ id: 'r:' + c.id, userId, kind: 'reply', actorId: c.authorId, itemId: c.contentItemId, commentId: c.id, text: c.body, at: c.createdAt })
    } else if (myItems.has(c.contentItemId)) {
      rows.push({ id: 'c:' + c.id, userId, kind: 'comment', actorId: c.authorId, itemId: c.contentItemId, commentId: c.id, text: c.body, at: c.createdAt })
    }
  }
  for (const c of Object.values(w.comments)) {
    if (c.authorId !== userId) continue
    for (const r of c.reactions) {
      if (r.userId === userId) continue
      rows.push({ id: `x:${c.id}:${r.userId}`, userId, kind: 'reaction', actorId: r.userId, itemId: c.contentItemId, commentId: c.id, text: r.kind === 'signal' ? '!' : '?', at: r.createdAt })
    }
  }
  const mine = w.trophies[userId] ?? {}
  for (const [k, at] of Object.entries(mine)) {
    if (!at) continue
    rows.push({ id: 't:' + k, userId, kind: 'trophy', trophyKey: k, text: k, at })
  }
  const myReplies = new Set(Object.values(w.replies).filter((r) => r.authorId === userId).map((r) => r.id))
  for (const r of Object.values(w.replies)) {
    if (r.authorId === userId) continue
    if (r.quotedReplyIds?.some((q) => myReplies.has(q))) {
      rows.push({ id: 'q:' + r.id, userId, kind: 'quote', actorId: r.authorId, threadId: r.threadId, text: r.body, at: r.createdAt })
    }
  }
  return rows.sort((a, b) => b.at.localeCompare(a.at))
}

// ── stickers (selectors) ────────────────────────────────────────────────────

/** Copies someone holds that are not on the card yet (newest first). */
export function binderOf(w: World, userId: string): StickerCopy[] {
  return Object.values(w.binder)
    .filter((c) => c.userId === userId && !w.placements[c.uid])
    .sort((a, b) => (a.at < b.at ? 1 : -1))
}

/** What's pressed onto someone's case, bottom to top. */
export function placementsOf(w: World, userId: string, face?: CardFace): StickerPlacement[] {
  return Object.values(w.placements)
    .filter((p) => p.userId === userId && (!face || p.face === face))
    .sort((a, b) => a.z - b.z)
}

export function stickersOfFranja(w: World, franjaId: string): StickerDef[] {
  return Object.values(w.stickers).filter((d) => d.source === 'franja' && d.franjaId === franjaId)
}

export function stickerOfEvent(w: World, eventId: string): StickerDef | null {
  return w.stickers[`st-ev-${eventId}`] ?? null
}

/** Whether this person holds this sticker — or, for a night's stub, ever claimed it (scraped stubs count). */
export function hasSticker(w: World, userId: string, stickerId: string): boolean {
  if (w.stubsClaimed[`${userId}:${stickerId}`]) return true
  return Object.values(w.binder).some((c) => c.userId === userId && c.stickerId === stickerId)
}

/** Copies left of a limited edition (undefined when the run is open). */
export function editionLeft(w: World, stickerId: string): number | undefined {
  const def = w.stickers[stickerId]
  if (!def?.edition) return undefined
  return Math.max(0, def.edition - (w.stickerSerials[stickerId] ?? 0))
}
