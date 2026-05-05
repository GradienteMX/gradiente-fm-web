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

export type PartnerKind = 'promo' | 'label' | 'promoter' | 'venue' | 'sponsored' | 'dealer'

// ── Marketplace listing (lives on a partner ContentItem) ──────────────────
//
// Each marketplace-enabled partner carries a list of these. A listing is
// the smallest unit a buyer interacts with — vinyl record, cassette, synth,
// merch piece, etc. Edited individually inside the partner's dashboard
// section (mini compose flow per listing). Status flips manually as items
// move through the sale pipeline.

export type MarketplaceListingCategory =
  | 'vinyl'
  | 'cassette'
  | 'cd'
  | 'synth'
  | 'drum-machine'
  | 'turntable'
  | 'mixer'
  | 'outboard'
  | 'merch'
  | 'other'

export type MarketplaceListingCondition =
  | 'NM'    // Near Mint
  | 'VG+'
  | 'VG'
  | 'G+'
  | 'G'
  | 'F'     // Fair
  | 'NEW'   // unopened / sealed

export type MarketplaceListingStatus = 'available' | 'reserved' | 'sold'

export type MarketplaceShippingMode = 'shipping' | 'local' | 'both'

export interface MarketplaceListing {
  id: string
  title: string
  category: MarketplaceListingCategory
  subcategory?: string                // member of SUBCATEGORIES_BY_CATEGORY[category]
  price: number                       // numeric amount; currency lives on the partner card
  condition: MarketplaceListingCondition
  // Multi-image — first index is the portada (lead image used by card grid +
  // overlay hero). Empty array means no image yet (renders the category
  // placeholder). Each entry is a data URL (drag-drop) or a public URL.
  images: string[]
  status: MarketplaceListingStatus
  description?: string                // optional longer text shown when expanded
  tags?: string[]                     // free-form chip input (e.g. "limited", "white-label")
  shippingMode?: MarketplaceShippingMode  // default left undefined = unspecified
  embeds?: MixEmbed[]                 // optional streaming/preview embeds (SC/YT/Spotify/Bandcamp/Mixcloud)
  publishedAt: string                 // ISO — drives "RECIENTES" ordering
}

// Per-category subcategory catalog — drives the dependent <select> in the
// composer. `other` intentionally has no subcategories (the field hides).
// First-pass list lifted from the [[Marketplace]] § "Planned refinement"
// design doc; expand as partners ask for new shapes.
export const SUBCATEGORIES_BY_CATEGORY: Record<MarketplaceListingCategory, string[]> = {
  vinyl: ['7"', '10"', '12"', 'LP', 'EP', 'Single', 'Compilation', 'Box Set', 'Picture Disc', 'Coloured'],
  cassette: ['Album', 'EP', 'Mixtape', 'Bootleg'],
  cd: ['Album', 'EP', 'Single', 'Compilation', 'Box Set'],
  synth: ['Analog', 'Digital', 'Modular', 'Module', 'Software'],
  'drum-machine': ['Analog', 'Digital', 'Sampler', 'Hybrid'],
  turntable: ['Direct Drive', 'Belt Drive', 'Cartridge', 'Slipmat'],
  mixer: ['2-channel', '4-channel', 'Rotary', 'Battle', 'Club'],
  outboard: ['Effects', 'Compressor', 'EQ', 'Preamp', 'Other'],
  merch: ['Camiseta', 'Sudadera', 'Gorra', 'Tote', 'Poster', 'Otro'],
  other: [],
}

// 0 = glacial/ice, 10 = volcán/fire — stored as number, shown as gradient position
export type VibeScore = number

export type ContentSource = 'scraper:ra' | 'manual:editor' | 'manual:partner'

