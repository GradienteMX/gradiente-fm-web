# log.md

> Append-only. Newest at top. Every ingest / query / lint pass gets a line.
>
> Format: `YYYY-MM-DD · OP · short description · [[links]]`
>
> Operations: `INGEST` (source → wiki), `QUERY` (wiki → answer), `LINT` (vault health).

---

## 2026-04-23 · INGEST · Articulo content type + longform overlay shipped

Added `articulo` as the eighth content type — the longform/deep-dive tier that sits alongside `editorial` / `review` / `opinion` / `noticia` in the editorial family but gets its own reader.

**Why a new type:** `editorial` carries a curatorial/positional connotation (editor-flagged opinions, scene-shaping takes). `articulo` is reportage + form — substack-style deep-dives with interviews, pull-quotes, footnotes, section headers. Different register, different reading shape, deserves a distinct surface.

**New:**
- `articulo` added to `ContentType`, `categoryColor` (`#FDE68A` warm off-white), `TYPE_LABEL` (`ARTÍCULO`), curation half-life maps, peak initializer, score multiplier (1.3, matches review).
- `ArticleBlock` discriminated union + `Footnote` type in [`lib/types.ts`](../lib/types.ts). Structured block kinds: `lede`, `p`, `h2`, `h3`, `quote`, `blockquote`, `image`, `divider`, `qa`, `list`.
- `/articulos` route ([[Articulos]]) and `//ARTÍCULO` row in [[CategoryRail]] + [[Navigation]].
- [[ArticuloOverlay]] — longform reader distinct from [[ReaderOverlay]]: hero image is primary (not archival), sticky TOC rail with active-section tracking, drop-cap lede, vibe-colored pull-quotes, Q&A speaker labels, inline `[^id]` footnote refs → numbered endnotes, FIN hazard-stripe marker, curated `SIGUIENTES·LECTURAS` that swap in-overlay via [[OverlayRouter]].
- Three seeded articulos in [[mockData]] demonstrating the block variety.

**Deliberately NOT in scope:**
- `articulo` excluded from `getPinnedHero` allowlist — competes in the feed but doesn't auto-promote to portada. Can be revisited later.
- No engagement metrics (per [[Size and Position as Only Signals]] + [[No Algorithm]]) — "Ready for more?" translates to curated related-reading, not subscribe/share CTAs.

