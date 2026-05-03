# index.md

> The map of the wiki. Content-oriented, not chronological. See [[log]] for timeline.
>
> If a note isn't listed here, treat it as orphaned and re-file or delete.

## Root

- [[_schema]] — vault conventions, how to write notes
- [[log]] — append-only ingest / query / lint record
- [[Next Session]] — what to do when picking up work next time

## 10 — Architecture

- [[Stack]] — Next.js 14 + TS 5 + Tailwind 3 + Framer Motion 12
- [[Data Flow]] — mockData → filters → curation → pages → UI
- [[Folder Structure]] — how `/app`, `/components`, `/lib`, `/context` divide
- [[App Router Patterns]] — server-by-default, client islands, `@/` aliases
- [[Dual Feed Systems]] — why `ContentGrid` and `ContentFeed` both exist
- [[Overlay System]] — card click → full-screen overlay, URL sync, type dispatch

## 20 — Domain

- [[Vibe Spectrum]] — 0 glacial → 10 volcán, the core filter axis
- [[HP Curation System]] — decay-based prominence ranking
- [[Content Types]] — evento, mix, noticia, review, editorial, opinion, articulo, listicle, partner
- [[Partners Isolation]] — why partners never enter the main grid
- [[Editorial Flag]] — the one editor lever (boost spawn HP)
- [[Pinned Hero]] — single slot, portada logic

## 30 — Pages

- [[Home]] — `/` — pinned hero + curated mosaic + category rail + partners + calendar
- [[Agenda]] — `/agenda` — events only, date-forward
- [[Editorial]] — `/editorial` — editorials only
- [[Mixes]] — `/mixes` — mixes only
- [[Noticias]] — `/noticias` — news only
- [[Reviews]] — `/reviews` — reviews only
- [[Articulos]] — `/articulos` — longform features only
- [[Foro]] — `/foro` — imageboard-style discussion catalog (threads + flat replies)
- [[Marketplace Page]] — `/marketplace` — public marketplace catalog; `?partner=<slug>` opens a partner's overlay
- [[Dashboard]] — `/dashboard` — auth-gated insider surface for composing new content (visual prototype)
- [[Dashboard Drafts]] — `/dashboard/drafts` — table view of session items with edit / publish / delete actions
- [[About]] — `/about` — identity surface: what Gradiente is + partner ecosystem
- [[Manifesto]] — `/manifesto` — editorial declaration (placeholder copy until team writes)
- [[Equipo]] — `/equipo` — collaborator list with GH handles + per-person bio placeholders

## 40 — Components