export interface ContentItem {
  id: string
  slug: string
  type: ContentType
  title: string
  subtitle?: string
  excerpt?: string
  // Vibe range — items express a SPAN, not a point. Single-point items set
  // vibeMin === vibeMax. DB constraint enforces vibeMin <= vibeMax.
  // See `project_vibe_range_arc` memory + 0007_items_vibe_range migration.
  vibeMin: VibeScore
  vibeMax: VibeScore
  genres: string[]        // genre ids
  tags: string[]          // tag ids
  imageUrl?: string
  publishedAt: string     // ISO — when published
  date?: string           // ISO — event start / article featured date
  endDate?: string        // ISO — event end
  expiresAt?: string      // ISO — when removed from home feed
  // Provenance — set by scraper / editor surfaces. Drives the //FUENTE attribution chip
  // and the home-vs-rail filter for scraped events. See Scraper Pipeline.
  source?: ContentSource
  externalId?: string     // upstream id (e.g. RA event id) — dedup key on re-scrape
  // Editor lever — when true, a scraped event leaves the EventosRail and enters
  // the main mosaic where it competes with editorial via HP. Default false on
  // scraper output; an editor flips it for individual events worth featuring.
  // No-op for non-scraped items (they're never in the rail).
  elevated?: boolean
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

  // Marketplace fields (type === 'partner' only). When `marketplaceEnabled`
  // is true, the partner shows up at `/marketplace` with their card +
  // listings. Admin sets the flag in [[AdminUsersEditor]]; the partner team
  // edits the rest of the fields from their dashboard section. See
  // [[Marketplace]] for the full design.
  marketplaceEnabled?: boolean
  marketplaceDescription?: string  // partner-authored intro copy
  marketplaceLocation?: string     // "CDMX, MX"
  marketplaceCurrency?: string     // "MXN"
  marketplaceListings?: MarketplaceListing[]

