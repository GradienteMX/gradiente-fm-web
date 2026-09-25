/**
 * What the server hands the client world — two shapes, read in two ways.
 *
 *   PublicWorld   everything every signed-in member may see, identical for
 *                 all of them (No-Algorithm: nothing in it depends on who is
 *                 asking). Read with the service role inside a shared cache
 *                 (lib/data/world.ts → loadPublicWorld, tag 'world').
 *   PrivateWorld  the viewer's own rows, read per request with their cookie
 *                 client, so RLS decides what comes back (loadPrivateWorld).
 *   AdminWorld    Central's ledgers and the access pipeline, admins only,
 *                 read by /central alone (loadAdminWorld) and laid into the
 *                 store while that page is open (WorldState.attachAdmin).
 *
 * Pure types plus the empty snapshot (anonymous visitors get that one: La
 * Puerta and La espera work without a world). The client merges both in
 * `initWorld` (world-core); nothing here imports React or Supabase.
 */

import type { Comment, ContentItem, Draft, ForoReply, ForoThread, HpLedgerRow, PresenceRow, User } from '@/lib/types'
import type { TrophyKey } from '@/lib/trophies'
import type { InviteRow, ListingComment, Reading, ReportRow, WaitlistRow } from './world-core'
import type { StickerCopy, StickerPlacement } from '@/lib/stickers/types'

/** A poll's result: distinct voters and, per choice id, how many picked it. Never who. */
export interface PollTally {
  voters: number
  counts: Record<string, number>
}

export interface PublicWorld {
  /** When these rows were read from the database (ms). */
  at: number
  /** Published items only, newest first, with crowd aggregates, attribution, entities and franja refs. */
  items: ContentItem[]
  /** Public profile fields only — no presence (HL), no profile_meta, no email (users has none). */
  users: User[]
  /** Comments on published items, reactions attached, tombstones included (they render as stubs). */
  comments: Comment[]
  /** Foro threads not archived, and their replies. */
  threads: ForoThread[]
  replies: ForoReply[]
  /** pollId → tally. */
  polls: Record<string, PollTally>
  /** userId → trophy → earned at. Public progression. */
  trophies: Record<string, Partial<Record<TrophyKey, string>>>
  /** Questions and answers under the listings of published franjas. */
  listingComments: ListingComment[]
  /** Every sticker pressed on every card (cached apart, tag 'stickers'; empty until 0052). */
  placements?: StickerPlacement[]
  /** stickerId → how many of its numbered run have been issued («quedan N»). */
  stickerSerials?: Record<string, number>
}

/** The viewer's stickers: their binder, the nights whose stub they claimed, beta vouchers left. */
export interface PrivateStickers {
  copies: StickerCopy[]
  /** stickerId → claimed at. */
  claims: Record<string, string>
  vouchers: number
}

/** Only for `role === 'admin'`, only on /central: the ledgers and the access pipeline. */
export interface AdminWorld {
  /** When these rows were read (ms). */
  at: number
  /** hp_events, reader gestures + adjustments + harvests (decay rows are recomputed, not shipped). */
  ledger: HpLedgerRow[]
  /** user_hp_events for every creator (attribution keys never leave the database). */
  presence: PresenceRow[]
  waitlist: WaitlistRow[]
  invites: InviteRow[]
  /** itemId → how many people saved it. Counts only, never who. */
  saveCounts: Record<string, number>
}

export interface PrivateWorld {
  /** When these rows were read (ms). */
  at: number
  me: User
  /** The viewer's presence (users.engagement_hp) and its anchor. Private scalar. */
  presence: { hp: number; at: string } | null
  /** The viewer's own presence ledger (user_hp_events). */
  presenceRows: PresenceRow[]
  drafts: Draft[]
  /** itemId → saved at. */
  saves: Record<string, string>
  /** commentId → saved at. */
  savedComments: Record<string, string>
  /** pollId → the viewer's choice ids. */
  votes: Record<string, string[]>
  /** itemId → the viewer's own calibration. */
  readings: Record<string, Reading>
  /** The franjas the viewer follows, oldest first (private; empty until 0053 is applied). */
  follows: string[]
  /** Reports the viewer filed; every report for moderators and admins. */
  reports: ReportRow[]
  /** The viewer's stickers (empty until 0052 is applied). */
  stickers?: PrivateStickers
}

export function emptyPublicWorld(at: number): PublicWorld {
  return { at, items: [], users: [], comments: [], threads: [], replies: [], polls: {}, trophies: {}, listingComments: [] }
}