- [[Navigation]] — EVA-themed header, MAGI indicators, data-strip ticker
- [[VibeSlider]] — dual-handle range over neon stripe band
- [[CalendarSidebar]] — slide-in month grid, date-based filter
- [[CategoryRail]] — sticky left rail with counts per type
- [[ContentGrid]] — HP-driven mosaic with directional layout animations
- [[EventosRail]] — auto-scrolling horizontal marquee of scraped events under the hero; isolates the RA firehose from the editorial mosaic
- [[ContentCard]] — sm/md/lg tiered card (image-forward); opens overlay on click
- [[HeroCard]] — split portada hero; opens overlay on click
- [[PartnersRail]] — chronological rail, never merges with grid
- [[OverlayShell]] — frame chrome + CRT boot animation for every overlay
- [[OverlayRouter]] — mount/exit state machine, picks type-specific overlay
- [[ReaderOverlay]] — terminal reader for editorial / review / opinion / noticia
- [[ArticuloOverlay]] — longform reader for articulo (hero-led, TOC rail, pull-quotes, footnotes, related reading); also exports `BodyBlocks` (shared with listicle)
- [[ListicleOverlay]] — ranked/structured list reader; consumes `BodyBlocks` + new `track` block variant
- [[MixOverlay]] — mix reader with source tabs, decorative waveform, CONTEXTO panel, structured tracklist
- [[EventoOverlay]] — flyer-as-hero + event info
- [[GenericOverlay]] — fallback for types without dedicated overlays (currently nothing hits it — kept as a safety net)
- [[Embed Primitive]] — shared platform detection + labels (consumed by MixOverlay and ListicleOverlay)
- [[FeedHeader]] — reactive home-feed status strip; swaps to `//SUBSISTEMA · FILTRADO · X` when category filter is active
- [[useAuth]] — visual-prototype auth context (sessionStorage-backed `admin/admin`)
- [[LoginOverlay]] — terminal-aesthetic login modal triggered from the header
- [[AuthBadge]] — header slot showing LOGIN ↔ DASHBOARD + LOGOUT
- [[LivePreview]] — dashboard right-pane preview that renders the draft through its real overlay
- [[Dashboard Forms]] — eight per-type compose forms + shared field primitives + workbench autosave + edit hydration
- [[PublishConfirmOverlay]] — globally-mounted confirmation modal for the [[Publish Confirmation Flow]]
- [[ShareButton]] — click-to-copy deep-link affordance in [[OverlayShell]] header
- [[SearchOverlay]] — `/`-invoked terminal command-bar; pure substring search across mocked + drafts
- [[GenreChipButton]] — clickable genre-chip wrapper; sets `genreFilter` + closes overlay + lands on home
- [[BrandPageShell]] — shared chrome + section helpers for the static identity routes (`/about`, `/manifesto`, `/equipo`)
- [[ContentFeed]] — alternative linear date-grouped feed (not wired to pages)
- [[EventCard]] — linear event card (used by ContentFeed)
- [[MixCard]] — linear mix card with fake waveform
- [[ArticleCard]] — linear article card for text content
- [[CommentsColumn]] — split-screen right rail inside overlays; chrome + scroll body + composer footer
- [[CommentList]] — threaded renderer with role badges, ASCII reactions, depth cap, tombstones, focus pulse
- [[CommentComposer]] — login-gated dual-variant composer (`root` / `reply`); Enter posts
- [[SavedCommentsSection]] — dashboard `Guardados/Comentarios` surface with two-level draggable folders→files
- [[PermisosSection]] — admin-only role / flag editor inside the dashboard; writes via [[userOverrides]]
- [[PromptOverlay]] — NGE-styled `confirm` / `input` modal; replaces `window.prompt` for moderation + delete flows
- [[PollCardCanvas]] — card-level poll affordance; chip when closed, replaces card image with vote/results canvas when open
- [[PollSection]] — overlay-level poll surface; permanent section inside the parent's content overlay
- [[PollFieldset]] — shared poll-authoring section dropped into every dashboard compose form
- [[PartnerApprovalsSection]] — admin-only marketplace approval table; toggles `marketplaceEnabled` per partner
- [[MiPartnerSection]] — partner-team-only dashboard surface (Equipo + Marketplace tabs)
- [[MarketplaceOverlay]] — per-partner full-screen overlay matching the reference screenshot
- [[MarketplaceListingDetail]] — sub-overlay (z-60) opened from MarketplaceOverlay; gallery + embeds + meta; URL `?partner=&listing=`
- [[MarketplaceCatalog]] · [[MarketplaceCard]] · [[MarketplaceListingCard]] · [[MarketplaceRail]] — public-side surfaces
- [[DraggableCanvas]] — generic free-form file canvas (sessionStorage-namespaced positions, click-vs-drag threshold)
- [[SaveItemButton]] — `★ GUARDAR / ★ GUARDADO` chip in OverlayShell header; login-gated
- [[SavedBadge]] — tiny orange `★` chip on cards when item is saved; renders null otherwise
- [[GuardadosSection]] — dashboard `Guardados/*` surfaces; DraggableCanvas grid filtered by content type
- [[ForoCatalog]] — `/foro` page body: vibe-filtered grid + URL-driven thread + compose overlays
- [[ThreadTile]] — image-forward tile for the foro catalog (reply count + genre chips)
- [[ThreadOverlay]] — modal showing one thread (OP + flat replies, image float, `>>id` quote-buttons, backlinks, inline `TÚ` marker)
- [[NewThreadOverlay]] — login-gated thread composer (image + 1–5 genres required)
- [[ReplyComposer]] — pinned-bottom reply form; `>>id` parsing + quote-back pre-fill
- [[PostHeader]] — role-colored identity chrome at the top of each foro post

## 50 — Modules

