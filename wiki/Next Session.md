# Next Session — start here

> Brief for picking up where the previous session ended.
> Last updated: **2026-05-02** (scraper Phase 1 + [[EventosRail]] Phase 2 shipped 05-01; 05-02 added Windows-PC drag/subpixel scroll fixes to the rail and a chronological sort + past-event archive treatment to [[Agenda]]. See [[log]] for the four entries.)

## How to start this session

1. Read [[index]] (orientation) and [[log]] (latest entries — top three are the scraper arc, top two below that are the rail rAF rewrite + the marketplace v2 chunks).
2. Boot the preview (`.claude/launch.json` → `dev`, port 3003). Quick auth shortcuts (still valid):
   - `admin / admin` → `@datavismo-cmyk` (admin) — sees `Permisos` + `Marketplace · Aprobaciones`.
   - quick-switch `@loma_grave` — partnerAdmin of N.A.A.F.I. team.
   - quick-switch `@yagual` — regular team member of N.A.A.F.I.
3. Smoke the surfaces that changed most recently:
   - `/` — pinned hero → [[EventosRail]] (auto-scrolling, drag-to-scroll, pause-on-interaction) → mosaic. Rail header reads `// AGENDA · 119 EVENTOS · LIVE FEED · RA`.
   - `/agenda` — future events ascending (soonest at top), past events at the bottom dimmed (`saturate(0.4) brightness(0.85)`, `opacity 0.7`). Label reads `EVENTOS · N ENTRADAS · PRÓXIMOS · ARCHIVO ABAJO`.
   - `/marketplace?partner=naafi&listing=mkl-naafi-01` — deep-link a sub-overlay; verify gallery thumbs swap, embed chips render, ESC peels one layer at a time.
   - `/dashboard?section=mi-partner` (as loma or yagual) — 3-zone composer (left) + 3-mode preview (right) + paginated table (bottom).

## What's left (carry-over follow-ups, ordered roughly by visible impact)

### Scraper / EventosRail / Agenda

#### S1. Editor-elevation surface for scraped events
Today, flipping `elevated: true` on a scraped event (so it leaves the rail and joins the main mosaic) is file-edit only — you write the property in `lib/scrapedEvents.ts`. A real UI lives behind [[Supabase Migration]] / [[Admin Dashboard]] (Phase 3). Ship-blocker for non-engineer editors.

#### S2. //FUENTE · RA chip in [[EventoOverlay]] AND on rail cards
Carryover from the morning of 05-01. Overlay shows a tag chip but no source attribution beyond it; rail cards have nothing. Small mirror on both surfaces would close the aggregator-framing loop.

#### S3. Date-tab filter on the rail
Option (b) from the original ship discussion — `TONIGHT / TOMORROW / THIS WEEKEND` chips above the rail. Skipped for first ship; revisit if 119 chronologically-ordered cards feels too undifferentiated.

#### S4. Mobile pass for the rail
Touch + reduced-motion fallback path needs testing on small viewports. Drag-to-scroll uses pointer events so should work on touch — but the cards are 180px wide and gap 8px, so on a 360px viewport you get ~1.8 cards visible. Probably want a smaller card variant on mobile.

#### S5. Past-event archive treatment on home (open design question)
On `/agenda` past events get `saturate(0.4) brightness(0.85)`, but the demotion only triggers in agenda mode. If an editor `elevated: true`'s a past event into the home mosaic (rare, but possible), it shows at full color. Is that right? Probably yes — home is HP-driven and the editor's intent is "boost this," but worth flagging.

### Marketplace v2 follow-ups (still unblocked, demoted by event-listing work)

#### A. Embeds editor in the composer
Composer doesn't yet expose an editor for `MarketplaceListing.embeds`. The existing `EmbedList` component from `Fields.tsx` (used by [[MixForm]] / [[ListicleForm]]) drops in directly: `<EmbedList embeds={listing.embeds ?? []} onChange={(embeds) => onPatch({ embeds })} />`. Slot it into [[MiPartnerSection]]'s `ListingComposer` between description and tags.

#### B. Quick-filter chips inside MarketplaceOverlay
Reference screenshot has `/ VINYL · / CASSETTE · /MERCH · …` chips above the listings grid that filter by category. Today the grid is unfiltered. Implementation: chip row reading `listing.category` distinct values, controlled state in `Body`, filter on `sortedListings`.

#### C. Inline embed players inside the listing detail
Today embeds are link-out chips (`SOUNDCLOUD ↗`). The audio subsystem already has SoundCloud working live (see `2026-04-26 · Audio reactive subsystem` entry in [[log]]). Plumbing that into [[MarketplaceListingDetail]] above the //FUENTES line would let buyers preview without leaving the overlay.

#### D. Image lightbox
Clicking the big main image in [[MarketplaceListingDetail]] currently does nothing. A click-to-zoom expansion (full viewport modal, similar to the foro thread image float) would round out the gallery UX.

#### E. Per-listing `sellerId`
Carry-over from v1 — the detail's //VENDEDOR section shows the partner's name uniformly. If different team members are selling different items, add `sellerId?: string` to `MarketplaceListing` + a team-member dropdown in the composer.