  // Optional poll attachment — see lib/polls.ts. Per-type variant resolution
  // (from-list / from-tracklist / attendance / freeform) means the choices
  // come from different sources depending on this item's `type`. Embed-on-
  // ContentItem keeps the data model joinless; one poll per item by design.
  poll?: PollAttachment

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
// Creation-tier hierarchy with a sibling pair:
//   user < curator < {guide, insider} < admin
// `guide` and `insider` sit at the same tier with equivalent publishing
// capabilities — they differ only in byline framing. Guide is staff editorial
// voice; insider is scene voice (DJs, promoters, venue folks). Both inherit
// curator (lists / polls / marketplace).
//
// Two orthogonal flags layered on top of role:
//   isMod  — pruning capability (delete comments / threads). Admins implicit.
//   isOG   — first-wave-registrant cosmetic badge. Admin-granted.
//
// `rank` is meaningful only when role === 'user'. Derived on read from the
// !/? reactions received on the user's comments (see lib/permissions.ts
// getUserRank / rankFromCounts). Reflects posting *texture*, not popularity:
//   normie (floor) → detonador (!-dominant)
//                  | enigma    (?-dominant)
//                  | espectro  (balanced + active)
// Not stored on the User type — consumers compute it via getUserRank or the
// useUserRank hook.

export type Role = 'user' | 'curator' | 'guide' | 'insider' | 'admin'

export type UserRank = 'normie' | 'detonador' | 'enigma' | 'espectro'

export interface User {
  id: string
  username: string        // login handle, unique
  displayName: string     // shown in UI
  role: Role
  isMod?: boolean         // pruning flag — admins get it implicitly via canModerate()
  isOG?: boolean          // first-wave registrant cosmetic badge
  // Marketplace-team membership. When `partnerId` is set, the user belongs
  // to that partner's team and gains access to the partner-only dashboard
  // section. `partnerAdmin: true` (only meaningful when `partnerId` is set)
  // grants in-team admin powers — adding/removing other team members of
  // the SAME partner. Site admins (`role === 'admin'`) override both.
  // See [[Marketplace]].
  partnerId?: string      // references a partner ContentItem.id (e.g. "pa-club-japan")
  partnerAdmin?: boolean  // in-team admin for own partner (kick/add team)
  joinedAt: string        // ISO
}

// ── Comments & reactions ────────────────────────────────────────────────────
//
// Reactions are an abstract two-glyph palette: ! and ?. By design we omit +/−
// because up/down-voting reduces a comment to "I like / I don't like" — the
// antithesis of editorial discussion. Both ! and ? are productive: ! signals
// excitement / controversy / signal-flare; ? signals doubt / questions /
// thinking-prompted. Each user picks at most one of the two per comment —
// they're mutually exclusive (see lib/comments.ts toggleReaction).
//
// The relative balance of !/? a user *receives* derives their UserRank.
// See lib/permissions.ts rankFromCounts.

export type ReactionKind =
  | 'provocative'  // [?]   questions, doubt, productive disturbance
  | 'signal'       // [!]   excitement, controversy, worth surfacing

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

// ── Polls (attachment on ContentItem) ──────────────────────────────────────
//
// A poll is never a standalone feed object — it's an optional attachment on
// any ContentItem (see ContentItem.poll above). The `kind` controls how the
// poll's choices are resolved:
//
//   from-list       — listicle parent; choices = the list's `track` blocks
//   from-tracklist  — mix parent; choices = the tracklist
//   attendance      — evento parent; choices = fixed VOY/TAL VEZ/NO PUEDO
//   freeform        — editor-authored choices (any text-content parent)
//
// For non-freeform kinds, `choices` on the stored attachment is empty —
// the live choices are derived at read time via lib/polls.ts
// resolvePollChoices(item). This keeps the parent (track list, tracklist,
// or fixed set) the source of truth so an editor edit upstream propagates.
//
// Voting state lives separately in lib/polls.ts session storage —
// `gradiente:polls`. Anonymous-until-vote: aggregated counts are hidden
// from the UI until the viewer has cast their own vote (see
// [[PollCardCanvas]] / [[PollSection]]).

export type PollKind = 'from-list' | 'from-tracklist' | 'attendance' | 'freeform'

export interface PollChoice {
  id: string                  // stable within the poll; survives reorder
  label: string               // display text (e.g. "Siete Catorce — Volcán")
}

export interface PollAttachment {
  id: string                  // unique poll id (poll lifecycles separately from item)
  kind: PollKind
  prompt: string              // question text — editor authors with sensible per-kind defaults
  choices?: PollChoice[]      // freeform only — others resolve at read time from the parent
  multiChoice?: boolean       // default false; when true a user may pick multiple choices
  closesAt?: string           // ISO; absent = open indefinitely
  createdAt: string           // ISO
}

export interface PollVote {
  choiceIds: string[]         // length 1 unless multiChoice; replaces on revote
  votedAt: string             // ISO
}

// ── Foro (imageboard-style forum) ──────────────────────────────────────────
//
// Standalone subsystem — not a ContentItem, no vibe/HP/curation, never enters
// the main grid. Catalog ordering is bumpedAt desc with a hard cap of 30
// visible threads. No reactions, no likes — the only signal is reply count.
// OP requires an image; replies don't.

// Foro tombstone — set by canModerate users when soft-deleting a thread or
// reply. Mirrors CommentDeletion. The post's body is preserved in storage
// (so quote-links still resolve) but the UI replaces the body with a
// moderator stub showing the stated reason.
export interface ForoDeletion {
  moderatorId: string
  reason: string
  deletedAt: string  // ISO
}

export interface ForoThread {
  id: string
  authorId: string         // references User.id
  subject: string          // shown big in catalog tile + thread header
  body: string             // OP body
  imageUrl: string         // mandatory — data URL or /flyers/* path
  genres: string[]         // 1–5 genre ids — drives vibe-slider filtering
  createdAt: string        // ISO
  bumpedAt: string         // ISO — last reply, or createdAt when no replies
  deletion?: ForoDeletion  // tombstone — when set, hidden from catalog + body replaced with mod stub
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
  deletion?: ForoDeletion  // tombstone — body replaced with mod stub, position preserved
}
