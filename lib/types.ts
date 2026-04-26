export type ContentType =
  | 'evento'
  | 'mix'
  | 'noticia'
  | 'review'
  | 'editorial'
  | 'opinion'
  | 'articulo'
  | 'listicle'
  | 'partner'

// Structured body blocks for long-form `articulo` items.
// Falls back to paragraph-split `bodyPreview` when absent.
export type ArticleBlock =
  | { kind: 'lede'; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'h2'; text: string; id?: string }
  | { kind: 'h3'; text: string }
  | { kind: 'quote'; text: string; cite?: string }
  | { kind: 'blockquote'; text: string; cite?: string }
  | { kind: 'image'; src: string; alt?: string; caption?: string }
  | { kind: 'divider' }
  | { kind: 'qa'; speaker: string; text: string; isQuestion?: boolean }
  | { kind: 'list'; items: string[]; ordered?: boolean }
  | {
      kind: 'track'
      rank?: number            // visual rank, e.g. 10, 9, 8 for a countdown
      artist: string
      title: string
      year?: string | number   // release year
      bpm?: number
      imageUrl?: string        // cover art
      embeds?: MixEmbed[]      // streaming links (uses the Mix embed shape)
      commentary?: string      // editor's take on this track
    }

export interface Footnote {
  id: string
  text: string
}

export type EmbedPlatform = 'soundcloud' | 'youtube' | 'spotify' | 'bandcamp' | 'mixcloud'

export interface MixEmbed {
  platform: EmbedPlatform
  url: string
}

export interface MixTrack {
  artist: string
  title: string
  bpm?: number
}

export type MixStatus = 'disponible' | 'exclusivo' | 'archivo' | 'proximamente'

export type PartnerKind = 'promo' | 'label' | 'promoter' | 'venue' | 'sponsored'

// 0 = glacial/ice, 10 = volcán/fire — stored as number, shown as gradient position
export type VibeScore = number

export interface ContentItem {
  id: string
  slug: string
  type: ContentType
  title: string
  subtitle?: string
  excerpt?: string
  vibe: VibeScore
  genres: string[]        // genre ids
  tags: string[]          // tag ids
  imageUrl?: string
  publishedAt: string     // ISO — when published
  date?: string           // ISO — event start / article featured date
  endDate?: string        // ISO — event end
  expiresAt?: string      // ISO — when removed from home feed
  // Event fields
  venue?: string
  venueCity?: string
  artists?: string[]
  ticketUrl?: string
  price?: string
  // Mix fields
  mixUrl?: string               // legacy / card-level primary link — prefer `embeds[0]`
  embeds?: MixEmbed[]           // multi-platform sources — drives overlay source tabs
  duration?: string             // "1:23:45"
  tracklist?: MixTrack[]        // structured per-track: artist, title, bpm
  mixSeries?: string            // "Espectro Mix"
  recordedIn?: string           // "CDMX", "Club Japan", "Faldas del Popocatépetl"
  mixFormat?: string            // "DJ Set", "Live", "Radio Show"
  bpmRange?: string             // "132-140"
  musicalKey?: string           // "D#m"
  mixStatus?: MixStatus         // disponible / exclusivo / archivo / proximamente
  // Article fields
  author?: string
  readTime?: number       // minutes
  editorial?: boolean     // editor seed flag — raises spawn HP (see Curation Model)
  pinned?: boolean        // stays at top of home page hero
  bodyPreview?: string    // first paragraph / longer teaser shown in hero
  // Long-form `articulo` fields — structured body + footnotes
  articleBody?: ArticleBlock[]
  footnotes?: Footnote[]
  heroCaption?: string    // caption for the hero/lead image
  // Partner rail fields (type === 'partner' only)
  partnerKind?: PartnerKind
  partnerUrl?: string     // outbound link (site, Instagram, Bandcamp, etc.)
  partnerLastUpdated?: string  // ISO — overrides publishedAt for rail ordering

