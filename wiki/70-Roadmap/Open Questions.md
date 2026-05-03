---
type: roadmap
status: current
tags: [roadmap, questions, todos]
updated: 2026-04-25
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
- **Tailwind `base` color collision with `text-base` font-size utility** — the config in [tailwind.config.ts](../../tailwind.config.ts) declares `colors.base: '#000000'`, which makes Tailwind generate `.text-base { color: #000000 }` in addition to the default font-size rule. Anywhere `text-base` or `md:text-base` is used alongside another color class (e.g. `text-secondary`), the black color can override at matching breakpoints and render text invisible on the black background. Hit once in [[MixOverlay]] (fixed locally with `md:text-[15px]`). Root fix is to rename the `base` color token — see spawned task. A spot-check of [[GenericOverlay]] at `text-base` usage is also warranted.
- **[[ContentGrid]] has no exit fade for filtered-out cards** — `<AnimatePresence>` was removed 2026-04-25 (Chunk 3-B) because it was keeping filtered-out cards mounted at full opacity, silently breaking the in-page category + genre filters. Cards now unmount immediately when the filter drops them. The mount/reflow animation still fires via `motion.div`'s `layout` prop. If a smooth exit fade is wanted later, the path forward is to find a Framer Motion 12 incantation for `popLayout` + the mosaic's `layoutId` that actually lets exits complete (forwardRef on `MosaicItem` was added but didn't fix it on its own).
- **Next.js 14.x security advisories** — partial fix 2026-04-22: bumped `14.2.21 → 14.2.35`. **Remaining CVEs cannot be patched in the 14.x line** (Next 14 is out of security support per npm audit). Full resolution requires a major upgrade to Next 16 with React 19 and App Router API changes — deferred until deployment prep. The site is not currently deployed, so the DoS/image-optimizer vulnerabilities are not live-exploitable.

## Architectural / design decisions pending

- **[[Dual Feed Systems]]** — delete the orphan [[ContentFeed]] + row cards, or resurrect as a toggleable list view?
- **[[Vibe Gradient]] reconciliation** — three color scales overlap. Consolidate into one module?
- ~~**[[mockData]]** — when do we commit to [[Supabase Migration]]?~~ — **decided 2026-05-02.** Visual MVP is feature-complete enough; backend is now the next major arc. Plan in [[Backend Plan]] (supersedes the older [[Supabase Migration]] draft). Mock data migrates with a `seed=true` flag that RLS hides from public reads — admins keep visibility for testing, real content can swap in incrementally, batch-delete when ready.
- ~~**Card click → detail view**~~ — **decided 2026-04-23.** Overlay, not route. See [[Contained Single Surface]] and [[Overlay System]].
- ~~**Per-type vs unified overlay**~~ — **decided 2026-04-23.** Per-type for expressive latitude. See [[Reader Terminal Layout]].
- **`body` field on `ContentItem`** — to support full articles in admin / full reader experience. Plus `externalUrl` for Substack-hosted pieces. Currently [[ReaderOverlay]] renders `bodyPreview` only. See [[Admin Dashboard]].
- ~~**MixOverlay**~~ — **shipped 2026-04-24.** Dedicated terminal-aesthetic overlay with source-tabs (SC/YT/SP/BC/Mixcloud), decorative seeded waveform, CONTEXTO metadata panel, structured tracklist table, keyboard shortcuts (`O` opens active source). Real audio playback deferred to audio-context session.
- ~~**Dashboard draft injection into the home feed**~~ — **shipped 2026-04-25.** New [[drafts]] module + [[HomeFeedWithDrafts]] wrapper merges session items into the feed. Then tightened: only `_draftState === 'published'` items + the one matching `?pending=<id>` surface — pure drafts stay in [[Dashboard Drafts]].
- ~~**Articulo dashboard form**~~ — **shipped 2026-04-25.** Self-contained ArticuloForm with full block editor (all 10 kinds) + footnotes editor. Closes dashboard type coverage at 8 of 9 (only `partner` excluded).
- **CRT scanline sweep on filter change** — user-suggested polish. See [[CRT Scanline Sweep]]. ~30 min of work, mostly design choices (color, direction, scope).
- **Audio context / global playback** — decided 2026-04-24 that this needs its own focused session. Covers: persistent audio across overlays and route changes, reactive-from-audio HUD (real waveform driven by Web Audio API), mix transport controls wired to actual playback, inline `track` block embeds in listicles (currently link-outs), click-to-embed facade pattern. See memory: project_audio_vision. Everything iframe-based built before this session should be treated as interim — iframes sandbox the audio stream and cannot feed the reactive HUD, so they get replaced when this session happens.
- **[[EspectroObsidian]]** — the `.gitignore` references a prior vault (`EspectroObsidian/`) and [[curation]] comments reference `EspectroObsidian/Espectro/02 - Features/Curation Model.md`. Does this spec exist on the lead's machine? Is there content worth migrating into this wiki?
- **CategoryRail counts** — counts reflect filtered home items, not DB totals. Is that intentional? See [[CategoryRail]].
- **No test runner** — worth adding? What would we even test first?

## Overlay polish (follow-ups from 2026-04-23 build)

- **Swipe-down to close on mobile** — skipped for v1 to avoid inner-scroll conflicts. Would need a dedicated drag handle at the top of the panel.
- **Reading affordances deferred from [[Reader Terminal Layout]]**: `T` for text size, ~~`C` for copy link~~ (shipped 2026-04-25 as [[ShareButton]] in [[OverlayShell]] header), minimap with scroll position + section headings.
- **Framer Motion fallback** — overlay animations moved to pure CSS after Framer Motion animations would not fire reliably in this setup. Root cause never identified. CSS is fine for current motion vocabulary; revisit if we need layout-shared-element transitions.
- **Overlay for `partner` type** — currently partners are not clickable (they live in [[PartnersRail]] only, not clickable-into). Is that the final stance, or should partner cards open an overlay with their promo info / external link?

## Dashboard polish (follow-ups from 2026-04-25 chunks 1+2)

- **Dashboard chrome redesign** — user noted the `DRAFTS · N` link in the [[Dashboard]] status strip is too subtle to find easily. Whole dashboard nav could use a focused redesign — sidebar instead of inline links, more prominent state. Worth pairing with the eventual mobile dashboard pass.
- **Drafts list delete confirmation** — currently single-click delete in [[Dashboard Drafts]]. Fine for prototype; production should add a confirm dialog or soft-delete with undo.
- **Editing a published item momentarily flips state to draft** during the pending re-confirmation. If the editor cancels mid-flow, the previously-published item shows as draft. Acceptable for prototype; worth deciding for production whether to preserve the published flag during pending re-confirmations.
- **Confirmation modal copy on edit** — [[PublishConfirmOverlay]] uses "una vez publicado…" copy regardless of whether it's first-publish or an update. Could refine to "una vez actualizado, los cambios serán visibles…" when `isPublished` is true.
- **Reduced motion respect** — pending-publish glitch animations + scanline + cover flicker + chip flicker all run regardless of `prefers-reduced-motion`. WCAG-relevant; worth a focused a11y pass.

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
