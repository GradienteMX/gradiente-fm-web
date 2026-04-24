export type ContentType =
  | 'evento'
  | 'mix'
  | 'noticia'
  | 'review'
  | 'editorial'
  | 'opinion'
  | 'articulo'
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

export interface Footnote {
  id: string
  text: string
}

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
  mixUrl?: string
  duration?: string       // "1:23:45"
  tracklist?: string[]
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