  // Curation fields — see lib/curation.ts and 02 - Features/Curation Model
  // Both optional: when absent, spawn defaults apply and decay is from publishedAt
  hp?: number
  hpLastUpdatedAt?: string // ISO — timestamp of last HP write

  // Frontend-only metadata — never persisted to backend.
  // Set by the dashboard prototype (see lib/drafts.ts) so cards/overlays can
  // distinguish session-only items from real published content.
  _draftState?: 'draft' | 'published'
  // Frontend-only — set transiently when the editor is reviewing a draft for
  // publication (see [[Publish Confirmation Flow]]). Drives the glitch +
  // corner-confirm UI on the card.
  _pendingConfirm?: boolean
}

export interface Genre {
  id: string
  name: string
  category: 'electronic' | 'club' | 'organic' | 'experimental'
}

export interface Tag {
  id: string
  name: string
}

export type VibeRange = [number, number]

// ── Identity & permissions ──────────────────────────────────────────────────
//
// Strict role hierarchy: admin ⊃ moderator ⊃ collaborator ⊃ user.
// Higher roles inherit every capability of the roles beneath them.
// `userCategory` is meaningful only when role === 'user'; admins assign it.

export type Role = 'admin' | 'moderator' | 'collaborator' | 'user'

export type UserCategory = 'og' | 'insider' | 'normal'

export interface User {
  id: string
  username: string        // login handle, unique
  displayName: string     // shown in UI
  role: Role
  userCategory?: UserCategory  // only set when role === 'user'
  joinedAt: string        // ISO
}

// ── Comments & reactions ────────────────────────────────────────────────────
//
// Reactions are an open palette of ASCII glyphs, never emoji.
// All reaction kinds count toward "engagement" additively — no kind cancels
// another. Disagreement is signal, not suppression. See [[No Algorithm]].

export type ReactionKind =
  | 'resonates'    // [+]   agreement / endorsement
  | 'disagree'     // [-]   pushback
  | 'provocative'  // [?]   questions assumptions, productive disturbance
  | 'signal'       // [!]   important / worth surfacing

export interface Reaction {
  userId: string
  kind: ReactionKind
  createdAt: string  // ISO
}

// Moderator deletion leaves the node in place as a tombstone. Replies are
// preserved; the body is replaced with the moderator's stated reason.
export interface CommentDeletion {
  moderatorId: string
  reason: string
  deletedAt: string  // ISO
}

export interface Comment {
  id: string
  contentItemId: string   // references ContentItem.id
  parentId: string | null // null for top-level; otherwise references Comment.id
  authorId: string        // references User.id
  body: string
  createdAt: string       // ISO
  editedAt?: string       // ISO — set when author edits
  reactions: Reaction[]
  deletion?: CommentDeletion  // when set, body should render as tombstone
}

// ── Foro (imageboard-style forum) ──────────────────────────────────────────
//
// Standalone subsystem — not a ContentItem, no vibe/HP/curation, never enters
// the main grid. Catalog ordering is bumpedAt desc with a hard cap of 30
// visible threads. No reactions, no likes — the only signal is reply count.
// OP requires an image; replies don't.

export interface ForoThread {
  id: string
  authorId: string         // references User.id
  subject: string          // shown big in catalog tile + thread header
  body: string             // OP body
  imageUrl: string         // mandatory — data URL or /flyers/* path
  genres: string[]         // 1–5 genre ids — drives vibe-slider filtering
  createdAt: string        // ISO
  bumpedAt: string         // ISO — last reply, or createdAt when no replies
}

export const FORO_THREAD_GENRES_MIN = 1
export const FORO_THREAD_GENRES_MAX = 5

export interface ForoReply {
  id: string
  threadId: string         // references ForoThread.id
  authorId: string
  body: string
  imageUrl?: string        // optional on replies
  createdAt: string
  quotedReplyIds?: string[] // imageboard >>id quote-links
}