#### F. Real listing-draft pipeline
Composer's `GUARDAR BORRADOR` / `PUBLICAR ITEM` buttons are cosmetic today (both close + flash). Adding `_draft?: boolean` on `MarketplaceListing` + filter in the public catalog + a `BORRADOR` pill in the table gives partners true save-then-publish semantics.

### Smaller polish (any session)

- **Mobile pass** — desktop layouts are locked; mobile is largely untested. Now includes the [[EventosRail]] (180px cards, drag-to-scroll) and the new agenda archive section.
- **Reduced-motion respect** — pending-publish glitch, CRT scanline, chip pulses run regardless of `prefers-reduced-motion`. WCAG-relevant. The rail already short-circuits its rAF loop under reduced-motion; the rest of the app doesn't.
- **Tailwind `base` color rename** — patched locally in [[MixOverlay]]; root fix still pending. See [[Open Questions]].
- **Brand page copy** — replace `[REDACTAR]` markers in [[About]] / [[Manifesto]] / [[Equipo]] when the team writes finished prose.

## What's still under the hood

Everything described as "saved" or "published" lives in `sessionStorage` and dies when the tab closes. **No backend yet.** See [[Supabase Migration]] for the plan when it's time. Scraped events live as a static `lib/scrapedEvents.ts` array regenerated by `Webscraper/ra_to_gradiente.py`.

## Where we are

Front-end visual prototype. **No backend.** Everything described as "saved" or "published" lives in `sessionStorage`.

**Reader site** is feature-complete for the visual MVP, plus event-listing infrastructure:
- Home grid: pinned hero → [[EventosRail]] (auto-scroll + drag) → HP-driven mosaic, with vibe slider, calendar, in-page category filter, partners rail
- 6 dedicated overlays (mix, listicle, articulo, evento, reader-family, generic fallback)
- 7 type-specific routes (`/agenda` chronological-ascending with past archive, `/mixes`, `/noticias`, etc. all date-desc)
- 404 page with terminal glitch
- Click-to-copy share button in every overlay
- Per-type empty states

**Editor surfaces** are also feature-complete except for backend persistence:
- Auth overlay (`admin / admin`) → dashboard route
- 8 of 9 type forms (only `partner` excluded — rail-only)
- Live preview through real overlay components
- Two-state publish model (GUARDAR DRAFT + PUBLICAR)
- Pending-publish confirmation flow with glitching card preview
- Edit any saved item (draft OR published) → form pre-populated
- Drafts list page (`/dashboard/drafts`) for management
- Form validation feedback (required fields + missing-field summary)
- Image upload (drag-drop + file picker, data URL storage)

**User-side surfaces** (built on top of role-aware auth):
- Comments column inside every overlay (split-screen, threaded, role-colored badges, ASCII reactions, tombstones, focus-pulse from saved-comment deep-links)
- Saved-comments dashboard surface (two-level draggable folders→files)
- Save-from-feed flow (★ chip on every card + overlay header, dashboard `Guardados/*` slots show real DraggableCanvas grids per content type)
- Foro at `/foro` — imageboard-style discussion catalog (8 seed threads, 30-thread cap, bump-order, 1–5 genre tagging, vibe-slider filtering, image-required OPs, flat replies with `>>id` quote-links, backlinks, inline `TÚ` markers)

**Event-listing pipeline** (new since 05-01):
- 119 RA-scraped CDMX events ingested via `Webscraper/ra_to_gradiente.py` → `lib/scrapedEvents.ts` → mockData
- Hotlinked images from `images.ra.co` (no local rehost)
- RA `content` field → `ContentItem.excerpt` (multi-paragraph descriptions in [[EventoOverlay]])
- Source/dedup metadata on `ContentItem`: `source`, `externalId`, `elevated`
- Scraped events default to the rail; `elevated: true` pulls into the mosaic

## Roadmap state

| Chunk | Status |
|---|---|
| 1 — Quick wins (drafts loop, 404, share, related, save indicator, empty states) | ✓ done |
| 2 — Editor closure (drafts list, validation, image upload, opinion + articulo) | ✓ done |
| 3-A — Search overlay (`/` shortcut) | ✓ done |
| 3-B — Clickable genre chips (incl. AnimatePresence-blocks-unmount fix) | ✓ done |
| 3-C — Brand pages (`/about`, `/manifesto`, `/equipo`) | ✓ done |
| Audio context session | ✓ done — see `2026-04-26 · INGEST · Audio reactive subsystem` in [[log]] |
| Dashboard chrome redesign | ✓ done |
| Save-from-feed flow (unblocks `Guardados/`) | ✓ done |
| Foro (imageboard-style discussion) | ✓ done |
| Marketplace v2 (Chunks A + B + C) | ✓ done — A–F follow-ups still open |
| Scraper Pipeline Phase 1 (RA → app direct ingest) | ✓ done — 05-01 |
| EventosRail Phase 2 (rail demotion + auto/manual scroll + drag) | ✓ done — 05-01/05-02 |
| Agenda chronological sort + past-archive treatment | ✓ done — 05-02 |
| Mobile pass | next up |
| Multi-platform embed widgets (YT, Mixcloud, Spotify) | next up |
| Editor-elevation UI for scraped events | deferred to Phase 3 / Supabase |
| Backend / Supabase migration | deferred |