**Design reference:** [firstfloor.substack.com](https://firstfloor.substack.com), translated through Gradiente's terminal idiom (monospace meta, `//` prefixes, block-bar progress indicators).

## 2026-04-23 · INGEST · Card → overlay system shipped

Built and documented the full card-click-to-overlay reading surface. PR open at [feat/card-overlay](https://github.com/datavismo-cmyk/espectro-fm-web/compare/main...feat/card-overlay?expand=1).

**New UX primitive:** click any card (including the pinned hero) → full-screen overlay with CRT boot-in animation + dim/blur backdrop. URL updates via `?item=<slug>` for deep-linking, but no route change. See [[Overlay System]].

**New components:**
- [[OverlayShell]] — frame chrome, close affordances, CRT boot animation
- [[OverlayRouter]] — mount/exit state machine, type dispatch
- [[ReaderOverlay]] — terminal reader for `editorial` / `review` / `opinion` / `noticia` (8/4 split, article primary, flyer demoted to archival rail, F-key flyer lightbox, sticky scroll-progress footer)
- [[EventoOverlay]] — flyer-as-hero for `evento` (date block, line-up, tickets CTA)
- [[GenericOverlay]] — fallback for `mix` until a dedicated overlay ships

**New module:**
- [[useOverlay]] — context + hook, URL sync via `history.replaceState` (not `router.replace` — that triggered RSC refetches that remounted the overlay mid-animation)

**Two new decisions enshrined:**
- [[Contained Single Surface]] — the page is one continuous surface; card click → overlay, never a route. External URLs become explicit user-chosen escape hatches, not the default.
- [[Reader Terminal Layout]] — long-form overlays are reading subsystems, not enlarged cards. Flyer demotes to archival evidence. Per-type overlays instead of a unified shell with `switch(type)`.

**Updates to existing notes:**
- [[ContentCard]] — now clickable; opens overlay via [[useOverlay]]
- [[HeroCard]] — now clickable (whole section, including `// EN PORTADA` header bar); became a client component, `getPinnedHero` moved to [utils.ts](../../lib/utils.ts)
- [[Open Questions]] — card-click-to-detail resolved; per-type-overlay resolved; Supabase migration explicitly deprioritized (visual MVP phase)

**Deferred (noted in [[Open Questions]]):**
- MixOverlay (mix still uses [[GenericOverlay]])
- Mobile swipe-down-to-close
- Text-size / copy-link / minimap affordances mentioned in [[Reader Terminal Layout]]
- Full `body` field on `ContentItem` (we render `bodyPreview` for now)

**Tech note:** Framer Motion was attempted first for the overlay animations; animations would not fire reliably and the root cause was never identified. Switched to pure CSS keyframes in [globals.css](../../app/globals.css) — simpler and sufficient for the current motion vocabulary.

---

## 2026-04-22 · INGEST · "Do now" fixes landed

Shipped the short-effort fixes from [[Open Questions]]:

- **`CLAUDE.md` and `README.md` rewritten** as real markdown (from the Python-wrapper corrupted state). Both now reflect Gradiente branding with links into the wiki.
- **`/opinion` page created** — `app/opinion/page.tsx`, follows the same shape as [[Editorial]]. [[CategoryRail]] link now resolves.
- **[[Agenda]] tagline fixed** — `HOY → PASADO` → `FUTURO → PASADO` to match the actual DESC-by-date sort.
- **[[Editorial]] tagline simplified** — `TEXTOS & OPINIÓN` → `TEXTOS` (opinion has its own route now).
- **[[ArticleCard]] TYPE_LABEL fixed** — added missing `opinion` and `partner` entries. (Was type-failing the build as soon as strict checking ran.)
- **Next.js 14.2.21 → 14.2.35** — minor bump, build verified. Remaining CVEs require a Next 16 major upgrade; deferred.
- **ESLint rule `react/jsx-no-comment-textnodes` disabled** project-wide — `//` tokens in JSX are a deliberate NGE branding element throughout (`//EVENTO`, `//EN PORTADA`, etc.), not accidental JS comments.

**New roadmap notes created:**
- [[CRT Shader Layer]] — full-viewport CRT post-processing (blend-overlay mode first, render-to-texture mode as V2)
- [[Three.js Islands]] — isolated 3D scenes per `<Canvas>`, with `<AsciiRenderer>` from drei as the signature trick

**Not touched (explicitly deferred):**
- [[Dual Feed Systems]] — orphan delete/toggle decision still outstanding
- Next.js 16 major upgrade — too much scope for a "do now" slot; save for deployment prep
- Espectro → Gradiente content migration — coordinate with scraper cutover
- Card-click → dedicated route implementation — awaiting direction confirmation

---

## 2026-04-22 · INGEST · Editorial philosophy + data pipeline context

Context from conversation with the user:

- **Brand confirmed:** Gradiente is the new name; Espectro is the old. Content slugs + mix series titles still say Espectro. Full migration pending — coordinate with the scraper cutover so we don't rename twice.
- **Data pipeline revealed:** a Resident Advisor webscraper already exists and produced the current [[mockData]] via Excel. Productionization is the critical path — see new [[Scraper Pipeline]] note.
- **Editor dashboard is a planned feature** — see new [[Admin Dashboard]] note.
- **Editorial philosophy corrected:** I misread [[Editorial Flag]] as a quarantine. It's a boost. Editorial content lives IN the main grid alongside scraped items, competing on HP. Fixed in [[Editorial Flag]] and enshrined in new decision note [[Guides Not Gatekeepers]].
- **HP V1 vision surfaced:** HP is designed to eventually accept aggregate user interaction signals (not personalization). Currently decay-only. Added to [[Open Questions]] and [[Guides Not Gatekeepers]].
- **Card expansion discussed:** four options considered (modal, in-place expansion, inspection panel, dedicated route). Recommendation — dedicated `/[type]/[slug]` route with NGE reader chrome. See [[Open Questions]].

**New notes created:**
- [[Guides Not Gatekeepers]] (Decisions)
- [[Scraper Pipeline]] (Roadmap)
- [[Admin Dashboard]] (Roadmap)

**Notes revised:**
- [[Editorial Flag]] — fixed the quarantine misreading
- [[index]] — added new notes
- [[Open Questions]] — updated with V1 interaction loop, card expansion recommendation, body field question

---

## 2026-04-22 · INGEST · Vault bootstrap

Initial analysis of `espectro-fm-web` codebase into the wiki.

**Sources read:**
- `app/layout.tsx`, all `app/*/page.tsx` (home + 5 category pages)
- All 12 `components/**/*.tsx`
- All 5 `lib/*.ts` + `context/VibeContext.tsx`
- `tailwind.config.ts`, `next.config.mjs`, `tsconfig.json`, `app/globals.css`
- `package.json`, `.gitignore`
- Partial read of `lib/mockData.ts` (first 200 lines + file size)

**Pages created:** scaffold + ~30 notes across all 9 categories. See [[index]] for full map.

**Key findings:**
- Brand is **GRADIENTE FM** (layout metadata), not "Espectro FM" despite repo name. See [[NGE Aesthetic]].
- `CLAUDE.md` and `README.md` at repo root are **corrupted** — saved as a Python wrapper script instead of the markdown it was meant to produce. Flag for cleanup. See [[Open Questions]].
- Next.js 14.2.21 has an active security advisory. Patched version available. See [[Open Questions]].
- Two card systems coexist: `ContentCard` (mosaic) is wired; `EventCard`/`MixCard`/`ArticleCard` + `ContentFeed` are not imported anywhere. See [[Dual Feed Systems]].
- `curation.ts` references `EspectroObsidian/Espectro/02 - Features/Curation Model.md` — a prior local vault gitignored. Doesn't exist in this checkout; may live only on the lead's machine.
- Pre-existing `.gitignore` entry `EspectroObsidian/` confirms the prior vault attempt.

**Wiki setup choices:**
- Vault relocated from `Gradiente/Gradiente/` to `espectro-fm-web/wiki/` so it ships with the repo (option 1 of the sharing discussion).
- `.gitignore` extended to exclude per-user Obsidian workspace files (`workspace.json`, `workspace-mobile.json`, `workspaces.json`, `cache`, `.trash/`) while committing shared config.

**Next passes:**
- Full ingest of `lib/mockData.ts` to populate [[Content Types]] with real examples.
- Ask the team about `EspectroObsidian/Espectro/02 - Features/Curation Model.md` — reconcile with [[HP Curation System]].
- Decide fate of [[ContentFeed]] and linear card components (delete or adopt).