- [[types]] — `ContentItem`, `ContentType`, `VibeScore`, `Genre`, `Tag` (+ frontend-only `_draftState` / `_pendingConfirm`)
- [[mockData]] — seed dataset for all content (+ `getItemBySlug` lookup)
- [[curation]] — spawn HP, decay, freshness, prominence, layout tiers
- [[genres]] — the genre + tag catalogs and lookup helpers
- [[utils]] — vibe helpers, date helpers, format helpers, filters, `getPinnedHero`
- [[drafts]] — sessionStorage-backed editor items store (the [[Publish Confirmation Flow]] backbone)
- [[VibeContext]] — global state: vibeRange, selectedDate, calendarOpen, categoryFilter
- [[useOverlay]] — overlay context + hook, URL sync via history.replaceState
- [[Dashboard Explorer]] — file-explorer shell wrapping every dashboard surface (sidebar + window + details), section-routed via `?section=`
- [[comments]] — sessionStorage-backed comment store (`added` / `reactionOverrides` / `savedIds`) + hooks
- [[saves]] — sessionStorage-backed save-from-feed store; resolves saved ids across MOCK_ITEMS + drafts
- [[mockUsers]] — 8-user roster covering all roles + role/category label maps + `getUserById` / `getUserByUsername`
- [[mockComments]] — 25-comment seed (depth-5 thread, controversy hot-spot, tombstone, edited marker) + tree helpers
- [[permissions]] — pure-function role/permission helpers (`hasRole`, `canEditComment`, `canModerateComment`, etc.)
- [[userOverrides]] — sessionStorage patch layer over MOCK_USERS; backs the [[PermisosSection]] admin surface
- [[polls]] — vote store + per-type choice resolver for poll attachments on `ContentItem`
- [[partnerOverrides]] — sessionStorage patch layer over partner ContentItems; backs the marketplace approval + edit surfaces
- [[foro]] — sessionStorage-backed foro store (threads + replies + bumpOverrides) + listener-pattern hooks
- [[mockForo]] — 8 seed threads + 16 seed replies (depth-of-conversation hot-spots, multi-quote, role plurality)

## 60 — Design

- [[NGE Aesthetic]] — Neon Genesis Evangelion as design language
- [[Typography]] — Syne display / Space Grotesk body / Space Mono label
- [[Color System]] — base black, NGE orange glow, vibe gradient, category colors
- [[Vibe Gradient]] — cold→hot color mapping, the dominant visual motif
- [[Utility Classes]] — `sys-label`, `nge-divider`, `nge-bracket`, `hazard-stripe`, `eva-*`
- [[Voice and Copy]] — Spanish UI, system-terminal phrasing, conventions

## 70 — Roadmap

- [[Backend Plan]] — current consolidated plan: Supabase + Vercel + R2 + GH Actions cron, magic-link signup + username/password login, invite-code beta gate, image auto-compression, foro 30-day retention, MWF scraper, SYSTEM UPDATE countdown
- [[Scraper Pipeline]] — RA → review queue → live feed (core ingestion path)
- [[Admin Dashboard]] — role-gated editor UI at `/admin` (real-backend version of [[Dashboard]])
- [[Supabase Migration]] — older, narrower draft superseded by [[Backend Plan]]
- [[CRT Shader Layer]] — full-viewport CRT post-processing; pushes NGE chrome to real terminal feel
- [[CRT Scanline Sweep]] — small targeted variant: sweep across the home grid on category-filter changes
- [[Three.js Islands]] — isolated 3D scenes (vibe sculpture, venue map, ASCII'd) per Canvas
- [[HTML-on-Canvas]] — earlier exploration of canvas rendering approaches and tradeoffs
- [[Gamification]] — HP-as-game mechanic, ideas and risks
- [[Open Questions]] — things nobody has decided yet

## 80 — External

- [[FASCINOMA]] — the festival, role in the site
- [[Club Japan]] — Monterrey 56, Roma Norte venue
- [[Partners Ecosystem]] — labels, venues, promoters, sponsored

## 90 — Decisions

- [[Guides Not Gatekeepers]] — the core editorial thesis; editorial content competes with scraped content in the main grid
- [[Why NGE Aesthetic]] — the founding design call
- [[Size and Position as Only Signals]] — no stars, likes, or counters
- [[No Algorithm]] — editorial curation over engagement metrics
- [[Roles and Ranks]] — three identity axes (creation tier + mod/og flags + auto-rank), !/? reaction palette
- [[Polls As Attachments]] — poll = optional ContentItem attachment, per-type variant resolution, card-as-canvas voting, anonymous-until-vote
- [[Marketplace]] — partner-only commerce, dedicated `/marketplace` route, `partnerId` field + `partnerAdmin` flag, four-step approval flow
- [[Why Next.js App Router]] — server-first, file routing
- [[Contained Single Surface]] — card click → overlay, never a route change
- [[Reader Terminal Layout]] — long-form overlays are reading subsystems, flyer demotes to archival
- [[Publish Confirmation Flow]] — three-state model (draft / pending / published) with mandatory confirmation gate
