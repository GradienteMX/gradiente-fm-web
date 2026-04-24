---
type: roadmap
status: current
tags: [roadmap, questions, todos]
updated: 2026-04-23
---

# Open Questions

> Things nobody has decided yet. Living list — update as items resolve.

## Known bugs / inconsistencies

- ~~**Corrupted `CLAUDE.md` and `README.md`** at repo root~~ — **fixed 2026-04-22.** Rewrote both as proper markdown reflecting current Gradiente branding.
- ~~**`/opinion` route is missing**~~ — **fixed 2026-04-22.** Created `app/opinion/page.tsx`.
- ~~**Agenda tagline "HOY → PASADO"**~~ — **fixed 2026-04-22.** Changed to `FUTURO → PASADO` to match actual DESC-by-date sort.
- ~~**[[Editorial]] tagline says "TEXTOS & OPINIÓN"**~~ — **fixed 2026-04-22.** Now `TEXTOS` only; `/opinion` exists as its own page.
- ~~**[[ArticleCard]] `TYPE_LABEL` map**~~ — **fixed 2026-04-22.** Added `opinion` and `partner` entries to satisfy `Record<ContentType, string>`.
- ~~**Every `cursor-pointer` card doesn't link anywhere**~~ — **resolved 2026-04-23.** Cards no longer "link" — they open overlays via [[Overlay System]]. Dedicated routes were explicitly rejected in [[Contained Single Surface]].
- **Next.js 14.x security advisories** — partial fix 2026-04-22: bumped `14.2.21 → 14.2.35`. **Remaining CVEs cannot be patched in the 14.x line** (Next 14 is out of security support per npm audit). Full resolution requires a major upgrade to Next 16 with React 19 and App Router API changes — deferred until deployment prep. The site is not currently deployed, so the DoS/image-optimizer vulnerabilities are not live-exploitable.

## Architectural / design decisions pending

- **[[Dual Feed Systems]]** — delete the orphan [[ContentFeed]] + row cards, or resurrect as a toggleable list view?
- **[[Vibe Gradient]] reconciliation** — three color scales overlap. Consolidate into one module?
- **[[mockData]]** — when do we commit to [[Supabase Migration]]? Deprioritized for now — project is in [[Visual MVP Phase]] (see memory); mockData is fine until look/feel is locked.
- ~~**Card click → detail view**~~ — **decided 2026-04-23.** Overlay, not route. See [[Contained Single Surface]] and [[Overlay System]].
- ~~**Per-type vs unified overlay**~~ — **decided 2026-04-23.** Per-type for expressive latitude. See [[Reader Terminal Layout]].
- **`body` field on `ContentItem`** — to support full articles in admin / full reader experience. Plus `externalUrl` for Substack-hosted pieces. Currently [[ReaderOverlay]] renders `bodyPreview` only. See [[Admin Dashboard]].
- **MixOverlay** — `mix` still falls through to [[GenericOverlay]]. Needs a dedicated overlay with embedded player + tracklist primary + DJ bio. See [[GenericOverlay]].
- **[[EspectroObsidian]]** — the `.gitignore` references a prior vault (`EspectroObsidian/`) and [[curation]] comments reference `EspectroObsidian/Espectro/02 - Features/Curation Model.md`. Does this spec exist on the lead's machine? Is there content worth migrating into this wiki?
- **CategoryRail counts** — counts reflect filtered home items, not DB totals. Is that intentional? See [[CategoryRail]].
- **No test runner** — worth adding? What would we even test first?

## Overlay polish (follow-ups from 2026-04-23 build)

- **Swipe-down to close on mobile** — skipped for v1 to avoid inner-scroll conflicts. Would need a dedicated drag handle at the top of the panel.
- **Reading affordances deferred from [[Reader Terminal Layout]]**: `T` for text size, `C` for copy link, minimap with scroll position + section headings.
- **Framer Motion fallback** — overlay animations moved to pure CSS after Framer Motion animations would not fire reliably in this setup. Root cause never identified. CSS is fine for current motion vocabulary; revisit if we need layout-shared-element transitions.
- **Overlay for `partner` type** — currently partners are not clickable (they live in [[PartnersRail]] only, not clickable-into). Is that the final stance, or should partner cards open an overlay with their promo info / external link?

## Product / editorial questions

- Is there a cadence commitment on [[Pinned Hero]]? Header says `SE ACTUALIZA SEMANALMENTE` — does the editor want to match that?
- Tracklists exist on mix items but aren't rendered. Where should they appear — on the card? On a mix detail page?
- Mix playback — in-page `<audio>` / SoundCloud embed, or keep "opens in new tab"?
- Partner rail — add mobile layout or leave as desktop-only?
- **V1 interaction → HP feedback loop** — see [[Guides Not Gatekeepers]]. How do aggregate clicks/plays/reads feed back into HP? What's the infrastructure? (No per-user tracking; aggregate item-level only.) This is how the democratic claim actually delivers.
- **Espectro → Gradiente content migration** — mix titles (`ESPECTRO MIX ###`), bylines (`Redacción Espectro`), slugs, partner field references. Coordinate with the scraper cutover.

## Gamification / canvas (user-requested exploration)

- See [[Gamification]] and [[HTML-on-Canvas]] for the current thinking. Top priorities requested by user, but no concrete commitment yet.

## Operational

- CI/CD? No GitHub Actions, no Vercel setup visible. Site is dev-only right now.
- Analytics? None installed. Adding even basic page-view tracking is a policy question (respecting visitors vs understanding readership).
- Accessibility audit — ARIA labels exist on some buttons but haven't been audited. WCAG compliance unknown.

## Links

- [[index]]
- [[log]]