## Suggested first action — pick from these

The remaining unblocked items are independent — pick whichever resonates.

### A. Mobile pass (highest visible impact)

Desktop is locked; mobile is untested and now includes the [[EventosRail]] and the agenda archive treatment. Verify on small viewports: home grid mosaic, rail (drag works on touch but cards may be too wide), vibe slider, calendar sidebar, all six overlays, [[SearchOverlay]] command bar, dashboard forms, agenda archive fade. Expect breakages in multi-column layouts ([[ArticuloOverlay]] sticky TOC, dashboard live preview side-pane) and the data-strip ticker.

**Where to start:** open the home page in a phone viewport, screenshot what breaks, then triage by severity. Probably need a `useMediaQuery` hook or container queries somewhere.

### B. Multi-platform embed widgets

The audio subsystem ships with a generic `EmbedWidget` interface in `components/audio/types.ts`. SoundCloud is implemented (`useSoundCloudWidget`); the same shape is waiting for:

- **YouTube** — IFrame Player API (`https://www.youtube.com/iframe_api`). Common path; needed for any mix that's only on YT.
- **Mixcloud** — Mixcloud.js Widget API. Important since Mixcloud is heavily used for DJ sets.
- **Spotify** — Embed iframe API. Lower priority (Spotify rarely hosts DJ-style mixes).
- **Bandcamp** — no JS widget API. Will need a fallback "open in source" path for Bandcamp-only mixes (transport disabled for that platform).

**Where to start:** copy `useSoundCloudWidget.ts` to `useYouTubeWidget.ts`, swap the API binding (YT requires `enablejsapi=1` on the iframe URL and uses event polling instead of PLAY_PROGRESS), and add a `useEmbedWidget(item)` resolver that picks the right hook by platform. `AudioPlayerProvider` then dispatches via the resolver instead of hard-coding SC.

### C. //FUENTE · RA chip + rail polish (small, finishes the scraper arc)

Mirror a small `//FUENTE · RA` chip on rail cards and inside [[EventoOverlay]] for scraped events. Cleanest aggregator-framing finishing touch. ~30 min.

### Smaller polish items (any session)

- **Tailwind `base` color rename** — patched locally in [[MixOverlay]]; root fix still pending. See [[Open Questions]].
- **Reduced-motion respect** — pending-publish glitch + CRT scanline + chip-pulse all run regardless of `prefers-reduced-motion`.
- **Confirmation modal copy on edit** — modal still says "una vez publicado…" when re-publishing already-published items.
- **Brand page copy** — when the team writes finished prose, replace `[REDACTAR]` markers.

## Open design questions to flag

- **Past-event treatment on home.** If an editor `elevated: true`'s a past event, should it stay full-color on the home mosaic, or inherit the agenda-page desaturation? Currently the demotion only fires in `mode="agenda"`. Probably right (home is HP-driven, editor's intent is "boost this") but worth a deliberate call.
- **Save affordance shape.** Bookmark icon? Heart? Terminal-style chip? Has to read in the dim header palette but be discoverable. Same gesture probably belongs in card thumbnails AND inside the overlay header — verify it makes sense in both contexts before committing.
- **Attendance verification.** Long-horizon — the Guardados/perks roadmap depends on a verifiable "I was there" gesture. User flagged this as the load-bearing problem, not the perk catalog. Possibilities: door-staff QR scan, NFC tap at venue, partner-issued one-time codes. Decision deferred until partnership conversations actually start.
- **Confirmation modal copy on edit.** When editing an already-published item and re-publishing, the modal still says "una vez publicado…" as if it's first-publish. Could refine to "una vez actualizado, los cambios serán visibles…" when `isPublished` is true.
- **Drafts list delete confirmation.** Currently single-click delete. Fine for prototype; for production add a confirm dialog or soft-delete with undo.
- **Editing a published item momentarily flips state to draft** during the pending re-confirmation. Acceptable for prototype; worth deciding later whether to preserve "published" status during pending re-confirmations.

## Open questions inherited

- See [[Open Questions]] for the full list.
- The **Tailwind `base` color collision** spawned task is still pending — patched locally in [[MixOverlay]] but the root rename hasn't happened.
- **Reduced motion respect** — pending-publish glitch animations + CRT scanline + exit-fade all run regardless of `prefers-reduced-motion`.

## Don't forget

- **Append to [[log]] as you go.** Last big catch-up was painful because logging drifted. Write entries as work closes, not after.
- **Update [[Open Questions]]** when an item closes.
- **Update [[index]]** when a new note is added.
- Don't introduce engagement metrics, don't sort home feed by `publishedAt`, don't put partners in the main grid (see [[CLAUDE.md]]).
- For the rail: `scrollLeft` rounds to integers — any rAF loop that nudges sub-pixel deltas needs a fractional accumulator (see `EventosRail.tsx:142`). 120Hz+ Windows monitors are the canary.
