# log.md

> Append-only. Newest at top. Every ingest / query / lint pass gets a line.
>
> Format: `YYYY-MM-DD · OP · short description · [[links]]`
>
> Operations: `INGEST` (source → wiki), `QUERY` (wiki → answer), `LINT` (vault health).

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
