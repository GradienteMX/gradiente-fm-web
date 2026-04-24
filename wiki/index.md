# index.md

> The map of the wiki. Content-oriented, not chronological. See [[log]] for timeline.
>
> If a note isn't listed here, treat it as orphaned and re-file or delete.

## Root

- [[_schema]] — vault conventions, how to write notes
- [[log]] — append-only ingest / query / lint record

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
- [[Content Types]] — evento, mix, noticia, review, editorial, opinion, partner
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

## 40 — Components

- [[Navigation]] — EVA-themed header, MAGI indicators, data-strip ticker
- [[VibeSlider]] — dual-handle range over neon stripe band
- [[CalendarSidebar]] — slide-in month grid, date-based filter
- [[CategoryRail]] — sticky left rail with counts per type
- [[ContentGrid]] — HP-driven mosaic with directional layout animations
- [[ContentCard]] — sm/md/lg tiered card (image-forward); opens overlay on click
- [[HeroCard]] — split portada hero; opens overlay on click
- [[PartnersRail]] — chronological rail, never merges with grid
- [[OverlayShell]] — frame chrome + CRT boot animation for every overlay
- [[OverlayRouter]] — mount/exit state machine, picks type-specific overlay
- [[ReaderOverlay]] — terminal reader for editorial / review / opinion / noticia
- [[EventoOverlay]] — flyer-as-hero + event info
- [[GenericOverlay]] — fallback for mix (until dedicated)
- [[ContentFeed]] — alternative linear date-grouped feed (not wired to pages)
- [[EventCard]] — linear event card (used by ContentFeed)
- [[MixCard]] — linear mix card with fake waveform
- [[ArticleCard]] — linear article card for text content

## 50 — Modules

- [[types]] — `ContentItem`, `ContentType`, `VibeScore`, `Genre`, `Tag`
- [[mockData]] — seed dataset for all content (+ `getItemBySlug` lookup)
- [[curation]] — spawn HP, decay, freshness, prominence, layout tiers
- [[genres]] — the genre + tag catalogs and lookup helpers
- [[utils]] — vibe helpers, date helpers, format helpers, filters, `getPinnedHero`
- [[VibeContext]] — global state: vibeRange, selectedDate, calendarOpen
- [[useOverlay]] — overlay context + hook, URL sync via history.replaceState

## 60 — Design

- [[NGE Aesthetic]] — Neon Genesis Evangelion as design language
- [[Typography]] — Syne display / Space Grotesk body / Space Mono label
- [[Color System]] — base black, NGE orange glow, vibe gradient, category colors
- [[Vibe Gradient]] — cold→hot color mapping, the dominant visual motif
- [[Utility Classes]] — `sys-label`, `nge-divider`, `nge-bracket`, `hazard-stripe`, `eva-*`
- [[Voice and Copy]] — Spanish UI, system-terminal phrasing, conventions

## 70 — Roadmap

- [[Scraper Pipeline]] — RA → review queue → live feed (core ingestion path)
- [[Admin Dashboard]] — role-gated editor UI at `/admin`
- [[Supabase Migration]] — swapping mockData for a real backend (enables scraper + admin)
- [[CRT Shader Layer]] — full-viewport CRT post-processing; pushes NGE chrome to real terminal feel
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
- [[Why Next.js App Router]] — server-first, file routing
- [[Contained Single Surface]] — card click → overlay, never a route change
- [[Reader Terminal Layout]] — long-form overlays are reading subsystems, flyer demotes to archival
