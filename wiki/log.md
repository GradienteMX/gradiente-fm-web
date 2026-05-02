# log.md

> Append-only. Newest at top. Every ingest / query / lint pass gets a line.
>
> Format: `YYYY-MM-DD · OP · short description · [[links]]`
>
> Operations: `INGEST` (source → wiki), `QUERY` (wiki → answer), `LINT` (vault health).

---

## 2026-05-02 · INGEST · Agenda — chronological sort + archived-past visual treatment

`/agenda` was displaying events latest-date-first (May 30 at top, May 2 at bottom) — opposite of what users expect from a calendar page. The page even labeled itself `FUTURO → PASADO` while doing the reverse. Iker flagged it: "the sooner the event will appear, the closer to the top."

### What changed

**New sort key for the agenda surface only.** Added `mode="agenda"` to [[ContentGrid]]; `/mixes`, `/noticias`, `/reviews`, etc. keep their existing date-desc behavior since "newest first" is the right metaphor for editorial content. Inside `mode="agenda"`:

1. **Future block first, soonest at top.** `parseISO(item.date) >= now` items sort ascending by `date`.
2. **Past block at the bottom, most-recent past first.** `parseISO(item.date) < now` items sort descending by `date`.
3. **Same-day tiebreak: `prominence`** (the curation `0.5 × freshness + 0.5 × score + imminenceBonus` composite). On a busy night, the buzzy event of the night sits at the top of that day. HP still influences ordering — just doesn't override chronology.

**Past events are demoted, not hidden.** Two reasons: (a) past events still accumulate comments and HP via the foro and overlay discussion column, so the historical record matters; (b) the [[HP Curation System]] already accelerates decay 2× past 30 days, so a past event nobody talks about fades to near-zero HP within weeks — that's the democratic mechanism doing its job. Visual demotion is `filter: saturate(0.4) brightness(0.85); opacity: 0.7` with a 0.3s ease transition, applied only when `mode === 'agenda' && item.type === 'evento' && parseISO(item.date) < Date.now()`. Future events stay full color.

**Label updated.** `EVENTOS · N ENTRADAS · FUTURO → PASADO` → `EVENTOS · N ENTRADAS · PRÓXIMOS · ARCHIVO ABAJO`. The new copy reads correctly given the new ordering and signals the archive section.

### Why HP doesn't override chronology on /agenda

Considered using full `prominence` ranking (same as the home grid). Rejected — a high-HP editorial event 3 weeks out would outrank a quieter event tomorrow, which is wrong for a calendar page. Users reading `/agenda` are answering "what's happening soon," not "what's most popular." HP/prominence-driven ranking is the home grid's job; `/agenda` is chronological with HP as a tiebreaker only.

### Why past events stay visible

User flagged the redundancy concern with the [[Foro]] (which also hosts post-event discussion). Conclusion: not a duplication — an event card carries structured metadata (date, venue, lineup, flyer, ticket link) that a foro thread can't, so it's the canonical artifact even after the conversation has migrated. If a past event spawns a long foro thread, that's a signal of HP, not a duplication.

### Verified in preview

- Top 6 cards: all `MAY 2` (today).
- Bottom 4 cards: `ABR 25 → ABR 19 → ABR 19 → ABR 18` (past, most-recent first).
- 36 of 151 cards have the desaturate + opacity treatment applied.
- Future cards keep `filter: none; opacity: 1`.
- Page label reads `EVENTOS · 151 ENTRADAS · PRÓXIMOS · ARCHIVO ABAJO`.
- Click-to-overlay still works on past events — just visually muted.

### Files

- `components/ContentGrid.tsx` — added `'agenda'` to the `mode` union, new sort branch, `isPast` prop on `MosaicItem`, conditional CSS filter + opacity.
- `app/agenda/page.tsx` — `mode="agenda"` + label rewrite.

### Open follow-up

- **Past-event treatment on home** if an editor `elevated: true`'s a past event into the main mosaic. Currently the demotion only fires in `mode="agenda"` so home keeps full color. Probably right — home is HP-driven and editor's intent is "boost this" — but flagged in [[Next Session]] S5 as a deliberate design call.

---

## 2026-05-02 · INGEST · EventosRail — Windows/high-refresh fixes (subpixel scroll + drag-to-scroll)

Iker pulled the morning's [[EventosRail]] work onto a Windows PC and hit two failure modes that didn't surface on the MacBook. Both got root-caused via instrumented `preview_eval` and shipped today.

### Failure mode 1 — auto-scroll appears to start, then freezes

Symptom on Windows: rail nudges ~1px on first frame, then sits still. Same code on MacBook works fine.

**Diagnosis.** `scrollLeft` rounds to integers on this engine (verified empirically — writing 0.21 reads back 0; writing 0.7 reads back 1). The auto-scroll loop was doing `track.scrollLeft += SCROLL_SPEED_PX_PER_SEC * dt` per frame. At 60Hz (`dt ≈ 16.6ms`), the per-frame increment is 0.58px — rounds up to 1, accumulates correctly. At 120Hz+ (`dt ≈ 8ms`), the per-frame increment is 0.29px — rounds to 0 every frame, scroll never advances. The MacBook ran at 60Hz so it worked; Windows monitor was high-refresh and exposed the bug.

**Fix.** Keep a fractional accumulator (`let accum = 0`) outside `scrollLeft`. Per frame: `accum += SCROLL_SPEED_PX_PER_SEC * dt`, then commit only `Math.floor(accum)` whole pixels and subtract them from `accum`. The fraction carries across frames regardless of refresh rate. Verified in preview: 162fps headless, scrollLeft advances 62px over 2s (target 70px, accounting for sample quantization).

### Failure mode 2 — "ARRASTRA O ESPERA" copy lied about drag-to-scroll

The morning ship added the `ARRASTRA O ESPERA` ("drag or wait") sub-line, but native `overflow-x: auto` only wires drag-to-scroll for trackpad/touch — mouse drag on Windows did nothing. The label was aspirational.

**Fix.** Pointer events (mouse + touch + pen unified):
- `pointerdown` → record `dragStartX`, `dragStartScroll`, set pause; don't yet flag as drag.
- `pointermove` → if motion exceeds `DRAG_THRESHOLD_PX = 5`, flip `dragged = true`, set pointer capture, change cursor to `grabbing`. Set `track.scrollLeft = dragStartScroll - dx`.
- `pointerup` / `pointercancel` → if `dragged`, release capture, restore cursor, override the lingering pointermove pause with a shorter `PAUSE_AFTER_DRAG_MS = 500` so auto-scroll resumes promptly after release.
- `click` (capture phase) → if `dragged`, `stopPropagation` + `preventDefault` so the post-drag click doesn't accidentally open a card overlay.

Genuine taps below the threshold still open the card. Cursor: `grab` on the track, `grabbing` while actively dragging.

**Pause-tuning side effect.** While auditing the pause logic I noticed `PAUSE_AFTER_INTERACTION_MS = 3000` was being refreshed on every pointermove during a drag — so a 5-second drag + release meant a 3s wait before auto-scroll resumed. Dropped the wheel/touch constant to 1500ms (`user is reading a card`) and added `PAUSE_AFTER_DRAG_MS = 500` (`user just repositioned the rail; resume quickly`) applied explicitly in `endDrag`.

### Defensive try/catch on pointer-capture

`setPointerCapture` / `releasePointerCapture` can throw `InvalidStateError` if the pointer isn't an active browser pointer (synthetic events, element re-attachment, etc.). The optional chain `?.` doesn't catch exceptions. Wrapped both in try/catch + a `hasPointerCapture` guard. Production code path doesn't hit this, but it kept biting during synthetic-event testing in the preview.

### Verified in preview

- Subpixel: scrollLeft advances steadily at 35 px/s under 162fps headless.
- Drag: 6 pointermove events × 12px = 72px drag → scrollLeft moves exactly 72px.
- Tap (no drag): card overlay opens normally.
- Drag + release: auto-scroll resumes at ~560ms after release (target 500ms).
- Cursor: `grab` over the track; `grabbing` mid-drag.

### Files

- `components/EventosRail.tsx` — accumulator, pointer event handlers, pause constants split, capture try/catch, `cursor-grab` class.

### Open follow-ups

- **Mobile pass for the rail** — drag uses pointer events so should work on touch, but the 180px card width means ~1.8 cards visible on a 360px viewport. Probably want a smaller variant. Tracked in [[Next Session]] S4.
- The subpixel-scroll trap is a generic gotcha — any future rAF loop nudging sub-pixel deltas to `scrollLeft` / `scrollTop` needs the same accumulator pattern. Worth a wiki page if a second offender shows up.

---

## 2026-05-01 · INGEST · EventosRail — manual + auto scroll cooperation

Quick fix to the rail shipped earlier today. Iker hit the obvious failure mode: "once an event has scrolled, it is gone until the carousel restarts." The CSS marquee + `overflow-hidden` meant the only motion was auto-scroll, and there was no way to backtrack to a card you missed without waiting ~240s for the next cycle.

### What changed

- **Replaced the CSS animation with a `requestAnimationFrame` loop** that nudges `track.scrollLeft` by `SCROLL_SPEED_PX_PER_SEC * dt` pixels per frame (35 px/sec). Manual scroll (wheel, touch, drag) and auto-scroll now operate on the same `scrollLeft` property — they cooperate naturally.
- **Wrapper is now `overflow-x-auto`** (was `overflow-hidden`). Users can scroll/swipe/wheel through cards at will. Native scrollbar hidden via `scrollbar-width: none` (Firefox) + a new `.evento-rail-track::-webkit-scrollbar { display: none }` rule in `globals.css` (WebKit) — the rail keeps its clean look; the auto-motion + edge fades carry the scrollability affordance.
- **Pause rules:**
  - Hover or focus-within → paused indefinitely (so users can target a card without it sliding away).
  - User-initiated scroll (`wheel` / `pointerdown` / `touchstart`) → paused for 3s after last interaction. Auto-scroll resumes from wherever the user landed; no jump-back.
- **Seamless wrap preserved.** Cards are still duplicated (`[...sorted, ...sorted]`); when `scrollLeft >= scrollWidth/2`, the loop subtracts `scrollWidth/2`. Since the second-half cards are identical to the first-half cards at the same on-screen position, the wrap is invisible. Verified with eval: scrollLeft 22418 → 50, leftmost visible card unchanged.
- **Reduced-motion** still respected: the rAF effect short-circuits when `prefers-reduced-motion: reduce` matches. Manual scroll always works regardless.
- **Sub-line copy updated** from `PRÓXIMOS · ORDEN CRONOLÓGICO · CLICK PARA DETALLE` → `PRÓXIMOS · ORDEN CRONOLÓGICO · ARRASTRA O ESPERA · CLICK PARA DETALLE` — the `ARRASTRA O ESPERA` ("drag or wait") signals the new affordance without adding chrome.

### Verified in preview

- `track.overflowX === "auto"`, `track.scrollbarWidth === "none"`, scrollWidth 44736px (vs viewport ~1400px in headless preview), 238 cards.
- Manual scroll to position 5000 → fired wheel event → after 1.5s scrollLeft is still 5000 (pause-on-interaction works).
- Manual scroll back from 3000 → 1000 → leftmost visible card changed to "ROOFTOP PARTY 'ANGEL DE LA INDEPENDENCIA'" (backward scroll works, user can revisit cards).
- Wrap math sanity: scrollLeft 22418 → after wrap step → 50. (Auto-tick of the rAF loop doesn't run reliably in the headless background tab, but the wrap math is verifiable directly.)

### Why rAF instead of CSS scroll-snap + auto-cycling

Considered a `scroll-snap-type: x mandatory` + `setInterval(scrollBy(cardWidth))` approach. Rejected because it produces jerky stepwise motion, conflicts with smooth user dragging mid-snap, and snap points feel wrong for a continuous "live ticker" surface. The rAF + `scrollLeft` approach is what carousel libraries like Embla and Splide do under the hood; doing it in 50 lines without a dep felt like the right tradeoff at this scale (single rail, single page, no edge cases).

### Files

- `components/EventosRail.tsx` — rewrote the scroll mechanism (added `useEffect` with rAF loop + event listeners; replaced `motion-safe:animate-[...]` classes with a plain `evento-rail-track` className).
- `app/globals.css` — added the WebKit scrollbar-hide rule.
- `wiki/40-Components/EventosRail.md` — updated the Behavior + What it depends on sections.

### Open follow-up

- **`overscroll-behavior-x: contain`** — already added to prevent horizontal swipes from triggering page-level back-nav on touch devices. Worth verifying once the mobile pass happens.
- The CSS `nge-ticker` keyframe is still in `globals.css` and still used by [[Navigation]]'s data-strip ticker. Don't remove it.

---

## 2026-05-01 · INGEST · EventosRail — early Phase 2 demotion of scraped events

Third change in today's scraper arc, driven by the obvious failure mode of the morning's ship: 128 RA events landed in the home mosaic and immediately swarmed it (190 cards total, mostly scraped). Iker's framing in the chat: "the entire feed got swarmed by them — there's basically 81 events flooding the entire page." Two ideas weighed: HP penalty alone vs horizontal carousel. Recommendation was rail-first with HP/elevation as the editor lever, since pure HP doesn't fix the visual real-estate problem (events sink to the bottom but still consume mosaic positions).

This is functionally [[Scraper Pipeline]] **Phase 2 arriving on day one** — see that doc for the updated phase narrative. Editorial dominates home, scraped lives in its own surface, editor elevation pulls individual scraped events into the mosaic.

### What shipped

- **New field** on [[types]] · `ContentItem.elevated?: boolean` — editor lever. When true on a scraped event, that event leaves the rail and joins the main mosaic where it competes via HP. Default `false` (script never sets it). No-op for non-scraped items.
- **New component** · [[EventosRail]] — auto-scrolling horizontal marquee under the [[HeroCard]]. ~5-7 cards visible at desktop width, marquee speed scales with item count (`max(60, count*2)` seconds per cycle ≈ 2px/sec at 119 events). Cards are 180px wide with `aspect-[4/5]` image, //EVENTO label, date chip (month/day/weekday), 2-line title, 1-line venue. Pauses on hover/focus; reduced-motion users get a manually-scrollable list (`motion-reduce:overflow-x-auto`). Click → same `useOverlay` flow as [[ContentCard]].
- **Wiring** · [[Home]] page splits `homeItems` via the `isRailEvent` predicate (`source === 'scraper:ra' && !elevated`). `railEvents` feeds the rail, everything else flows to the mosaic as before. Single source of truth for the split lives in `app/page.tsx` so the filter can be tweaked without touching component internals.

### Visible result (verified in preview)

- Home grid header dropped from `190 ENTRADAS` → `71 ENTRADAS`. The mosaic now reads as editorial-led with the Club Japan editorial pinned hero, then the agenda rail, then editorial + manually-authored event cards.
- Rail header reads `// AGENDA · 119 EVENTOS · LIVE FEED · RA` with a pulsing green dot — matches the existing system-terminal voice.
- Rail card click → URL → `?item=ra-<slug>` → EventoOverlay mounts (verified with Salón Sölín card; same flow, same overlay component).
- Marquee animation configured + running (`animation-play-state: running`, transform offset `-1847px` after page-load). Was paused in headless preview because Chrome throttles backgrounded tabs; will run for users.

### Architectural significance

Original phase plan had the scraper firehose in the home grid for launch (event-listing-first user acquisition) and Phase 2 demotion only after editorial/foro gained organic traction. In practice the firehose was visually unworkable from minute one — 128 cards in a single mosaic is just noise, regardless of HP ranking. The rail solves that without giving up the user-acquisition benefit (the LIVE FEED chip + auto-motion under the hero is highly visible, and the rail is the first thing below the editorial pinned hero — not buried).

The `elevated` lever preserves the [[Guides Not Gatekeepers]] thesis: editor judgment can still pull individual scraped events into the editorial competition. Scraper output is leads, not content.

### Open follow-ups

- **//FUENTE · RA chip** in [[EventoOverlay]] — still pending from the morning's ship. Now that rail cards exist, the chip should also appear on those (small mirror).
- **Editor-elevation surface** — flipping `elevated: true` is currently file-edit only (write `elevated: true` on the item in `lib/scrapedEvents.ts`). A proper UI lives behind [[Supabase Migration]] / [[Admin Dashboard]] (Phase 3).
- **Mobile pass** for the rail — touch + reduced-motion fallback path (`overflow-x-auto`) needs testing on small viewports. Consistent with the broader mobile-pass debt in [[Next Session]].
- **Date-tab filter** above the rail (TONIGHT / TOMORROW / THIS WEEKEND) — option (b) from the ship discussion. Skipped for first ship; revisit if the rail feels too undifferentiated.

---

## 2026-05-01 · INGEST · Scraper Pipeline — hotlink images + RA descriptions

Two follow-up changes to the Phase 1 ship from earlier today, both driven by Iker's feedback:

### Switch from rehosted flyers to hotlinking RA's CDN

Original Phase 1 ship downloaded each flyer to `public/flyers/ra-<id>.jpg` and committed them. Iker's call: hotlink directly to `images.ra.co` instead. Strongest "we're an aggregator" signal — we literally point at RA's files rather than copying them — and zero repo growth from re-scrapes.

**Verified empirically**: `curl -sI -H "Referer: http://localhost:3003/" https://images.ra.co/<sha>.jpg` returns HTTP 200. RA's Cloudflare CDN doesn't enforce a referer check, so hotlinking from any origin works.

**Code changes** in `Webscraper/ra_to_gradiente.py`:
- Removed `download_flyer()`, `flyer_filename_for()`, the `FLYERS_DIR` constant, and the `--no-flyers` CLI flag.
- `get_flyer_url()` now returns the raw RA CDN URL; the main loop stores it directly in `imageUrl` (no `/flyers/` prefix).
- Stats updated: `with_image` / `no_image` / `with_description` instead of `flyers_saved` / `flyers_failed`.
- Header comment in the script documents the decision + the empirical referer check, so future readers know why we hotlink instead of download.

**Cleanup**: deleted 83 `public/flyers/ra-*.jpg` files left over from the rehost run. Repo back to the original 98 seed flyers.

**Tradeoff to accept**: if RA cycles a URL or takes an event down, the thumbnail breaks (404). Acceptable for MVP; failure mode is "broken thumbnail" not "broken page." Falling back to local rehost is a 5-line revert if it ever becomes a problem.

### Pull RA event descriptions into `excerpt`

Iker noticed scraped cards lacked the well-written event paragraphs that some RA events carry. RA exposes this on `Event.content` (introspected the GraphQL schema to confirm — also saw `pick.blurb` for editorial picks but it's null in the CDMX sample, deferred). Length varies wildly: some events have a one-liner ("Open hours: Wed-Sun 6pm-3am"), others have multi-paragraph copy with line-up bios, pricing details, and credits.

**Code changes** in the same script:
- Added `content` to the GraphQL query.
- New `clean_description()` helper that strips stray HTML-ish tags (RA's `lineup` field has `<artist id="...">name</artist>` markers that occasionally bleed into `content`) and collapses whitespace.
- `emit_item()` writes an `excerpt: "..."` line when present (omitted when null, no empty-string noise in the file).
- `parse_existing_items()` updated to round-trip `excerpt` across re-runs so manual edits aren't lost (still doesn't preserve manual non-id field edits in general — the open-follow-up flagged earlier today).

**No new types** — the existing `excerpt?: string` field on `ContentItem` already wires through to both the card preview and the EventoOverlay reader pane.

### Verified in preview

- 99 hotlinked images render on the home page, all `complete: true` with non-zero `naturalWidth` (sampled). RA's CDN serves them with permissive caching headers.
- Clicking a card with a description (`Deseo x fiestuki`) opens the EventoOverlay with: hotlinked flyer at top → structured fields (FECHA, HORA, LUGAR, PRECIO, VIBE, LINE-UP) → full multi-paragraph RA description → `ra` tag chip → orange `COMPRAR BOLETOS ↗` CTA linking back to `https://ra.co/events/<id>`.
- The aggregator framing is now visibly load-bearing: the image *is* RA's, served by RA, and the only purchase path goes back to RA. We're orienting users toward the event, not capturing them.

### Updated stats (re-run, CDMX-only, 4 weeks)

```
New events            : 128
Multi-day collapsed   : 22
With hotlinked image  : 108
No image on RA        : 20
With description      : 81
```

81 of 128 events (63%) carry an RA-authored description that now renders in the overlay. The other 37% have no `content` on RA — those are the bare cards with just venue + date + lineup.

### Open follow-ups (still pending from this morning's ship)

- **//FUENTE · RA chip** in EventoOverlay when `source === 'scraper:ra'`. The `COMPRAR BOLETOS ↗` button already links to RA, but an explicit attribution chip alongside the //EVENTO label would make the "RA-sourced, edited by us never" framing unambiguous.
- **Editor review surface** — still file-based for now.
- **Vibe assignment** — still defaults to 5; manual edits still get clobbered on re-scrape (the round-trip parser preserves `id`, `slug`, `excerpt`, etc. but treats RA as the source of truth on re-fetch).
- **Phase 2 demotion** — when foro/editorial gain traction, filter `source === 'scraper:ra'` out of home and limit them to `/agenda`.

---

## 2026-05-01 · INGEST · Scraper Pipeline — Phase 1 (direct RA → app, skip Excel)

The RA scraper is back in scope. Iker's call: event listing is the launch user-acquisition draw, so the scraper has to ship for the visual MVP — but feeding directly into the app, no Excel intermediate, no Supabase. See [[Scraper Pipeline]] for the phase strategy (Phase 1 firehose → Phase 2 demotion to /agenda once editorial/foro mature → Phase 3 Supabase + cron).

**New files:**
- `Webscraper/ra_to_gradiente.py` — adapted from `ra_scraper_v2.py`. Same RA GraphQL fetch + flyer download, but writes a typed `ContentItem[]` TS file instead of an Excel sheet. Dedups against an existing scrape file (regex-parsed for `externalId` values) so re-runs UPSERT, and within-batch dedups multi-day events that RA returns as multiple listings sharing one event.id.
- `lib/scrapedEvents.ts` — auto-generated. Exports `SCRAPED_EVENTS: ContentItem[]`. Header marks it as machine-written + tells the reader how to regenerate. Items are sorted by date ascending so re-scrape diffs are readable.

**Type additions** ([`lib/types.ts`](../lib/types.ts)):
- `source?: 'scraper:ra' | 'manual:editor' | 'manual:partner'` — provenance, drives the future //FUENTE attribution chip and the Phase 2 home-vs-/agenda filter.
- `externalId?: string` — upstream id (RA event id), the dedup key on re-scrapes.
- New `ContentSource` type alias.

Both fields are optional → no migration needed for existing items.

**Wiring** ([`lib/mockData.ts`](../lib/mockData.ts)) — one-line change: `[...RAW_ITEMS, ...SCRAPED_EVENTS]` instead of just `RAW_ITEMS`. All 7 downstream MOCK_ITEMS consumers (page.tsx, partnerOverrides, saves, category routes, etc.) automatically pick up scraped events without modification because they're already typed `ContentItem`s.

**Field mapping (RA event → ContentItem evento):**

| RA field | ContentItem field | Default |
|---|---|---|
| `title` | `title` | "untitled" |
| `id` | `externalId` + `id: ev-ra-<id>` | — |
| `date + startTime` | `date` (ISO) | midnight + 22:00 |
| `date + endTime` (with day-roll if past midnight) | `endDate` | undefined |
| `venue.name` | `venue` | "Venue TBA" |
| `venue.area.name` (mapped to short code) | `venueCity` | "Mexico City" |
| `artists[].name` | `artists` | `[]` |
| `cost` | `price` (or "Gratis" for "0"/empty + free) | undefined |
| `contentUrl` | `ticketUrl` (full RA URL) | — |
| `genres` (mapped via RA_GENRE_MAP) | `genres` | `[]` |
| `images[FLYERFRONT or first]` (downloaded to `public/flyers/ra-<id>.jpg`) | `imageUrl` | undefined |
| — | `vibe` | `5` (neutral, editor-set later) |
| — | `editorial` | `false` |
| — | `source` | `'scraper:ra'` |
| — | `tags` | `["ra"]` |
| — | `slug` | `ra-<sanitized-title>-<external-id>` |

**Phase 1 first run** (CDMX-only, 4 weeks):
- 150 listings fetched from RA → 128 unique events after collapsing 22 multi-day duplicates.
- 108 flyers downloaded to `public/flyers/ra-*.jpg` (committed per Iker's call — option (a)). 20 events had no image on RA.
- Home grid header updated from ~70 entries → 190 entries (190 = ~62 seed + 128 scraped, partners excluded).
- Real CDMX events render in the mosaic with the same EventoOverlay path as seed content. Verified in preview: "Imago & K'OLIS + LUCRECIA @ Terraza Catedral", "Deseo x fiestuki @ CHICO", etc., with downloaded flyers + date chip + venue subtitle + genre tag.

### Three bugs caught + fixed before final ship

1. **Within-batch duplication** — RA's `eventListings` API returns multi-day events as multiple listings sharing one `event.id`. The first run wrote each event N times. Fix: a `batch_seen_ids` set in the main loop; collapses to one item per `externalId` per scrape. (22 collapses on the first real run.)
2. **Price `"0"`** — RA returns literal `"0"` for free events. The first run rendered cards with `price: "0"`. Fix: `re.fullmatch(r"0+(?:\.0+)?", s)` returns `"Gratis"`.
3. **EndDate day-roll** — events ending past midnight (e.g. starts 18:30, ends 01:00) wrote `endDate` on the same calendar day, producing non-monotonic ISO. Fix: if endTime ≤ startTime, bump the date by one day.

### Aggregator framing (per Iker's "we're not stealing data" goal)

- `ticketUrl` always points back to RA (`https://ra.co/events/<id>`). Card CTA is link-out, never an in-house ticketing flow.
- `source: 'scraper:ra'` on every item — drives the future //FUENTE · RA chip in EventoOverlay (small follow-up, not blocking this ship).
- Flyers re-hosted to our `public/flyers/` rather than hotlinked — kinder to RA's CDN, faster for our users. The downloaded image is RA's; attribution belongs in the overlay.

### Open follow-ups

- **//FUENTE · RA chip** in EventoOverlay when `source === 'scraper:ra'`. Mirrors the `//FUENTES` pattern from [[ArticuloOverlay]] / [[MarketplaceListingDetail]]. Small one-overlay edit.
- **Editor review surface**. Today the team reviews scraped output by reading `lib/scrapedEvents.ts` directly. Crude but works at MVP scale. A proper queue UI lives behind [[Supabase Migration]] (Phase 3).
- **Vibe assignment**. All scraped items default to `vibe: 5`. Editorial team can override case-by-case by editing the file in-place (the file's not regenerated unless `ra_to_gradiente.py` is re-run, and even then the parser preserves existing items via externalId merge — but it does NOT preserve manual edits to non-id fields, so an edited vibe gets clobbered on re-scrape). Worth flagging: a `vibeOverride` side-table or persisting parsed-then-merged-with-edits behavior is the correct fix once we feel the pain.
- **Phase 2 demotion**. Scraped events currently appear in the home grid alongside editorial. Once foro/editorial gain organic traction, filter `source === 'scraper:ra'` out of the home query and limit them to `/agenda`. Architecture supports this — the `source` field is already filterable from day one.
- **Cadence + automation**. Manually re-run for now. When Iker wants a schedule, cron lives in [[Supabase Migration]] (Phase 3).

---

## 2026-04-30 · INGEST · Marketplace v2 — Chunk C (sub-overlay listing detail)

Closes the read loop. Clicking any listing in [[MarketplaceOverlay]] now opens a sub-overlay with the full ficha — image gallery, full description, embeds, tags, shipping, vendor link back. Deep-linkable via `?partner=<slug>&listing=<id>`. ESC peels one layer at a time: sub-overlay → partner overlay → catalog.

**New component** — [[MarketplaceListingDetail]] (`components/marketplace/MarketplaceListingDetail.tsx`). Same visual idiom as the partner overlay (eva-box + scanlines + black/85 backdrop with blur, role="dialog"). Stacks at z-60 above the partner overlay's z-50 so the parent stays visible behind the backdrop. Body lock is left to the parent overlay since both stacks share `body.style.overflow = 'hidden'`. Layout splits left/right at the md breakpoint:

- **Left — gallery (55% width on md+)**: large 4:3 main image + thumbnail strip below (orange-bordered active thumb, opacity dim on inactive, `PORTADA` badge on the first thumb). Click any thumb → main image swaps. Single-image listings drop the strip; zero-image listings render the `//CATEGORY` placeholder. `activeImage` resets to 0 on listing-id change so deep-link re-entries always start at the portada.
- **Right — meta**: `★ MARKET · <PARTNER>` chip, big syne title (`id="listing-detail-title"` so the dialog gets `aria-labelledby`), category/subcategory line in vibe-orange, $price MXN in syne 3xl, a single horizontal strip combining `CONDICIÓN <X>` and the color-coded status pill (so the reader sees "what is it / can I buy it" together), then **//FUENTES** (link-out chips for any embeds, mirrors the `[[Embed Primitive]]` idiom from [[ArticuloOverlay]]'s track blocks — same `<a>` chip with `PLATFORM_LABEL` + `ExternalLink`), **//DESCRIPCIÓN** (free text), **//ETIQUETAS** (`#tag` chips), **//ENTREGA** (icon + label, only when `shippingMode` is set), **//VENDEDOR** (an in-app `← <PARTNER>` button that calls `onClose` to return to the partner overlay, plus an outbound `partnerUrl` chip when present), and a footer disclaimer reminding the buyer that GRADIENTE FM doesn't process pages or shipping.

**MarketplaceOverlay rewiring** — the partner overlay now reads both `?partner=` and `?listing=` from URL via `useSearchParams`. When `listing` is set, it resolves the listing off the partner's `marketplaceListings` (in publishedAt-desc order, mirroring the grid's index badge), and mounts `MarketplaceListingDetail` siblingwise inside its outer container. The detail's `onClose` strips `listing=` *only* via `router.replace`, leaving `partner=` untouched — closer drops back into the partner overlay, not the catalog. Card-click handler in the listings grid pushes `?listing=<id>` on the same URL using `router.replace({ scroll: false })` so the URL stays clean and history doesn't accumulate.

**MarketplaceListingCard becomes optionally clickable** — the card grew an `onClick?: () => void` prop. When provided it renders as a `<button>` with `aria-label="Ver detalle de <title>"` + hover/focus border in vibe-orange; otherwise it stays a presentational `<article>` (the GRID-mode preview in the dashboard composer doesn't get the click affordance, since clicking a preview to open another preview would be silly). Body markup extracted into a sibling `CardBody` component — both branches reuse the same render tree.

**ESC handling** — both overlays bind `keydown` on `window`. To prevent a single ESC from collapsing both at once, the partner overlay's handler is gated on `!listingId` (closure-captured at effect run time). Press order:

1. `?partner=…&listing=…` open → ESC → sub-overlay handler runs → strips `listing=` → next render, parent's effect re-runs without the gate → sub-overlay unmounts.
2. `?partner=…` open → ESC → parent's handler runs → strips `partner=` → catalog visible.

[[MarketplaceCatalog]]'s `onCloseOverlay` now strips both `partner` and `listing` so closing the partner card via the [×] button never leaves an orphaned listing param.

**Seed enrichment** ([[mockData]]) — `mkl-naafi-01` (Siete Catorce — Volcán) gained 3 images (`/flyers/rf-074.jpg`, `rf-075.jpg`, `rf-076.jpg`), 2 embeds (SoundCloud + YouTube placeholder URLs), and a real description. `mkl-naafi-02` got 2 images. This exercises the gallery-strip swap, the //FUENTES embed chip render, and the embed-less branch (the other 4 listings) in one catalog browse.

### Verified in preview

- `/marketplace?partner=naafi` → 6 listing cards, all `<button data-listing-id>` with proper aria-labels.
- Click `mkl-naafi-01` → URL becomes `?partner=naafi&listing=mkl-naafi-01`, sub-overlay (`role="dialog"`) mounts. Title strip `//LIST · ID·NAAFI-01`, gallery shows the rf-074 portada + 3 thumbnails with the PORTADA badge on the first, full meta on the right (Siete Catorce — Volcán h1, VINYL · 12" subcat in orange, `$450 MXN` in syne 3xl, CONDICIÓN NM + DISPONIBLE green pill row, //FUENTES with SOUNDCLOUD + YOUTUBE chips, //DESCRIPCIÓN with the full seed copy, //ETIQUETAS with `#limited #club-music #mexico`, //ENTREGA with the truck/AMBOS icon, //VENDEDOR back-button + naafi.net outbound link).
- Click second thumbnail → main image swaps from `/flyers/rf-074.jpg` to `/flyers/rf-075.jpg`, the second thumb gets `aria-pressed="true"`.
- Press ESC once → URL → `?partner=naafi`, dialog count drops to 0, partner overlay still open with all 6 listing buttons intact.
- Press ESC again → URL → `/marketplace/`, both overlays gone, catalog grid visible with the N.A.A.F.I. card.
- Direct deep-link `?partner=naafi&listing=mkl-naafi-01` opens both overlays from the URL alone (validates the composer's VISTA PREVIA button workflow — the URL pattern Chunk B already targets).
- Zero console errors throughout. Build clean (no new lint warnings).

### Open follow-ups

- **Embeds editor in the composer**. The detail consumes `embeds`, but the dashboard composer doesn't yet expose an editor for them. Easy follow-up — the existing `EmbedList` from `Fields.tsx` (used by mix/listicle forms) drops in directly with `value={listing.embeds ?? []}` / `onChange={(embeds) => onPatch({ embeds })}`.
- **Image lightbox**. Clicking the big main image could expand to a full-viewport zoom (similar to the foro thread image float). Today the gallery is "click thumb to swap"; lightbox is a separate gesture.
- **Inline embed players**. Today embeds are link-outs, not inline iframes. The audio system has SoundCloud working as a live embed (see [[Audio reactive subsystem]]); plumbing that here would let buyers preview without leaving the overlay. Outside the v2 scope.
- **Quick-filter chips inside MarketplaceOverlay**. The reference screenshot showed `/ VINYL · / CASSETTE · …` chips above the listings grid. Still pending; would let buyers narrow by category without leaving the partner overlay.
- **Per-listing `sellerId`**. Carry-over from v1 — the detail still shows the partner's name uniformly as the vendor.
- **Sub-overlay back button on mobile**. The chrome strip's `← VOLVER` button is `hidden sm:flex`. Below sm, only the [×] CERRAR button is visible. Functionally fine (both call the same `onClose`), but a small visual gap.

---

## 2026-04-30 · INGEST · Marketplace v2 — Chunk B (composer rewrite, 3-zone layout)

The visual centerpiece of the v2 plan. Replaces the inline `ListingsEditor` (compact rows + per-row inline editor) inside [[MiPartnerSection]] with a 3-zone layout matching Iker's mockup. Pure UI work on top of Chunk A's type extensions; partnerOverrides write idiom unchanged. See [[MiPartnerSection]].

**Architecture** — single new orchestrator `ListingsManager` owns three sibling regions:

- **LEFT — `ListingComposer`**. Hot-resolved each render from `partner.marketplaceListings` by id, so partnerOverrides writes propagate instantly to both the composer and the preview pane. Empty-state placeholder when nothing is selected. Form fields (each in its own `FormField` wrapper):
  - `CharCountedInput` — title, max 80, counter flips red on overflow.
  - `CategorySubcategoryPair` — paired selects; subcategory `<select>` reads `SUBCATEGORIES_BY_CATEGORY[category]` and shows `// n/a` when the catalog is `[]` (only `other`). Switching category drops a now-orphan subcategory.
  - `<select>` condition + numeric `<input>` price (currency suffix in label from partner).
  - `StatusRadioRow` — 3-button radio (DISPONIBLE green / RESERVADO yellow / VENDIDO red); active button gets vibe-color border + tinted bg + matching dot.
  - `MultiImageGallery` — drag-drop drop zone (whole region; data URLs via `FileReader.readAsDataURL`), `+ AGREGAR` empty slot opens the file picker, per-image `↑ / ↓` reorder buttons + `×` remove (revealed on hover or focus-within), `PORTADA` star badge on `images[0]`, `ARCHIVO` label on data-URL slots so partners can spot uploaded vs linked images at a glance, `+ AÑADIR URL` fallback toggles an inline URL input (Enter commits, Esc cancels).
  - `CharCountedTextarea` — description, max 1000, same overflow treatment.
  - `TagsChipInput` — chip-style input. Enter or `,` commits; Backspace on empty input removes the last chip; click `×` per chip to remove. Stored lowercase, deduped. Renders as `#name` chips.
  - `ShippingRadioCards` — 3-card radio (ENVÍO / RECOGIDA / AMBOS) with icon (Truck/MapPin/Package) + label + sublabel. Click again on the active card clears (matches the optional `shippingMode?` shape).
  - `ActionRow` — `VISTA PREVIA` (Eye icon, opens `/marketplace/?partner=<slug>&listing=<id>` in a new tab — that URL is what Chunk C will react to), `▣ GUARDAR BORRADOR` (gray), `▶ PUBLICAR ITEM` (green primary). Edits are already auto-saved through inline writes, so both action buttons just close the composer and fire a 2.5s flash chip (`◉ GUARDADO` / `▶ PUBLICADO`). A real draft pipeline would need a new `_draft?` flag on `MarketplaceListing` + filter in the public catalog — flagged as a follow-up.

- **RIGHT — `ListingPreviewPane`**. Three-mode toggle in the header (`DESTACADA` / `GRID` / `LISTA`):
  - `DestacadaPreview` — large 4:3 image (or `//CATEGORY` placeholder), big title + category/subcategory line in vibe-orange, large price, meta block (CONDICIÓN / VENDEDOR / ENTREGA), description preview (line-clamp-4), `#tag` chips, status pill at the bottom.
  - `GRID` — embeds the existing public-side [[MarketplaceListingCard]] component verbatim, capped at 280px wide for the pane. Single source of truth — when the public card visual changes, the preview follows. (This is the shared component Iker asked about; deferring an extracted `ListingDetailView` until Chunk C lands and we can see the actual sub-overlay shape side-by-side.)
  - `ListaPreview` — linear row variant (thumb + title + category line + price + status pill).
  - Empty state when nothing is selected.

- **BOTTOM — `ListingsTable`**. Replaces the v1 compact-row UL.
  - Columns: thumb (32px), title, category+subcategory, condition, price, status pill (color-coded), updated (relative-ago), actions.
  - `SortHeader` per sortable column — click to toggle asc/desc; active column shows `↑`/`↓` indicator in orange. Default sort: `updated desc`.
  - Pagination at 5 per page with chevron-prev / chevron-next + `PÁGINA N / M` indicator. The N.A.A.F.I. seed (6 listings) renders 5 on page 1 + 1 on page 2 — exercises pagination out of the box.
  - Per-row actions: `Pencil` (edit; opens listing in composer, shows orange-active state when editing), `Copy` (duplicate; clones with new id + ` (copia)` title suffix + `status: 'available'` + `publishedAt: now`, auto-selects clone), `Trash2` (delete; red border).
  - `+ NUEVO LISTADO` in the header creates a fresh draft (`images: []`) and auto-opens it in the composer.
  - Editing-row highlight: orange-tint bg + orange-active edit pencil button so the user can always see which listing the composer is bound to.

**Sub-control implementation notes**:

- `relativeAgo(iso)` — handcrafted bucket helper (HOY / Nh / Nd / Nsem / Nmes), avoids pulling in another date-fns format for the table cell.
- Image gallery's drop zone wraps the entire region (drag highlight on the dashed border) but only `+ AGREGAR` does the file-picker click, so dragging an image directly onto an existing slot doesn't trigger a confusing per-slot replace.
- ImageSlot key is `${i}-${src.slice(0,24)}` so React doesn't reuse the same DOM node across reorders (the prior key would have caused image flashes during the swap).
- Auth context's `useResolvedUser` was already synchronous — the composer's hot-resolve trick is just `listings.find((l) => l.id === editingId)` each render; no extra subscription plumbing needed.

**Type changes** — none. Chunk A's `MarketplaceListing` shape carries through cleanly. Used the new `MarketplaceShippingMode` + `SUBCATEGORIES_BY_CATEGORY` exports.

**v1 inline editor + helpers** (`ListingsEditor`, `ListingRow`, `ListingEditor`, `Field`) deleted — not retained as a fallback since Chunk B is a clean replacement for the same surface.

### Verified in preview

- Logged in as `@loma_grave` on `/dashboard?section=mi-partner` → MiPartnerSection mounts MARKETPLACE tab. Both composer and preview show empty placeholders; table shows 6 ITEMS with pagination at PÁGINA 1 / 2 (5 rows page 1).
- Click pencil on `mkl-naafi-01` → composer header reads `EDITANDO · NAAFI-01`, every field hydrates: title `Siete Catorce — Volcán` (counter 22/80), CATEGORÍA VINYL + SUBCATEGORÍA `12"`, CONDICIÓN NM, PRECIO 450, status DISPONIBLE active, IMÁGENES · 0 with empty drop zone, ETIQUETAS shows `#limited #club-music #mexico` chips, MODO ENTREGA AMBOS active. Preview pane in DESTACADA renders the seed listing with full meta block, status pill, tags, description (when present).
- Type `TEST · Live Sync` into title → preview's `h3` updates instantly. Restored to original.
- Click RESERVADO → status active flips, preview pill switches to yellow. Restored to DISPONIBLE.
- Toggle preview mode to GRID → renders the public [[MarketplaceListingCard]] inside a 280px frame; LISTA → linear-row variant; DESTACADA → full ficha. All three live-bind to the listing.
- Click PRECIO sort header → table sorts ascending ($200 → $450), header label becomes `PRECIO ↑`. Click again → descending.
- Click chevron-right → PÁGINA 2 / 2 with the 6th row (`Girl Ultra`). Click duplicate on it → composer opens on the new clone with title `Girl Ultra — Sofía 12" (copia)`, total flips to 7 ITEMS.
- Click delete (red) on the (copia) row → row gone, total back to 6 ITEMS, composer drops to empty state (since the editing target was deleted out from under it).
- VISTA PREVIA opens `/marketplace/?partner=naafi&listing=mkl-naafi-01` in a new tab. Chunk C will mount the sub-overlay against this URL pattern; today the partner overlay opens but the listing param is ignored — by design.
- Zero runtime errors throughout (`preview_console_logs level=error` returned empty).
- Visual screenshot matches the v2 mockup: composer left, preview right (stacking on narrow viewports — `lg:grid-cols-2` breakpoint), table below with editing-row orange highlight.

### Open follow-ups (carry into Chunk C)

- **Sub-overlay listing detail at `?listing=<id>`**. The composer's VISTA PREVIA button already targets the URL pattern; Chunk C's overlay reacts to it.
- **Embeds editor inside the composer**. Chunk A's `embeds?: MixEmbed[]` field is on the type but not yet exposed in the composer — Chunk C surfaces the consumer first (read-side embed render in the sub-overlay), Chunk D could add the dashboard editor reusing [[Embed Primitive]]'s `EmbedList` from `Fields.tsx`.
- **Real draft pipeline**. The GUARDAR / PUBLICAR distinction is cosmetic today (both close + flash). When partners need true save-then-publish semantics, add `_draft?: boolean` on `MarketplaceListing` + filter in the public catalog + a BORRADOR pill in the table.
- **Publish-confirm flow integration**. The existing [[PublishConfirmOverlay]] could wrap the PUBLICAR ITEM button if the partners want the same glitch-card confirmation gate as content items get.
- **Drag-handle reorder** in the image gallery. `↑/↓` buttons cover the use case; HTML5 drag-drop reorder would be ergonomic but is non-trivial. Defer.
- **Image gallery within published listings**. The public listing card still shows only `images[0]`. Chunk C's sub-overlay surfaces the full gallery.

---

## 2026-04-30 · INGEST · Marketplace v2 — Chunk A (type + storage + seed migration)

Foundation chunk for the v2 refinement laid out in [[Marketplace]] § "Planned refinement". Pure type/storage work; v1 UI continues to render unchanged. See [[types]] / [[mockData]] / [[partnerOverrides]].

**Type extensions** ([[types]]). `MarketplaceListing` reshaped:

- `imageUrl?: string` → **`images: string[]`** (required; first index is the portada). Empty array means no portada — the card falls back to the existing category-label placeholder.
- New `subcategory?: string` — member of the catalog below; the composer's dependent dropdown reads from here.
- New `tags?: string[]` — free-form chip input (e.g. "limited", "first-press", "sealed").
- New `shippingMode?: 'shipping' | 'local' | 'both'` (`MarketplaceShippingMode` union).
- New `embeds?: MixEmbed[]` — reuses the existing audio-system shape so SC/YT/Spotify/Bandcamp/Mixcloud preview links work without new infrastructure.

New const **`SUBCATEGORIES_BY_CATEGORY`** alongside the type — `Record<MarketplaceListingCategory, string[]>` with the catalog from the design doc:

- `vinyl` → `7"` `10"` `12"` `LP` `EP` `Single` `Compilation` `Box Set` `Picture Disc` `Coloured`
- `cassette` → `Album` `EP` `Mixtape` `Bootleg`
- `cd` → `Album` `EP` `Single` `Compilation` `Box Set`
- `synth` → `Analog` `Digital` `Modular` `Module` `Software`
- `drum-machine` → `Analog` `Digital` `Sampler` `Hybrid`
- `turntable` → `Direct Drive` `Belt Drive` `Cartridge` `Slipmat`
- `mixer` → `2-channel` `4-channel` `Rotary` `Battle` `Club`
- `outboard` → `Effects` `Compressor` `EQ` `Preamp` `Other`
- `merch` → `Camiseta` `Sudadera` `Gorra` `Tote` `Poster` `Otro`
- `other` → `[]` (composer should hide the subcategory field when this is selected)

**Seed migration** ([[mockData]]). All 6 N.A.A.F.I. listings rewritten to the new shape: `images: []` (none had portadas), seeded `subcategory` matching their format (the three `12"` vinyl pressings, the `Album` + `Mixtape` cassettes, the `Camiseta` merch), seeded `tags` (e.g. `["limited", "club-music", "mexico"]` on the Volcán pressing) and seeded `shippingMode` per real-world feel (`both` for vinyl/cassette, `shipping` for the merch tee, `local` for the Debit cassette to exercise that branch). No `embeds` on the seed — that's exposed by Chunk B's composer when partners want to attach a SoundCloud preview.

**Consumer migration** — only two read sites touched the old `imageUrl`:

- [[MarketplaceListingCard]] reads `listing.images[0]` for the public card hero, falling back to the same category placeholder as before. Comment refreshed to point at the composer drag-drop landing in Chunk B.
- [[MiPartnerSection]] inline editor — the single `IMAGEN URL` field now writes back as `images: [value]` (or `images: []` when cleared); the draft-creation default seeds `images: []`. v1 still feels identical to a partner editing one URL, but the field is plumbed through the new array shape so Chunk B can swap in the multi-image gallery without another migration.

[[partnerOverrides]] needs no structural change — `MarketplaceListing` is just typed differently; the override map shape and listing CRUD writers carry through unchanged.

### Verified in preview

- `npm run build` clean — 19/19 routes prerender, only the pre-existing `next/image` lint warnings.
- `/marketplace?partner=naafi` overlay mounts: `[data-listing-id]` returns all 6 ids (`mkl-naafi-01..06`); `h3` text matches every original title (Siete Catorce — Volcán, Girl Ultra — Sofía 12", BLAKK — Máquina Negra, N.A.A.F.I. 10 Años Camiseta, Debit — Live Recordings, Tatiana Heuman — Sismograma 12"); category placeholders render in lieu of portadas.
- No console errors after navigation; no runtime type errors.
- Dashboard inline editor unchanged — the IMAGEN URL field reads/writes through `images[0]` transparently; "AGREGAR LISTING" creates a draft with `images: []`.

### Open follow-ups (carry into Chunk B)

- Composer rewrite — drag-drop multi-image gallery (data URLs in `partnerOverrides`), tags chip input, shipping-mode 3-card radio, character counters, three-view live preview pane, paginated table with duplicate/delete-red.
- Composer to hide subcategory field when `category === 'other'` (catalog is `[]`).

---

## 2026-04-30 · INGEST · Marketplace v2 plan — composer rewrite + listing detail

Session ran out of context after Iker reviewed v1 and shared a richer composer mockup. Two pain points flagged:

1. **Listings are barebones on the public side** — no detail surface beyond the catalog tile, no embed support.
2. **Composer is too thin on the dashboard side** — current inline editor has title / category / condition / price / status / image-URL / description. Iker's mockup adds: subcategory pair, multi-image with portada + reorder, character counters on title (80) + description (1000), tags chip input, shipping-mode 3-card radio, three-view live preview pane, proper listings table with sort/paginate/duplicate/delete actions.

Locked design calls before context ended:

- Public listing detail = **sub-overlay** (not expand-in-place). URL pattern `?partner=<slug>&listing=<id>`.
- Image upload = **drag-drop AND URL fallback**, matching the existing dashboard-form `ImageUrlField` idiom (data URLs in sessionStorage via partner override).

Three chunks laid out in [[Marketplace]] § "Planned refinement":

- **Chunk A** — type extensions: `images: string[]` (replaces `imageUrl?`), `subcategory?`, `tags?: string[]`, `shippingMode?: 'shipping' | 'local' | 'both'`, `embeds?: MixEmbed[]`. Migrate 6 N.A.A.F.I. seed listings. Add `SUBCATEGORIES_BY_CATEGORY` const (vinyl gets 7"/10"/12"/LP/EP/Single/Compilation/Box Set/Picture Disc/Coloured; cassette gets Album/EP/Mixtape/Bootleg; etc.).
- **Chunk B** — rewrite [[MiPartnerSection]] composer to 3-zone layout: `ListingComposer` (left, full mockup), `ListingPreview` (right, 3 view modes — destacada / grid / lista), `ListingsTable` (bottom, with sort + paginate at 5/page + duplicate + delete-red).
- **Chunk C** — sub-overlay listing detail from [[MarketplaceOverlay]]. Image gallery, full description, embeds via existing [[Embed Primitive]], tags, shipping line, vendor link back to partner.

Suggested order: A → B → C. Foundation first, then visual centerpiece, then read-loop closure.

[[Next Session]] is the entry point for the next session — has auth shortcuts and smoke-test paths.

---

## 2026-04-30 · INGEST · Marketplace — partner-only commerce, dedicated route

Built the marketplace system end-to-end across four chunks: data + storage + permissions + seed; admin approval surface; partner-team dashboard; public surfaces. See [[Marketplace]] for the full design rationale.

**Identity model — no new role tier.** Per Iker's call: roles stay `user` / `curator` / `guide` / `insider` / `admin`. Partner-team membership is a new `partnerId?: string` field on User (references a partner ContentItem.id), and an in-team admin flag `partnerAdmin?: boolean` (only meaningful when `partnerId` is set). Mirrors the `isMod` / `isOG` flag pattern from [[Roles and Ranks]]. Capability matrix:

- Site `admin` → can approve any partner, manage any team, edit any marketplace card.
- `partnerAdmin: true` (in-team) → can add/kick team members of *their own* partner only.
- Regular team member (`partnerId` set) → can edit marketplace card + listings; cannot manage team.
- Outside the team → read-only via `/marketplace`.

**Types** ([[types]]). New `MarketplaceListing` (id / title / category / price / condition / status / image? / description? / publishedAt) with three string-union helpers (`MarketplaceListingCategory` × 10, `MarketplaceListingCondition` × 7, `MarketplaceListingStatus` = available/reserved/sold). ContentItem extended with `marketplaceEnabled` / `marketplaceDescription` / `marketplaceLocation` / `marketplaceCurrency` / `marketplaceListings`.

**Storage** ([[partnerOverrides]]). New `lib/partnerOverrides.ts` mirroring [[userOverrides]] — sessionStorage `gradiente:partner-overrides` keyed by partner id. Generic `setPartnerOverride` / `clearPartnerOverride` plus convenience listing CRUD: `addMarketplaceListing` / `updateMarketplaceListing` / `removeMarketplaceListing` / `setMarketplaceEnabled`. Hooks: `useResolvedPartner(id)`, `useResolvedPartners()`, `useMarketplaceEnabledPartners()` — all synchronous-per-render with tick-state listeners (matching the auth-flicker fix). [[userOverrides]] extended with `partnerId?: string | null` (null = explicit clear) and `partnerAdmin?: boolean`.

**Permissions** ([[permissions]]). Three new helpers:

- `canApprovePartner(user)` — admin-only; toggles `marketplaceEnabled`.
- `canManagePartner(user, partnerId)` — admin OR `user.partnerId === partnerId`. Edits the marketplace card + listings.
- `canManagePartnerTeam(user, partnerId)` — admin OR (`user.partnerId === partnerId && user.partnerAdmin`). Adds/kicks team members.

**Seed data**. N.A.A.F.I. (`pa-naafi`) marketplace pre-enabled with 6 listings spanning all three statuses (`available`, `reserved`, `sold`) and 3 categories (vinyl, cassette, merch) plus description / location / currency / listing count. `loma_grave` set as `partnerId: pa-naafi` + `partnerAdmin: true` (team manager); `yagual` set as `partnerId: pa-naafi` (regular team member). Lets every gating path be exercised without a single admin action.

**Admin approval surface** (chunk 2):

- [[PermisosSection]] user editor — added a `PARTNER · TEAM` block with a partner dropdown (with `· MKT` suffix on enabled partners) + a `PARTNER · ADMIN` toggle (disabled when no partnerId).
- [[PartnerApprovalsSection]] — new admin-only ExplorerSection. Searchable list of every partner with a `MARKETPLACE OFF/ON` chip + a per-row toggle (ToggleLeft/Right icon flips color and writes via `setMarketplaceEnabled`). Sidebar entry titled `Marketplace` (Lock icon → ShoppingBag).

**Partner-team dashboard** (chunk 3) — [[MiPartnerSection]]:

- Mounts when `currentUser.partnerId` is set. Sidebar row uses the partner's title.
- Two-tab switcher (MARKETPLACE default / EQUIPO).
- **Marketplace tab** — card meta editor (description / location / currency, disabled for non-managers) + listings grid with compact summary rows. `EDITAR` toggles inline editor per listing (title / category select / condition select / price number / status select / image url / description). `+ AGREGAR LISTING` creates a draft and auto-opens its editor. `BORRAR` removes (with sys-red border).
- **Equipo tab** — current team list with per-row promote/demote/kick affordances (gated by `canManagePartnerTeam`). Search-picker `AGREGAR · MIEMBRO` filters off-team users; click adds with `partnerId` set. Read-only notice for regular members.
- Marketplace-disabled banner at top when `marketplaceEnabled === false` — team can prep content while waiting for approval.

**Public surfaces** (chunk 4):

- [[MarketplaceCatalog]] — `/marketplace` body. Grid sorted by listing count desc, alphabetic tiebreaker. URL-driven overlay open via `?partner=<slug>`.
- [[MarketplaceCard]] — partner tile in the catalog. Image-forward with stats footer (ITEMS / DISPONIBLES / ZONA).
- [[MarketplaceOverlay]] — full-screen reader matching Iker's reference screenshot. Identity panel (★ MARKET chip + partner name in massive Syne + description + total/available/reserved/sold stats + location/currency/web + helper note). Listings grid sorted by `publishedAt` desc.
- [[MarketplaceListingCard]] — single listing tile. Numbered corner badge (01..N), image (or category placeholder), title + category line, price in vibe-orange, meta rows (CONDICIÓN / VENDEDOR / PUBLICADO), status pill at bottom (color-coded with dot).
- [[MarketplaceRail]] — home-page entry below [[PartnersRail]]. `//MARKETPLACE` strip, up to 3 partner thumbnails (smaller than catalog cards, link to `?partner=<slug>`), `EXPLORAR MARKETPLACE →` orange-bordered CTA linking to `/marketplace`. Per Iker: Spanish UI keeps "marketplace" as the loanword.
- [[Navigation]] — added `08 MARKETPLACE` link, between `07 FORO` and the auth badge.
- New route file `app/marketplace/page.tsx` wraps `MarketplaceCatalog` in Suspense for static export.
- New `ExplorerSection` values: `permisos`, `aprobaciones-mkt`, `mi-partner`. URL guards in the dashboard page route admin-only sections to home for non-admins, and the partner-only section to home for non-team users. `hideDetails` extended to drop the right pane on all three.

### Verified in preview

- `/` (any auth) → home shows the existing partners rail plus a new `//MARKETPLACE 01 ACTIVOS` strip below it with N.A.A.F.I. thumbnail + `EXPLORAR MARKETPLACE →` CTA.
- Top nav `08 MARKETPLACE` lands on `/marketplace`. Catalog grid renders 1 partner card with N.A.A.F.I. (6 ITEMS, 04 DISPONIBLES, ZONA CDMX, MX).
- Click N.A.A.F.I. tile → URL becomes `/marketplace/?partner=naafi`. Overlay mounts: identity panel (description, totals 06 / 04 / 01 / 01, ubicación CDMX MX, moneda MXN, web naafi.net) + listings grid with all 6 listings (Siete Catorce — Volcán $450 NM AVAILABLE; Girl Ultra — Sofía 12" $520 NEW AVAILABLE; BLAKK — Máquina Negra cassette $250 NEW AVAILABLE; N.A.A.F.I. 10 Años Camiseta merch $380 NEW RESERVED yellow; Debit — Live Recordings cassette $200 VG+ SOLD grey; Tatiana Heuman — Sismograma 12" $420 VG+ AVAILABLE).
- ESC / `[× CERRAR]` strips `?partner=` and returns to catalog.
- Login as `@datavismo-cmyk` (admin) → sidebar gains `Permisos` and `Marketplace` rows. `Marketplace` shows all partners with toggle chips; clicking a row's toggle flips the `MARKETPLACE OFF/ON` state live (storage write in `gradiente:partner-overrides`). `Permisos` user editor shows the new `PARTNER · TEAM` block with the dropdown.
- Login as `@loma_grave` → sidebar gains `N.A.A.F.I.` row (named after her partner). MiPartnerSection mounts with both tabs visible. EQUIPO shows herself (TÚ + ADMIN chip) and yagual; she can promote/demote and kick. MARKETPLACE shows all 6 listings + the description editor.
- Login as `@yagual` → same `N.A.A.F.I.` row but EQUIPO is read-only with the explanation. MARKETPLACE editor lets her edit listings + meta but not team.
- `npm run build` passes; `/marketplace` prerenders cleanly. Lint warnings unchanged (pre-existing `next/image`).

### Open follow-ups (tagged in [[Marketplace]])

- **Per-listing `sellerId`.** The reference screenshot shows different vendor names per item; today the listing card shows the partner name uniformly. Add an optional field + dashboard team-member dropdown.
- **Listing detail expansion.** Clicking a listing in the public catalog overlay does nothing yet. Sub-overlay or in-place expand for the description / contact / image-zoom.
- **Status transition / reservation flow.** Manual flips today; real-backend phase will need timeouts + buyer signals.
- **Filter chips inside the overlay.** Reference screenshot shows `/ VINYL`, `/ CASSETTE`, etc. Easy follow-up.
- **Listing image upload.** Currently a free-text URL. Use the same drag-drop idiom as [[Dashboard Forms]].

---

## 2026-04-30 · INGEST · Polls — attachment model, card-as-canvas, anonymous-until-vote

Shipped the polls system end-to-end: types + storage + card affordance + overlay section + dashboard authoring. See [[Polls As Attachments]] for the full design rationale.

**Model — attachment, not a content type** ([[types]]). Polls live as an optional `poll?: PollAttachment` on `ContentItem`. The `kind` field — `from-list` / `from-tracklist` / `attendance` / `freeform` — controls how choices are resolved per parent type. Embedding on the parent keeps it the source of truth: edit a listicle's tracks and the poll's choices update automatically.

**Storage** ([[polls]]). New `lib/polls.ts` mirrors the listener idiom from [[comments]] / [[foro]] / [[userOverrides]]. SessionStorage shape `gradiente:polls = { votes: { [pollId]: { [userId]: PollVote } } }` — only votes are session-scoped; poll definitions ride with the parent. Writers: `castVote(pollId, userId, choiceIds)` (replaces on revote), `clearVote` (re-anonymize, not exposed yet). Hooks: `useUserVote(pollId, userId)`, `usePollResults(pollId, choices)`. `resolvePollChoices(item, poll)` is the per-type variant resolver — derives choices from the parent for non-freeform kinds, returns `poll.choices` verbatim for freeform.

**Card-as-canvas** ([[PollCardCanvas]]). The visual challenge — how to surface a poll on a card without competing with the image or breaking mosaic heights. Solution: when the parent has a poll, the card renders one small chip in a corner of the image. Click → the canvas takes over `absolute inset-0` of the image area. Image dims under a black scrim; choices stack on top; vote casts; rows flip to vibe-colored result bars. ESC / click-outside / close button restores the image. The card chrome (title, badges, save mark) stays put — the canvas borrows the image's real estate, never the chrome. Mosaic grid never reflows.

Per-kind chip copy: `?VOTAR · FAV` (listicle), `?VOTAR · TRACK` (mix), `?VAS?` (evento attendance), `?VOTAR` (freeform). After voting → `✓VOTASTE` (sys-orange). After close → `CERRADA`.

**Overlay section** ([[PollSection]]). Sibling component, same data + same anonymous-until-vote gate, laid out as a permanent section inside the parent overlay. Mounted in [[ListicleOverlay]] (between body and `//SIGUIENTES·LISTAS`), [[MixOverlay]] (between tracklist and hotkeys footer), [[EventoOverlay]] (between artists/genres and tickets CTA), [[ReaderOverlay]] (between body and sticky footer), [[ArticuloOverlay]] (between body+footnotes and `//SIGUIENTES·LECTURAS`). Each renders `{item.poll && <PollSection ... />}` so polls only appear when the parent has one.

**Anonymous-until-vote.** Aggregate counts hidden behind `useUserVote(...) !== null`. Closed polls (past `closesAt`) reveal results unconditionally — the gate is for active polls. Carve-out from [[No Algorithm]] / [[Size and Position as Only Signals]]: the rules forbid engagement metrics on the *content surface*; poll counts on the *poll itself* are fine. Counts never affect feed ordering, card size, or curation.

**Authoring** ([[PollFieldset]] + [[Dashboard Forms]]). New shared component dropped into all 8 compose forms (`MixForm`, `ListicleForm`, `ArticuloForm`, `EventoForm`, `ReviewForm`, `EditorialForm`, `OpinionForm`, `NoticiaForm`). One `+ INCLUIR ENCUESTA` toggle to opt in; opens an editor panel with prompt + (for freeform only) choices list + close-date + multi-choice toggle. Editors don't pick the kind — it's auto-derived from the parent's content type. For listicle/mix/evento the choices auto-derive from the parent so the editor just authors the prompt; for noticia/review/editorial/opinion/articulo the editor authors choices manually.

**Seeded mock polls** in [[mockData]] — one per kind:

- `li-hard-techno-cdmx-2026` — `from-list`, "Tu favorito?" (5 tracks)
- `mx-001` — `from-tracklist`, "Mejor track del set?" (5 tracks)
- `ev-fascinoma-2026` — `attendance`, "Vas a FASCiNOMA?" + `closesAt`
- `no-001` — `freeform`, "Headliner que más quieres ver?" + 5 hand-authored choices

### Verified in preview

- Home grid: 4 poll chips render with correct per-kind labels (`VOTAR · FAV`, `VOTAR · TRACK`, `VOTAR`, `VAS?`).
- Click chip on listicle → canvas opens with 5 auto-derived track choices, prompt "Tu favorito?", reveal-after-vote copy. Vote → results show Phase Fatale 100% (1/1), others 0%, "1 VOTO" footer. Close → chip flips to `✓VOTASTE` (sys-orange).
- Open evento overlay (`?item=fascinoma-2026-cdmx-outdoor`) → PollSection renders with 3 attendance choices. Vote VOY → storage records `voy`, UI shows VOY 100% (1).
- Open NoticiaForm in dashboard → Section "05 ENCUESTA (opcional)" with `+ INCLUIR ENCUESTA`. Click → editor surface with `//ENCUESTA · LIBRE` header, prompt input, choices editor with `+ AGREGAR OPCIÓN`, close-date input, voto-múltiple checkbox.
- `npm run build` clean across all 8 form changes + 5 overlay changes + 2 card changes.

### Open follow-ups

- **Multi-vote UI** — `multiChoice: true` polls let a user pick multiple options, but the card canvas + overlay section only handle the click-once flow. Need: checkbox-style choice rows + an explicit `CONFIRMAR VOTO` button. Not exposed via the seed polls (none use multiChoice yet).
- **Close-date countdown** — closed polls render `CERRADA` chip + reveal results, but there's no "cierra en 3h" preview while open. Cosmetic; minor.
- **Vote-undo affordance** — `clearVote` exists but no UI consumer. Could surface as a small "QUITAR VOTO" link inside the canvas/section for already-voted users.

Next chunk per Iker's plan: marketplace surfaces (partner-only feed at its own slug below the partners rail).

---

## 2026-04-30 · INGEST · Loose-end pass — auth-overrides, tombstone revert, empty-Nuevo polish

Closed the three small follow-ups left after the role/permissions arc.

**Auth resolves through overrides** ([[useAuth]]). Refactored `AuthProvider` to hold `userId: string | null` in state; the exposed `currentUser` is now `useResolvedUser(userId)` from [[userOverrides]]. Admin self-edits (and any cross-edit that targets the logged-in user) propagate to every consumer that reads `currentUser` — sidebar `Permisos` row, `canModerate` gates, foro mod buttons, dashboard `Permisos` URL guard — without a page reload. Credential resolution still hits the seed (`MOCK_USERS`) so identity fields can't be unlocked by editing a role override. **Side fix:** rewrote `useResolvedUser` to compute synchronously per render (was effect-driven). The previous shape lagged one render between a `userId` change and the resolved value, which briefly dropped `currentUser` to null and flickered the [[LoginOverlay]] open on first dashboard render. Now uses a tick-state pattern: subscribe via effect to bump a counter; the value itself is derived synchronously from `getResolvedUserById(id)`.

**Tombstone revert.** Two new writers, both gated by the same role rules as the corresponding deletes:

- `clearTombstone(postId)` in [[foro]] — drops the deletion record so the post reappears (catalog re-includes the thread; reply body restores). One writer for both kinds since `tombstones` is keyed by post id, not type.
- `clearCommentDeletion(commentId)` in [[comments]] — handles both storage paths (drops `deletionOverrides[id]` for mock comments, or clears the `deletion` field on session-added comments).

UI affordance — orange `RESTAURAR` chip (RotateCcw icon) inline with the tombstone heading on each surface:

- Foro Tombstone: visible to `canModerate(currentUser)` (mods + admins).
- Comment Tombstone: visible to `canModerate` OR `deletion.moderatorId === currentUser.id`. The broader gate gives an author an undo for an accidental self-delete without exposing the affordance to anyone else.

**Empty-Nuevo polish.** Added one condition to the dashboard's `hideDetails`: `(section === 'nuevo' && allowedTypes.length === 0)`. The right details panel now drops out of the user-tier empty Nuevo view — there's nothing to bind a SelectionMeta to since no template can be selected. Pure cosmetic, but cleans up the layout for the user-tier case.

### Verified in preview

- Logged in as `u-datavismo` (admin), open Permisos, click `tlali.fm` row, click `LECTOR` role button → list row updates live to `DETONADOR @tlali.fm EDITADO ›` (rank derives from her !/? reactions; EDITADO chip flips on).
- Switch auth to `u-insider-tlali` (insider seed → user via override). On `/dashboard?section=nuevo` the page renders `▸ 0 plantillas`, the empty state, and **no Permisos sidebar row** — auth flowing through the override layer is what made `canAssignRoles` and `canCreateContent` see the demoted role.
- No flash of LoginOverlay during initial dashboard render. The synchronous `useResolvedUser` removed the one-frame `currentUser=null` window that previously triggered `openLogin`.
- As `u-mod-rumor` on `/foro/?thread=fr-002` (tombstone preset via storage): RESTAURAR chip rendered next to the `//HILO·ELIMINADO·POR·MODERACIÓN` heading. Click → tombstone block gone, composer reappeared (`<textarea>` back), `gradiente:foro.tombstones` is `{}`.
- As mod on `cm-002` tombstone: RESTAURAR chip click → `gradiente:comments.deletionOverrides` is `{}`, comment body restored.
- As `u-normal-meri` (user) on `/dashboard?section=nuevo`: empty state renders full-width; the right details pane is hidden.
- `npm run build` clean across all changes.

### Open follow-ups

The role/permissions arc is now complete. Next chunk per Iker's plan: polls + marketplace surfaces (consumers for `canCreatePoll` / `canCreateMarketplaceCard` — the curator role currently gates nothing visible).

---

## 2026-04-30 · INGEST · NGE prompt overlay + comment delete (author + mod)

Two paired requests: replace the browser-chrome `window.prompt()` calls in the foro mod tools with a modal in the project's visual language, and add the missing delete affordance for comments (author self-delete and mod-delete with reason).

**Generic prompt provider** ([[PromptOverlay]]). New `components/prompt/` with `PromptProvider` + `PromptOverlay` + a `usePrompt()` hook that returns Promise-based `confirm(opts)` and `input(opts)` methods. Mounted once at the layout root (between `AuthProvider` and `PublishConfirmProvider`). Two variants:

- `confirm` — title + optional body + CANCELAR / CONFIRMAR. Returns `boolean`. Title strip `//CONFIRMACIÓN·REQUERIDA`.
- `input` — same chrome plus a single text field. Returns `string | null`. Title strip `//ENTRADA·REQUERIDA`. Auto-selects the field on open so the `defaultValue` is replaced by typing. Enter inside the field confirms.

`destructive: true` flips the confirm button color from sys-orange to sys-red. ESC and backdrop click both resolve to cancel. Visual idiom matches [[PublishConfirmOverlay]] — eva-box + scanlines + black backdrop with blur, `role="alertdialog"` with proper `aria-labelledby` / `aria-describedby`.

**Foro migration** ([[ThreadOverlay]]). Replaced both `window.prompt()` calls (`onTombstoneThread` and `onTombstoneReply`) with `usePrompt().input` calls — `destructive: true`, NGE chrome, placeholder `spam · acoso · off-topic · …`, default value `spam`. Identical behavior on confirm/cancel.

**Comment delete** ([[CommentList]] + [[comments]]). The `Comment.deletion` field already existed (consumed by the existing `Tombstone` for seed `cm-009`); what was missing was the writer + UI.

- New `tombstoneComment(commentId, actorId, reason)` writer in [[comments]]. One writer covers both flows. For session-added comments the deletion record lands directly on the record; for mock comments it lands in a new `deletionOverrides: Record<string, CommentDeletion>` map and `applyOverrides` merges it at read time. `getCommentsForItemMerged`, `getAllCommentsMerged`, and `getSavedComments` all route through `applyOverrides` so reactions + deletions stay in sync.
- New `BORRAR` chip in the comment header strip (right-aligned, sys-red border + Trash2 icon). Visible only when `canDelete = !isTombstone && (isOwn || canModerate(currentUser))`. Click branches:
  - **Author** → `usePrompt().confirm({ destructive: true })` (no reason required) → writer with empty reason.
  - **Mod** → `usePrompt().input({ destructive: true })` (reason required) → writer with the trimmed value.
- `Tombstone` component now branches on `deletion.moderatorId === authorId` — renders `//ELIMINADO·POR·AUTOR` (no reason line) for self-delete vs `//ELIMINADO·POR·MODERACIÓN @actor · RAZÓN: …` for mod-delete. [[SavedCommentsSection]]'s tile preview text mirrors the same branch (`[eliminado por autor]` vs `[eliminado · …]`).

### Verified in preview

- `u-mod-rumor` on `?thread=fr-002` → click reply BORRAR → NGE prompt opens with title strip `//ENTRADA·REQUERIDA`, h2 "Borrar respuesta", body description, prefilled `spam`, placeholder copy, CANCELAR + BORRAR buttons. Confirm → `tombstones["fp-002-01"]` written; tombstone block reads `//RESPUESTA·ELIMINADO·POR·MODERACIÓN @rumor.static · RAZÓN: spam`.
- `u-og-loma` on her own seed comment `cm-006` (articulo overlay): click `Borrar mi comentario` → confirm modal opens with title `//CONFIRMACIÓN·REQUERIDA`, h2 "Borrar tu comentario", **no input field** (correct), CANCELAR + BORRAR. Confirm → `deletionOverrides["cm-006"]` written with `moderatorId: 'u-og-loma'`, empty reason; comment body collapses to `//ELIMINADO·POR·AUTOR` with no reason line — the branch correctly hides it because `moderatorId === authorId`.
- `u-mod-rumor` on someone else's comment `cm-002`: click `Borrar comentario` → input prompt opens, default `spam`. Confirm → tombstone reads `//ELIMINADO·POR·MODERACIÓN @rumor.static · RAZÓN: spam`. Branch correctly hits the mod path because `moderatorId !== authorId`.
- `u-og-loma` on someone else's comment: zero `Borrar comentario` buttons (only `Borrar mi comentario` on her own). Defense-in-depth — the storage layer doesn't re-check, but the writer is unreachable from the UI.
- `npm run build` clean, all routes prerender. Lint warnings unchanged (pre-existing `next/image`).

### Open follow-ups (carried over)

- **Mod-revert action.** Tombstones are still one-way (`clearTombstone` not exposed yet).
- **Auth context resolves through overrides** — admin self-edits via [[PermisosSection]] don't reflect until reload.

---

## 2026-04-29 · INGEST · Foro mod tools (tombstones)

Closes the third of the three follow-ups from the role/rank chunk. The foro now has the moderation surface that `canModerate` was waiting for. See [[ThreadOverlay]] / [[foro]].

**Type changes** ([[types]]). New `ForoDeletion { moderatorId, reason, deletedAt }` mirroring `CommentDeletion`. Optional `deletion?: ForoDeletion` added to both `ForoThread` and `ForoReply`.

**Storage** ([[foro]]). New `tombstones: Record<postId, ForoDeletion>` in the session state. Read-time merge applies the override on top of the seed/session record. Two new writers:

- `tombstoneThread(threadId, modId, reason)` — soft-delete. Body preserved in storage so quote-links keep resolving. `getMergedThreads` filters tombstoned threads OUT of the catalog (8→7 tiles after one delete) but `getThreadById` still returns them with `deletion` set, so the URL keeps working and the moderator's reasoning is reachable.
- `tombstoneReply(replyId, modId, reason)` — same shape. Reply position is preserved (article still renders, backlinks still work) but the body is replaced with the moderator stub.

Both writers trust the UI to gate via `canModerate(currentUser)` from [[permissions]] — no re-check at the storage layer. Real backend will enforce in RLS.

**UI** ([[ThreadOverlay]]). `canModerate(currentUser)` flips an `isMod` flag threaded through the article components. When true, each post renders a small red `BORRAR HILO` / `BORRAR` button (Trash2 icon) in the top-right of its header strip. Click → `window.prompt('Razón…')` → tombstone writer.

`Tombstone` component mirrors the [[CommentList]] tombstone — replaces the body with `//HILO·ELIMINADO·POR·MODERACIÓN` or `//RESPUESTA·ELIMINADO·POR·MODERACIÓN` block + `@mod · RAZÓN: …`. Article container, `PostHeader`, and `Backlinks` continue to render normally so quote-IDs and `>>id` navigation still work — pruning is visible in context, not erased.

**Composer closure.** When a thread is tombstoned, the `ReplyComposer` is replaced with `//HILO·CERRADO·POR·MODERACIÓN — no se aceptan respuestas nuevas.` Disables further engagement with a deleted thread.

**Prompt-as-UI.** The reason is collected via `window.prompt()` — intentional cheap UI for the prototype. A real backend would put this behind a structured confirmation modal with a category dropdown. Flagging as a follow-up.

### Verified in preview

- Logged in as `u-mod-rumor` (role: user, isMod: true) on `?thread=fr-001` → 1 `BORRAR HILO` button on the OP + 3 `BORRAR` buttons on the 3 replies.
- Click `BORRAR` on `fp-001-01` with reason `"spam · prueba"` → sessionStorage gets `tombstones["fp-001-01"]`, the article body collapses to `//RESPUESTA·ELIMINADO·POR·MODERACIÓN @rumor.static · RAZÓN: spam · prueba`, the BORRAR button disappears for that reply (remaining BORRAR count: 2).
- Click `BORRAR HILO` with reason `"tema duplicado"` → OP body becomes `//HILO·ELIMINADO·POR·MODERACIÓN`, composer replaced with the closed-thread notice (textarea count: 0).
- Navigate back to `/foro` → catalog shows 7 tiles (was 8); `fr-001` is gone from the list. Direct URL `?thread=fr-001` still loads and shows the tombstone.
- Switch auth to `u-normal-meri` (user-tier, no mod flag) on `?thread=fr-002` → zero `BORRAR` buttons rendered. Defense-in-depth: storage layer doesn't re-check, but the writer is unreachable from the UI.
- `npm run build` clean; 16 routes prerender; lint warnings unchanged.

### Open follow-ups

- **Mod-revert action.** Tombstones are one-way today. A `clearTombstone(id)` writer + admin-only RESTAURAR button would let an over-eager mod's call be reversed. Storage layer is ready (just delete the entry from `tombstones`); UI piece pending.
- **Structured-reason modal.** `window.prompt()` works but breaks the NGE/terminal aesthetic. A category dropdown (`spam` / `off-topic` / `acoso` / `otro`) + freeform line, behind an inline modal, would land closer.
- **Auth context resolves through overrides** — same caveat as the previous chunks. Admin self-edits to `isMod` via [[PermisosSection]] don't flip the foro mod buttons until reload.

---

## 2026-04-29 · INGEST · Dashboard form gating + curator seed user

Closes the second of the three follow-ups from the earlier `Roles, ranks, and the !/? reaction palette` entry — the dashboard compose surface now respects the role tier.

**Permission helper** ([[permissions]]). New `canCreateContent(user, type)` — single per-type gate that maps every `ContentType` to a creation tier:
- `listicle` → curator+ (lists / polls / marketplace are the curator's surface)
- `mix` / `opinion` / `editorial` / `review` / `articulo` / `noticia` / `evento` → guide+
- `partner` → admin only (rail, not in the SUPPORTED set anyway)

`canCreateList` / `canCreatePoll` / `canCreateMarketplaceCard` / `canCreateOpinion` / `canCreateMix` remain as more specific helpers; `canCreateContent` is the generalized switch the dashboard consumes.

**Dashboard wiring** (`app/dashboard/page.tsx`). `allowedTypes = SUPPORTED.filter(t => canCreateContent(currentUser, t))` filters the template grid by capability. Threaded through to [[NuevoSection]] as the new `supported` prop value (was the static SUPPORTED list). Count label shifts to `▸ N plantilla(s)` and reflects the actual visible count per role.

**Compose URL guard**. `composeBlocked = composeType !== null && !canCreateContent(currentUser, composeType)`. A `useEffect` calls `router.replace('/dashboard?section=nuevo')` when the requested compose type isn't allowed — covers URL-typing `?type=mix&edit=…` as a non-guide. The form render condition becomes `if (composeType && !composeBlocked)` so there's no flash of the form before the redirect lands.

**Empty state in NuevoSection**. When `supported.length === 0` (a `user`-tier viewer with no creation rights), the grid is replaced with a `//SIN·PLANTILLAS·DISPONIBLES` block + explanation copy + a pointer at the admin's `Permisos` surface ("if you should have access, ask an admin to adjust your role"). Reads as a permissions explanation, not a "coming soon" tease.

**Curator seed user**. Added `u-curator-radiolopez` (`radiolopez` / display `radio lopez`) to [[mockUsers]] for full role coverage. Without it, the new `canCreateContent` curator path had no integration-test path — every other seed user was admin / guide / insider / user. radiolopez sees exactly `LISTA` in the template grid and otherwise behaves like the rest.

### Verified in preview

- Logged in as `u-datavismo` (admin) → 8 templates rendered, count label `▸ 8 plantillas`.
- `u-hzamorate` (guide) → 8 templates (curator-tier listicle inherited + 7 guide-tier types).
- `u-curator-radiolopez` (curator) → 1 template (`LISTA`), count label `▸ 1 plantilla`.
- `u-normal-meri` (user) → 0 templates, empty state with `//SIN·PLANTILLAS·DISPONIBLES` + the role explanation copy.
- URL guard: `u-normal-meri` typing `/dashboard?section=nuevo&type=mix` → instant redirect to `/dashboard?section=nuevo`, empty state renders. No form flash.
- `npm run build` clean; 16 routes prerender; lint warnings unchanged.

### Open follow-ups (carried over)

- **Foro mod tools** — `canModerate` exists; [[ThreadOverlay]] still has no delete-thread / tombstone-reply affordance.
- **Auth context resolves through overrides** — admin self-edits via [[PermisosSection]] don't reflect in the dashboard's own gates (which read `currentUser` from [[useAuth]]) until reload. Small follow-up; affects only self-edits.
- **`hideDetails` for nuevo when empty** — when the empty state renders, the right details panel is still visible. Cosmetic; could conditionally hide.

---

## 2026-04-29 · INGEST · Admin role-assignment surface (PermisosSection)

Closes the first of the three follow-ups flagged at the bottom of the earlier `Roles, ranks, and the !/? reaction palette` entry. The admin surface that the rank/role design implied now exists end-to-end. See [[PermisosSection]] / [[userOverrides]].

**Storage layer** ([[userOverrides]]). New module `lib/userOverrides.ts` modelled after [[comments]]: `gradiente:user-overrides` sessionStorage shape `Record<userId, { role?, isMod?, isOG? }>`. Identity fields (id / username / displayName / joinedAt) are immutable. Listener pattern via in-module `Set<() => void>`; every write fires `notify()`. Hooks: `useResolvedUser(id)` returns the live override-applied User (replaces `getUserById` in badge consumers), `useResolvedUsers()` returns the full live roster, `useHasOverride(id)` powers the `EDITADO` chip. Noop-collapse: a patch that leaves a user matching their seed exactly drops the entry from the map rather than persisting `{}`.

**UI** ([[PermisosSection]]). New dashboard section at `/dashboard?section=permisos`. Two-pane layout — searchable user list + per-user editor. Editor surfaces a read-only identity block, a five-button role grid (LECTOR / CURADOR / GUÍA / INSIDER / ADMIN), MOD and OG flag switches, and a self-edit warning when the admin selects themselves. **Self-demote guard** — when editing yourself, every non-admin role button is disabled. UI-layer only; the storage layer doesn't enforce it (a deliberate caller could still write the patch directly). Real backend will enforce in RLS. **Commit-on-click** — no draft/save dance; every change is a single `setUserOverride` call. `RESTAURAR` button (visible only when an override exists) clears it via `clearUserOverride`.

**Sidebar gate** ([[ExplorerSidebar]]). The `Permisos` row (Lock icon) renders only when `canAssignRoles(currentUser)` is true. Non-admins never see it.

**URL gate** (`app/dashboard/page.tsx`). Defense-in-depth: a non-admin URL-typing `?section=permisos` falls back to `home`. The check happens at section-resolution time, so the breadcrumb / window title / hideDetails all reflect the home path.

**Live propagation**. Migrated [[CommentList]], [[PostHeader]], [[SavedCommentsSection]] from `getUserById` to `useResolvedUser`. Edits in the admin surface propagate to comment columns and foro posts in real time without a page reload.

**Notable non-changes**:
- `useAuth.currentUser` still returns the seed user — not override-resolved. Means `AuthBadge` and dashboard chrome don't reflect *self-edits* until reload. Acceptable for prototype; rare edge case (admin editing isMod/isOG on themselves), and the rest of the app DOES update live.
- [[LoginOverlay]]'s quick-switch picker still calls `listUsers()` (seed). The picker is a credential entry point, not a live status display, so showing pre-override values is fine.
- ThreadTile uses `getUserById(thread.authorId)` only for `displayName` (no badge rendering), so it didn't need migration.

### Verified in preview

- As `u-datavismo` (admin): sidebar shows `Permisos` row. Section renders 8 user rows with correct primary chips + flag chips (`ADMIN @datavismo-cmyk`, `GUÍA @hzamorate`, `GUÍA @ikerio`, `NORMIE + MOD @rumor.static`, `ESPECTRO + OG @loma_grave`, `INSIDER @tlali.fm`, `ESPECTRO @merimekko`, `ESPECTRO @yagual`). Editor shows identity block + role grid + flag switches + self-edit banner.
- Click `@loma_grave` row → editor switches to her. Click `GUÍA` button → sessionStorage `gradiente:user-overrides` becomes `{"u-og-loma":{"role":"guide"}}`, list row updates to `GUÍA + OG @loma_grave EDITADO ›`.
- Open the comment column on `?item=festivales-latam-presion-europea-2026` → loma_grave's comment header now reads `@loma_grave GUÍA OG · hace 7 días` (was `ESPECTRO OG` before the override). Live propagation confirmed.
- Switch auth to `u-hzamorate` (guide) and visit `/dashboard?section=permisos` → sidebar shows no `Permisos` row, URL silently falls back to the home Dashboard view.
- `npm run build` clean, all 16 routes prerender. Lint warnings unchanged (pre-existing `next/image` only).

### Open follow-ups (carried over)

- **Dashboard form gating** — [[Dashboard Forms]] still lets any logged-in user reach every compose form. Wire `canCreateOpinion` / `canCreateMix` (guide+) and `canCreateList` / `canCreatePoll` / `canCreateMarketplaceCard` (curator+) into [[NuevoSection]] and the per-type forms.
- **Foro mod tools** — `canModerate` exists; [[ThreadOverlay]] still has no delete-thread / tombstone-reply affordance.
- **Auth context resolves through overrides** — small follow-up so admin self-edits update AuthBadge without reload.

---

## 2026-04-29 · INGEST · Roles, ranks, and the !/? reaction palette

Locked in the new identity model end-to-end. Three orthogonal axes per user — see [[Roles and Ranks]] for the full design.

**Role axis** — hierarchical creation tier with one sibling pair: `user (0) < curator (1) < {guide, insider} (2) < admin (3)`. `guide` and `insider` share rank 2 with equivalent publishing rights (opinion / mixes); they differ only in *byline framing* — guide is staff editorial voice, insider is scene voice (DJs, promoters, venue folks). The old `collaborator` was rolled into `guide`; `moderator` was split off into a flag (see below).

**Flag axis** — `isMod: boolean` (pruning capability — delete comments / threads, admins implicit) and `isOG: boolean` (cosmetic first-wave-registrant badge). Orthogonal to role; a `user`-tier `isMod` is a regular reader the team trusts to prune, separate from publishing trust.

**Rank axis** — derived on read from received !/? reactions (`user` tier only). NORMIE (floor) → DETONADOR (!-dominant) | ENIGMA (?-dominant) | ESPECTRO (balanced + active). Threshold currently 5 received reactions before leaving NORMIE; bucket boundaries at ≥65% / ≤35% signal-ratio. Pure derivation in [[permissions]] (`rankFromCounts` / `getUserRank`); live React-side hook `useUserRank(userId)` in [[comments]] reads `getAllCommentsMerged()` and re-renders on any reaction toggle.

**Reaction palette** — dropped `+` (resonates) and `−` (disagree). Kept only `!` (signal) and `?` (provocative) — both abstract enough to mean many things, neither reducible to "I like / I don't like." Mutual exclusivity per (user, comment): `toggleReaction` in [[comments]] now *replaces* a user's prior reaction when they pick the other kind, *clears* it when they click the same kind. Seed reactions in [[mockComments]] hand-migrated to the new palette, preserving the controversy hot-spot on `cm-006` (mix of !/? from different users).

**Why ranks aren't an "algorithm".** [[No Algorithm]] forbids engagement-driven *content surfacing* — what gets shown and at what size. Ranks label *people*, not content. They don't affect feed ordering, comment ordering, foro bump-order, or visibility. Added a carve-out section to the No Algorithm decision doc clarifying the line: labels on people OK, weights on content not OK.

**Type system rewrite** ([[types]]):
- `Role` — new union (`'user' | 'curator' | 'guide' | 'insider' | 'admin'`).
- `UserRank` — new union; not stored on User, derived.
- `User` — `userCategory` removed. Replaced by `isMod?`, `isOG?` flags. The old `og` / `insider` / `normal` triple split three ways: og became the flag, insider became a sibling role, normal became "no flag, rank derives."
- `ReactionKind` — pruned to `'provocative' | 'signal'`.

**Permissions module rewrite** ([[permissions]]):
- `hasRole(user, atLeast)` retained, with insider/guide sharing tier 2 so `hasRole(insider, 'guide')` returns true.
- New per-content-type gates: `canCreateList` / `canCreatePoll` / `canCreateMarketplaceCard` (curator+), `canCreateOpinion` / `canCreateMix` (guide+).
- `canModerate` checks `isMod || role === 'admin'`. `canModerateComment` wraps it.
- `canEditContent` / `canDeleteContent` admin-or-author. Author still matched by username — switch to authorId post-Supabase.
- `RANK_THRESHOLD = 5` exported so the gate is tweakable.

**Mock roster migration** ([[mockUsers]]):
- `hzamorate` / `ikerio` collaborator → guide.
- `rumor.static` moderator → user + isMod.
- `loma_grave` user/og → user + isOG.
- `tlali.fm` user/insider → role: insider (promoted to creation tier).
- `merimekko` / `yagual` user/normal → user (rank derives).
- New label/color maps: ROLE_LABEL/ROLE_COLOR, RANK_LABEL/RANK_COLOR, FLAG_LABEL/FLAG_COLOR. New helpers `badgeFor(user, rank)` returns `{label, color}` (was a string), `flagsFor(user)` returns the ordered flag list.

**UI rewiring**:
- [[CommentList]]: replaced `RoleBadge` with `AuthorBadges` — primary chip (role for staff, derived rank for users) + sibling flag chips. Reaction palette pruned to `[?]` / `[!]`. Reaction button code unchanged; the store-level mutual exclusivity makes click-the-other-kind feel like a single transition (see verification below).
- [[PostHeader]]: same badge stack as `AuthorBadges`. Removed the unused `inlineRoleLabel` / `inlineRoleColor` exports (no consumers).
- [[SavedCommentsSection]]: comment-tile badge now uses `badgeFor(user, useUserRank(authorId)).label`. Flag chips intentionally kept off the tile to keep it scannable.
- [[LoginOverlay]]: quick-switch picker badge updated to read `badgeFor(u).label` (was a bare string under the old API).

**Beta sign-up** — the model intentionally doesn't address public sign-up. The plan is invite-only beta when real auth lands. `useAuth.tsx` still resolves logins against MOCK_USERS; the invite-token gate goes in front of registration when [[Supabase Migration]] starts.

**Marketplace + polls** — deferred. The `curator` role gates `canCreatePoll` and `canCreateMarketplaceCard` already; no UI surface yet. Both can ship later without touching the role model.

### Verified in preview

- Logged in as datavismo (admin) on `?item=festivales-latam-presion-europea-2026`, opened the comment column. Sample badges rendered:
  - `@datavismo-cmyk` → `ADMIN` (orange) + `[TÚ]`
  - `@hzamorate` → `GUÍA` (green)
  - `@loma_grave` → `ESPECTRO` + `OG` (amber) — balanced rank + cosmetic flag
  - `@merimekko` → `ESPECTRO`
- Reaction palette: only `[?]` and `[!]` buttons render. No `[+]` or `[−]` anywhere.
- Mutual exclusivity: clicked `[!]` on `cm-006` (where datavismo has `?` in the seed) — `?` count went 3→2 with aria-pressed false, `!` count went 2→3 with aria-pressed true. Clicked `[!]` again — count went 3→2 with both buttons aria-pressed=false (cleared).
- Foro `?thread=fr-005` (rumor.static's recordatorio thread): `@rumor.static` rendered as `NORMIE` (grey) + `MOD` (red) — confirms user-tier rank chip + orthogonal mod flag chip together. `@datavismo-cmyk` reply rendered as `ADMIN`. `[TÚ]` marker on datavismo (logged-in viewer).
- `npm run build` passes — 16 routes prerendered as static content. Lint clean (only pre-existing `next/image` warnings, none touching files I edited).

### Open follow-ups

- **Admin role-assignment UI.** `canAssignRoles` exists; no surface consumes it yet. Plan: hidden dashboard section visible only when `canAssignRoles(currentUser)`, search by username, edit `role` / `isMod` / `isOG`. Rank stays derived (not assignable).
- **Per-type dashboard form gating.** [[Dashboard Forms]] currently lets any logged-in user reach every compose form. The new permission gates need wiring: opinion/mix forms behind `canCreateOpinion`/`canCreateMix`, future poll/marketplace forms behind their respective gates. Admin can author anything.
- **Foro thread/reply moderation surface.** `canModerate` exists; no foro mod tools yet (delete thread, tombstone reply). The wiki notes this gap was already deferred from the foro INGEST.
- **`User.role === 'user'` everywhere as the badge fallback** when `useUserRank` returns 'normie' for a user who literally has no comments. Currently shows `NORMIE` which is honest; no action needed but worth flagging if the badge should suppress until first comment.

---

## 2026-04-26 · INGEST · Audio reactive subsystem

Built end-to-end: persistent global SoundCloud playback that survives overlay close, three.js waterfall spectrogram visualizer reacting to live tab audio, and integration into [[MixOverlay]] + the home rail. New mix entry `mx-goodies-igtt` (lo-fi house, vibe 3) added to [[mockData]] as the canonical test track.

**Stack.** New components under `components/audio/`:

- `audioContext.ts` — shared lazy `AudioContext` singleton, FFT size constants.
- `Reproductor3D.tsx` — three.js wireframe waterfall spectrogram. Joy-division-plot proportions (48 cols × 80 rows), per-band envelopes (LOW punchy, MID flowy, HIGH spike), soft noise gate, vibe-gradient colors keyed to a mix of rolling track energy + per-cell magnitude + frequency stratification. Has `orientation: 'landscape' | 'portrait'` and `interactive: boolean` props. Portrait rolls the camera 90° via `up = (1, 0, 0)`.
- `useAudioElementAnalyser.ts` — file-picker source (used by `/lab/audio`).
- `useTabAudioCapture.ts` — `getDisplayMedia({ audio: true, preferCurrentTab: true })`. The only path to FFT data from cross-origin SC/YT iframes; Chromium-only by browser policy. See memory `reference_get_display_media`.
- `useSoundCloudWidget.ts` — wraps SoundCloud's Widget JS API (`https://w.soundcloud.com/player/api.js`). Returns the platform-agnostic `EmbedWidget` shape from `types.ts` (`play / pause / toggle / seek / load / isPlaying / currentTime / duration / track`). YT/Mixcloud/Spotify are pending implementations of the same interface; Bandcamp has no JS widget API and will need a fallback path.
- `AudioPlayerProvider.tsx` — global context at the layout root. Owns one persistent hidden iframe + widget + tab capture for the page lifetime. Track switches happen via `widget.load(url)` (same iframe, no remount), so the user-granted tab-capture permission persists across overlays. `loadAndPlay(item)` lazily requests `getDisplayMedia` on the first play (within the click gesture); subsequent plays don't re-prompt.
- `AudioPlayer3D.tsx` — composite player chrome used inside [[MixOverlay]]. LIVE MATRIX is a passive status pill (the request is folded into the play button).
- `NowPlayingHud.tsx` — persistent sidebar block in [[CategoryRail]]; portrait Reproductor3D + transport. The only audio control visible when no overlay is open.

**MixOverlay** is now a *view* — drops the local iframe + hooks, reads/writes everything via `useAudioPlayer()`. Closing the overlay does NOT stop playback. Opening another mix and pressing play calls `widget.load()` to switch tracks; no permission re-prompt.

**Lab** at `/lab/audio` — standalone test bench. Has its own local widget + tab-capture instance for file-picker testing; doesn't share with the global provider.

**Bug fix landed in this session:** Reproductor3D was using `getBoundingClientRect()` to size its WebGL buffer, which includes ancestor CSS transforms — inside the OverlayShell CRT boot animation, this read as ~140 × 1.6 px and locked the canvas to 1px tall. Switched to `offsetWidth` / `offsetHeight` (layout box, ignores transforms). See memory `feedback_layout_box_in_overlay`.

---

## 2026-04-26 · INGEST · Foro basePath fix for GitHub Pages

User reported foro mock images don't appear on the deployed Pages site (the home grid did, since [[mockData]] already had the fix from commit 12a4b04). Same root cause: GH Pages serves under `/gradiente-fm-web/`, and `<img src="/flyers/...">` doesn't get auto-prefixed by Next.js — only `next/image` and asset imports do. Applied the same `BASE_PATH` prefix pattern to [[mockForo]]: internal `RAW_THREADS` / `RAW_REPLIES` → exported `MOCK_THREADS` / `MOCK_REPLIES` derived via `.map()` that prepends `process.env.NEXT_PUBLIC_BASE_PATH` to any `imageUrl` starting with `/`. Data URLs (user-uploaded session images) pass through untouched.

Verified the inlined `/gradiente-fm-web` literal lands in the foro client chunk under a `GITHUB_ACTIONS=true` build, and that the runtime `.map()` produces the correct prefixed paths. Locally `NEXT_PUBLIC_BASE_PATH` is empty so images still resolve as `/flyers/orbital-omen.jpg`.

---

## 2026-04-26 · INGEST · Foro (imageboard-style discussion)

A new top-level destination at `/foro` — imageboard-style threaded discussion, kept fully isolated from the curated content grid. Threads aren't `ContentItem`s, never enter the home feed, never get HP/curation scoring. See [[Foro]] for the full route doc.

**Catalog rules.** Bump-order desc, hard cap at 30 visible threads (`FORO_THREAD_CAP`). New threads bump to top; new replies bump their parent. No likes, no reactions, no engagement scoring — reply count is the only ranking signal allowed (consistent with [[Size and Position as Only Signals]] / [[No Algorithm]]). The [[VibeSlider]] reappears on /foro and filters threads via genre intersection (`genresIntersectVibeRange` in [[genres]]).

**Thread model.** New `ForoThread` and `ForoReply` types in [[types]]. Threads require `subject`, `body`, `imageUrl` (mandatory on OP), `genres: string[]` (1–5 enforced via `FORO_THREAD_GENRES_MIN/MAX`), `createdAt`, `bumpedAt`. Replies are flat (no nesting), with optional image and `quotedReplyIds: string[]` parsed from `>>id` tokens in the body.

**Storage layer** [[foro]]. `gradiente:foro` sessionStorage with `{ addedThreads, addedReplies, bumpOverrides }`. Mirrors the [[comments]] / [[saves]] idiom — listener-pattern hooks, pure-function writers. `bumpOverrides[mockThreadId] = newBumpedAt` shadows immutable seed thread bumpedAt at read time. `useThreads` / `useThread(id)` / `useReplies(id)` / `useReplyCount(id)` cover the read paths.

**Session id format.** New `newThreadId()` and `newReplyId(threadId)` mirror the mock convention so user-authored ids are visually indistinguishable from seeds in `>>id` quote-tokens. Threads → `fr-s01`, `fr-s02`, … Replies → `fp-{threadShortRef}-s01` (e.g. `fp-003-s05` continues past the 4 mock replies on fr-003). The `s` marker prevents collision if seed numbering is later extended.

**Public-side surfaces:**
- [[ForoCatalog]] — page body. Reads `useThreads()` + `useVibe().vibeRange`, filters via `genresIntersectVibeRange`, mounts the URL-driven thread + compose overlays (`?thread=` / `?compose=`). Empty states differentiate "no threads at all" from "filtered out by vibe".
- [[ThreadTile]] — image-forward tile. R·NN reply-count chip top-left, SESIÓN chip top-right when session-authored, `//FR-XXX` id chip bottom-left. First 2 genres + `+N` overflow chip. Whole tile is a `<Link href="/foro?thread=…">`.
- [[ThreadOverlay]] — modal. Builds `inboundIndex: Map<postId, replyId[]>` for backlinks and `authorByPostId` for the inline-quote `TÚ` marker (see below). Image float-left on each post; body parsed for `>>id` tokens which become orange clickable buttons that scroll-and-pulse the target post (`data-postid` lookup, 1.6s outline pulse).
- [[NewThreadOverlay]] — composer. Login required, image required, 1–5 genre picker with vibe-color chips and 6th-rejection error. On submit, atomically swaps `?compose=1` for `?thread=<newId>` so user lands on their thread.
- [[ReplyComposer]] — pinned-bottom in [[ThreadOverlay]]. Login-gated, optional image, `>>id` parsing. Pre-fills with `>>id` quote-back when user clicks a post-id chip (composer remounts via `key` bump to apply `initialQuotedIds`).
- [[PostHeader]] — role-colored identity chip + `[TÚ]` when own post + clickable `>>postid` on the right.

**Backlinks.** Under each post header, `respondieron: >>id1 >>id2 …` lists inbound replies (only when there are any — quiet for unanswered posts). Map inverted from `quotedReplyIds` once per replies-change via `useMemo`.

**Inline `[TÚ]` on quote-tokens.** When a `>>id` token in body text resolves to a post authored by the current user, an orange `TÚ` chip renders next to it. Surfaces "someone is replying to me" without forcing the reader to scan the thread for the cited post. Complements PostHeader's existing `[TÚ]` (which marks "this post is mine"). Implementation: `authorByPostId` map in [[ThreadOverlay]], `isQuoteToMe(id)` helper threaded through `PostBody` → `BodyText`.

**Genre + vibe sharing.** `GENRE_VIBE` map (was inlined in [[VibeSlider]]) extracted to [[genres]] as an exported const, alongside new helpers `vibeForGenre` and `genresIntersectVibeRange`. Lets the foro catalog and the slider share the genre→vibe lookup, and any future surface can plug in.

**Navigation.** New `/foro` link at code `07` in [[Navigation]]'s NAV_LINKS, between `/articulos` and the auth badge. Mobile + desktop nav share the same source array.

### Verified in preview

- Catalog renders 8 mock threads with reply counts (R·04, R·03, …) and genre chips colored per `GENRE_VIBE`.
- Click tile → thread overlay opens at `?thread=fr-003`, shows OP + 4 replies with proper role badges (REDACCIÓN/OG/LECTOR/INSIDER), image float, working `>>id` quote-buttons, backlinks under each cited post.
- Logged out → reply composer shows "INICIA SESIÓN PARA RESPONDER"; "+ NUEVO HILO" trigger opens [[LoginOverlay]].
- Logged in as `loma_grave` → posting a thread persists to sessionStorage with id `fr-s01`, lands at position 1 in catalog (counter 08/30 → 09/30), overlay opens automatically.
- Posting a reply on fr-003 (which has 4 mock replies) → id `fp-003-s05`, parent thread bumps to top via `bumpOverrides[fr-003]`.
- Genre picker: 5/5 cap, 6th selection rejected with `Máximo 5 géneros.` error. Submit disabled until subject + body + image + genres ≥ 1.
- Vibe slider drag (max 10 → 3): catalog filters from 8 to 2 threads (fr-006 ambient-techno + fr-008 downtempo/dub), counter swaps to `02/08 EN RANGO`.
- Inline `TÚ` marker: logged in as `tlali.fm`, fp-001-02's body shows `>>fp-001-01` followed by orange `TÚ` chip (her seed reply is being quoted). Negative case verified — switching to `loma_grave` removes the chip in fr-001 and adds it in fr-007 (where her fp-007-01 is quoted by fp-007-02).
- `npm run dev` clean across all changes; no console or server errors after final reload.

### Open follow-ups

- Catalog cap is read-side only (slice 30). Storage can grow past 30 if a user authors many threads in one session; only the catalog is bounded. Real backend will need server-side prune-on-insert.
- No moderation surface yet — no thread/reply tombstone equivalent of [[CommentList]]'s deletion stub. Deferred.
- No per-user keying on session storage (same caveat as [[comments]] / [[saves]]). Real backend keys per user.

---

## 2026-04-26 · INGEST · Save-from-feed flow

Closes the long-deferred Guardados/* slot. Users can now bookmark publications from the public side and review them in the dashboard alongside saved comments.

**Storage layer** [[saves]]. `gradiente:saves` sessionStorage with shape `{ savedIds: string[] }`. Mirrors the [[comments]] store idiom — listener-pattern hooks (`useSavedItems`, `useIsItemSaved`), pure-function writers (`toggleSavedItem`, `clearSavedItems`). Resolver looks in `MOCK_ITEMS` first, falls back to [[drafts]] via `getItemById` so session-published items are saveable too. Items whose ids no longer resolve are silently dropped — no ghost rows when a user deletes a saved draft.

**Public-side affordance:**
- [[SaveItemButton]] — `★ GUARDAR / ★ GUARDADO` chip in the [[OverlayShell]] header, next to [[ShareButton]]. Login-gated, orange-when-active.
- [[SavedBadge]] — tiny orange `★` chip in the top-right corner of every [[ContentCard]] and [[HeroCard]]. Renders `null` when not saved so the unsaved feed has zero added chrome. Distinct from the red editorial-flag mark by both color (orange vs red) and position (top-right vs top-left).

**Dashboard surface.** [[GuardadosSection]] replaces the previous placeholder body. Filter prop generalized from `ContentType | null` to `ContentType[] | null` so the `editoriales` slot covers both `editorial` and `opinion`, and `articulos` covers `articulo` and `listicle` — keeps editorially-related types together rather than fragmenting them. Each tile uses [[DraggableCanvas]] under namespace `saves:<filterKey>` (e.g. `saves:articulos`) so each filter view has its own drag layout. Tile click navigates via `?item=<slug>` to open the overlay; inline `★ QUITAR` button on the thumbnail unsaves without bubbling to the tile click.

**Sidebar wiring.** Dropped `stub: true` from all 7 `Guardados/*` items in [[ExplorerSidebar]]; wired live count badges from `useSavedItems` (with editorial+opinion / articulo+listicle merging) plus the previously-already-real comments count. The dashboard page's hardcoded `savedCount = 0` became `useSavedItems().length` driving the storage panel total.

### Verified in preview

- Login as `loma_grave` → open `?item=festivales-latam-presion-europea-2026` → click `☆ GUARDAR` → flips to `★ GUARDADO`, aria-pressed=true, sessionStorage shows `{"savedIds":["ar-001"]}`.
- Close overlay → home grid → `ar-001`'s card shows the saved star badge with `aria-label="Guardado"` alongside its unrelated red editorial mark.
- `?section=guardados-articulos` → DraggableCanvas with 1 tile (thumbnail + `//ARTICULO` chip + title + inline `★ QUITAR`).
- Sidebar badges live-update: `Artículos: 01`, `Feed: 01`.
- `npm run build` passes; 16 routes prerendered as static content.

### Open follow-ups

- Saves are not user-keyed (same caveat as saved comments) — switching mock users in the same tab shows the previous user's saves. Real backend keys per user.
- The `partner` content type is excluded from saves by design (per [[Partners Isolation]]) — no UI surfaces it for save, no slot in `Guardados/*`.
- Click-vs-drag on saved-item tiles uses `DraggableCanvas`'s 4px threshold, same as saved-comments tiles. QUITAR button uses `e.stopPropagation()` so it doesn't fire the tile's open-overlay click — same isolation pattern.

---

## 2026-04-26 · INGEST · Comments system + saved-comments dashboard

Shipped a full discussion subsystem on top of the overlay layer plus a dashboard surface for saving comments back to user-specific bookmarks. Five surfaces + four library modules + a generic file-canvas primitive.

**Identity rework.** Replaced the binary `admin/insider/null` auth model with a strict role hierarchy `admin ⊃ moderator ⊃ collaborator ⊃ user`, where `user` carries a sub-`userCategory` of `og | insider | normal`. New types in [`lib/types.ts`](../../lib/types.ts): `Role`, `UserCategory`, `User`, `ReactionKind`, `Reaction`, `Comment`, `CommentDeletion`. Real handles for the project team (`datavismo-cmyk` admin, `hzamorate` + `ikerio` collaborators) seeded alongside synthetic personas in [[mockUsers]].

**Auth surface.** [[useAuth]] rewritten to expose `currentUser: User | null` derived from `MOCK_USERS`; storage shape moved from `{ role, username }` to `{ userId }`. Added `loginAs(userId)` for the new picker. [[LoginOverlay]] gained a `QUICK·SWITCH` panel listing all 8 mock users with role badges — log in as any tier without remembering credentials. Existing `admin/admin` shortcut preserved (resolves to canonical admin).

**Permission helpers.** [[permissions]] module — pure functions: `hasRole`, `canComment`, `canReact`, `canEditComment`, `canDeleteOwnComment`, `canModerateComment`, `canEditContent`, `canBanUser`, `canAssignRoles`. Anonymous = read-only. Authors edit only their own comments — admins explicitly cannot edit other users' words.

**Comment data model.** [[mockComments]] — 25 seed comments threaded across `ar-001`, `ed-001`, `mx-001`, `rv-001`. Exercises depth-5 threading, controversy hot-spot (cm-006: high-resonate AND high-disagree, both count toward engagement), moderator tombstone with preserved replies (cm-009), edited marker (cm-011). Helpers `engagementScore`, `descendantCount`, `directReplyCount`.

**Session-scoped overlay store** [[comments]]. `gradiente:comments` sessionStorage holds three slices: `added` (new top-level/reply comments), `reactionOverrides` (per-comment reaction lists that shadow seed data), `savedIds` (bookmarks for the dashboard surface). Hooks `useComments(itemId)`, `useIsCommentSaved(commentId)`, `useSavedComments()` subscribe via a small listener registry. Reaction toggles do not subtract — disagreement counts as engagement, not suppression. See [[No Algorithm]].

**Discussion UI surfaces:**
- [[CommentList]] — threaded renderer with recursive sort (activity → engagement → chronological), depth cap at 4 with `↳ VER N RESPUESTAS MÁS` collapse, role-colored badges (admin orange / moderator red / collaborator green / OG-INSIDER blue-purple / lector neutral), tombstone rendering with deletion reason, "EDITADO" marker.
- [[CommentComposer]] — login-gated dual-variant: `root` (always-expanded textarea pinned at column bottom) and `reply` (collapsed `↳ RESPONDER` trigger that expands inline). Enter posts, shift+enter newline, Esc cancels.
- [[CommentsColumn]] — column chrome (header + status strip + scroll body + composer footer) consuming `useComments(item.id)`.
- ASCII reaction palette `[+]` resonates / `[−]` disagree / `[?]` provocative / `[!]` signal — never emoji. Active state highlights the user's own reactions in orange.
- "TÚ" indicator on user-own comments — orange-tinted left rail + `[TÚ]` chip alongside the role badge.

**Split-screen overlay layout** in [[OverlayShell]]. Wrapper now hosts panel + comments column + a vertical rail button as flex siblings. Wrapper max-width animates between `64rem` (closed) and `1400px` (open) via Framer Motion; column slides in from the right with `flex-basis 0% → 40%`, `opacity 0 → 1`, `translateX 40 → 0`, `marginLeft 0 → 0.75rem` — all animated together so neither end of the close transition snaps. Rail button pinned at `right: 0` of the wrapper so it tracks the rightmost visible surface (panel when closed, column when open). ESC collapses comments first; `e.stopPropagation()` on the rail button prevents the backdrop close from firing.

**URL-driven overlay reactivity** in [[useOverlay]]. Replaced the `popstate`-only listener (which missed `next/link` navigation) with `useSearchParams()` from `next/navigation`. Now the overlay opens on any URL change with `?item=…` regardless of how the URL got there. New `?comment=<id>` deep-link param read by [[OverlayShell]] auto-opens the comments column AND focuses the matching comment.

**Focused-comment behavior.** When `?comment=` is present, [[CommentList]] threads the focused id down to the matching `CommentNodeView`, which after a 600ms delay (column slide-in completes first) calls `scrollIntoView({ behavior: 'smooth', block: 'center' })` and applies the `comment-focus-flash` class. The flash is a CSS keyframe outline pulse (cyan, 2.4s, no `fill-mode`) — non-permanent: outline reverts to none after animation, leaving the user-own-comment background intact.

**Saved-comments dashboard surface** [[SavedCommentsSection]] under `Guardados/Comentarios` (new sidebar entry, NOT a stub). Two-level draggable file explorer:
- **Folder grid** — one folder per publication with saved comments, showing the article thumbnail, title, type label, and comment-count badge. Single-click drills in. Namespace `saved-comments:folders`.
- **File grid** — one tile per comment within a folder, draggable. Click expands inline to reveal full body + `ABRIR EN OVERLAY ›` (deep-links via `?item=…&comment=…`) + `★ QUITAR`. Namespace `saved-comments:files:<articleId>` so each article's drag layout is independent.

**Generic primitive** [[DraggableCanvas]] — extracted the canvas + position store + drag mechanics so saved-comments can have free-form positioning matching Drafts/Publicados. Click-vs-drag disambiguated by 4px movement threshold so inner buttons (QUITAR, ABRIR) survive. Bails out of pointer capture on `target.closest('button, a, input, ...')`. Older [[DraggableFileGrid]] (used by Drafts/Publicados) left untouched — refactor to consolidate is a separate task.

### Verified in preview

- Login: log in as `loma_grave` via QUICK·SWITCH → AuthBadge shows `@loma_grave`, sessionStorage stores `{ userId: "u-og-loma" }`. `admin/admin` form path resolves to `u-datavismo`.
- Comments mount: open `ar-001` overlay → click rail button → column slides in at 40% width, 11 seed comments rendered, sort produces cm-001(4 replies) → cm-006(2) → cm-009(tombstone, 1) → cm-011(0).
- Reactions: click `[+]` on cm-001 → loma_grave's existing seed reaction removed → count drops `[+] 2 → 1`, button aria-pressed=false, `reactionOverrides` persisted.
- Composer: type "Comentario de prueba" in root composer → ENVIAR → new comment appears at end of list (0 activity, lowest sort priority), id `cm-session-…` persisted in `added`.
- Reply: click `↳ RESPONDER` under cm-006 → textarea expands inline, single textarea instance.
- Save: click `★ GUARDAR` on cm-001 → button flips to `★ GUARDADO` orange, `savedIds: ["cm-001"]` persisted.
- Dashboard: `Guardados/Comentarios` shows 3 folders for 4 saved comments (cm-001, cm-006, cm-014, cm-017). Click ar-001 folder → file view with 2 tiles. Click cm-001 → expands inline with body + ABRIR + QUITAR.
- Drag: pointerdown→move→up on first folder tile dragged it from `(12,12)` → `(82,93)`, position persisted under `gradiente:dashboard:positions:saved-comments:folders`.
- Deep-link: navigate to `/?item=festivales-latam-presion-europea-2026&comment=cm-005` → overlay mounts, comments column already open, cm-005 has `data-focused="true"` and `comment-focus-flash` class, no other comment is focused.
- TÚ indicator: as `loma_grave`, cm-006 (her authored comment) renders with `data-own="true"` and the TÚ chip; sibling comments don't.

### Memory updates

None this session — no new behavioral preferences or feedback surfaced; existing memos still accurate.

### Open follow-ups

- Wiki: per-component pages for [[CommentList]], [[CommentsColumn]], [[CommentComposer]], [[SavedCommentsSection]], [[DraggableCanvas]] landed alongside this entry. Module pages for [[mockUsers]], [[mockComments]], [[permissions]] are pointers in [[index]] only — write full pages if those modules grow new behavior worth documenting.
- Saved comments are not user-keyed in sessionStorage — switching between mock users in the same tab shows the previous user's saves. Acceptable for prototype; real backend keys by user.
- Closing the overlay leaves an orphan `?comment=` param in the URL (only `?item=` is cleared). Harmless visually since the overlay is unmounted, but worth scrubbing when we touch [[useOverlay]] again.
- Scroll-to-focused-comment doesn't expand a depth-cap-collapsed subtree if the focused id lives deeper than depth 4. None of the current seed targets exercise this; landing it requires walking the tree and auto-expanding on the path to the focused id.

---

## 2026-04-25 · INGEST · Dashboard explorer revamp + header auth

Replaced the flat dashboard with a retro file-explorer shell, restructured around a `Guardados/` future-purpose folder, and overhauled the header auth controls so LOGIN/DASHBOARD/SALIR actually read at a glance.

**New module** [[Dashboard Explorer]]. The shell wraps every dashboard surface in a 3-column window (sidebar + window + details panel) with a top breadcrumb. Single page at [`app/dashboard/page.tsx`](../../app/dashboard/page.tsx) dispatches sections via `?section=`. Old `/dashboard/drafts` becomes a client redirect to `/dashboard?section=drafts`.

**Sections wired:**
- `home` — landing tiles (Nuevo / Drafts / Publicados / Perfil)
- `nuevo` — 8 type templates rendered as folded-corner file icons; click → details panel + bottom info bar; double-click → form
- `drafts` / `publicados` — free-form draggable color-coded file workspace, positions persist per-namespace in sessionStorage
- `profile` — identity card + editable name/city/bio/firma (no pronouns — explicit user request)
- `guardados-{feed|agenda|noticias|reviews|mixes|editoriales|articulos}` — disabled stubs reserving slots for the future save-from-feed surface (see [[Guardados Roadmap]] in memory)

**Trim pass.** First iteration mirrored a Windows-style file manager more literally — Cut/Copy/Paste toolbar buttons, fake `48.7 GB / 120 GB` storage gauge, Media folder, Archivo grouping with Eliminados, orphan content-type sidebar entries, redundant bottom INFORMACIÓN bar duplicating the right-side DETALLES panel. All cut. Storage panel repurposed as **ESTADO DE LA UNIDAD** with real counts (drafts / publicados / guardados / last-edit) + soft 50-item cuota.

**Layout fixes:**
- VibeSlider hidden on `/dashboard` — feed-curation control, not editor concern. Implemented via `usePathname()` early-return wrapper around the impl ([VibeSlider.tsx](../../components/VibeSlider.tsx)).
- ExplorerShell now `min-h-[calc(100vh-200px)]` with the row `flex-1` and the window stretching — short sections (Profile) no longer leave a gap above the footer, since `body { min-height: 100vh }` was pushing the footer down past short content.

**Header auth redesign** — see [[AuthBadge]]. The previous chip used 8px text in dim `#FF6600` buried between near-invisible 6px captions (`UNIT·ACCESS`, `ID·NULL`). Replaced with: 13px Syne Black labels in bright `#FF8C00` / `#4ADE80` with EVA glow, blinking/pulsing dot, username inline at `#888`, and `SALIR` (icon + label, hover→sys-red) instead of a lone `⏻` glyph. Captions dropped — they only added noise around the actual button.

### Verified in preview

- `/dashboard` → home tiles render; sidebar shows the 5 flat items + Guardados folder with 7 stubs; ESTADO DE LA UNIDAD reactive
- `?section=nuevo` → 8 file icons, click MIX → details + CTA `USAR ESTA PLANTILLA`
- `?section=drafts` → seeded 4 drafts → drag from `(12,12)` → `(106,103)` → reload → position persists
- `?section=publicados` → separate position namespace
- `?section=profile` → no pronouns field; storage panel sits 720px+ above footer (no overflow)
- `?section=guardados-mixes` → placeholder explains future save flow + perks roadmap
- `/dashboard/drafts` → 200 redirect → lands on `?section=drafts`
- Header logged out → `LOGIN` at 13px `#FF8C00`, 139×53px tappable
- Header logged in → `DASHBOARD` at 13px `#4ADE80` + `@admin` username + `SALIR` button (79px, hover red)

### Memory updates

- [feedback: no decorative chrome](../../../C--Users-Iker-Documents-Gradiente/memory/feedback_no_decorative_chrome.md) — every affordance must work today or have a named future purpose
- [project: Guardados → club perks roadmap](../../../C--Users-Iker-Documents-Gradiente/memory/project_guardados_perks_vision.md) — three-stage arc (save-from-feed → attendance markers → verifiable partner perks)

---

## 2026-04-25 · INGEST · Chunk 3-C — Brand pages

Closes Chunk 3 (Discovery + identity). Adds three identity surfaces — `/about`, `/manifesto`, `/equipo` — with terminal-aesthetic chrome. Copy is intentionally placeholder; the editorial team fills in finished prose later.

**Shared shell** [components/brand/BrandPageShell.tsx](../../components/brand/BrandPageShell.tsx). Three tiny exports:
- `<BrandPageShell>` — header (orange `//SUBSISTEMA · X` chip + pulsing dot, font-syne display title, optional dek) + a single max-w-3xl reading column
- `<BrandSection index={N} title="...">` — `§01 TITLE` heading idiom borrowed from [[ArticuloOverlay]] so the visual language stays consistent across long-form
- `<Redactar note?="..." />` — bright red `[REDACTAR · note]` chip with a pulsing dot. Visible enough that finished copy can't be shipped without removing it

**Routes:**
- [app/about/page.tsx](../../app/about/page.tsx) — what Gradiente FM is, vibe filter explainer, FASCINOMA + Club Japan connections. 3 `[REDACTAR]` markers
- [app/manifesto/page.tsx](../../app/manifesto/page.tsx) — editorial declaration scaffolded around the principles in `wiki/90-Decisions/` (No Algorithm, Guides Not Gatekeepers, Vibe Spectrum). 7 `[REDACTAR]` markers — section bodies are placeholders
- [app/equipo/page.tsx](../../app/equipo/page.tsx) — list of collaborators (`datavismo-cmyk`, `hzamorate`, `ikerio` per [CLAUDE.md](../../CLAUDE.md)) with GitHub links + per-person `[REDACTAR]` bios

**Footer wiring** in [app/layout.tsx](../../app/layout.tsx) — added a `<nav>` between the SUBSISTEMA chip and the GRADIENTE strip with `/ABOUT · /MANIFIESTO · /EQUIPO` links. Footer becomes a flex-wrap on mobile so the link row stacks cleanly under the chip without crushing the lat/lon block.

### Verified in preview

- `/about` → renders `//SUBSISTEMA · ABOUT`, title "QUÉ ES GRADIENTE FM", 3 `[REDACTAR]` chips visible
- Footer → `/manifesto` → `//SUBSISTEMA · MANIFIESTO`, title "GUÍAS, NO PORTEROS", 7 `[REDACTAR]` chips, "NO HAY ALGORITMO" section present
- Footer → `/equipo` → all three collaborator handles + clickable `https://github.com/<handle>` links per row

### Chunk 3 status

| Chunk | Status |
|---|---|
| 3-A — Search overlay | ✓ done |
| 3-B — Clickable genre chips (incl. AnimatePresence-blocks-unmount fix) | ✓ done |
| 3-C — Brand pages | ✓ done |

[[Next Session]] closed out for Chunk 3. New roadmap items are open for whoever picks up next: mobile pass, dashboard chrome redesign, the deferred backend work, or the smaller [[Open Questions]] items (Tailwind `base` rename, reduced-motion respect, missing exit-fade).

---

## 2026-04-25 · INGEST · Chunk 3-B — Clickable genre chips

Genre chips on cards + overlays now filter the home grid in-page. Same idiom as the existing category filter ([[CategoryRail]] → [[FeedHeader]] reactive strip), composes with it (both can be active simultaneously and intersect).

**New module** [components/genre/GenreChipButton.tsx](../../components/genre/GenreChipButton.tsx) — reusable chip wrapper that:
- Calls `setGenreFilter(genreId)` on click
- Closes any open overlay via [[useOverlay]] (so clicking inside an overlay drops you back to the home grid showing the filtered set)
- `router.push('/')` if not already on home (since the filter only applies on the home feed)
- `e.stopPropagation() + preventDefault()` so the chip click doesn't bubble to the card and reopen the overlay

**[[VibeContext]]** extended with `genreFilter: string | null` + `setGenreFilter`. Stores the genre id (matches `ContentItem.genres` entries), parallel to the existing `categoryFilter`.

**[[ContentGrid]] filter pipeline** got a new step right after the category filter — `mode === 'home' && genreFilter ? filtered.filter(i => i.genres.includes(genreFilter)) : filtered`. Type-specific routes ignore both filters as before. Updated useMemo deps.

**[[FeedHeader]]** rewrote the reactive strip to surface BOTH filters when active. Header reads `//SUBSISTEMA · FILTRADO · CATEGORIA · GÉNERO·NAME`. Independent `[×] LIMPIAR SECCIÓN` and `[×] LIMPIAR GÉNERO` buttons clear each axis individually.

**Chip render sites wired** to `GenreChipButton`:
- [[ContentCard]] sm/md/lg variants
- [[HeroCard]]
- All six overlays: [[ReaderOverlay]] (two render sites — bordered chip + ETIQUETAS rail list), [[ArticuloOverlay]] (rail list), [[ListicleOverlay]] (rail list), [[MixOverlay]] (orange-bordered chip), [[EventoOverlay]] (vibe-bg chip), [[GenericOverlay]] (vibe-bg chip)

For each render site, swapped `getGenreNames(item.genres)` (names only) for `item.genres.map(id => ({ id, name: getGenreById(id)?.name ?? id }))` (id+name pairs) so the click handler can pass the canonical id while the chip displays the human label.

The orphan linear cards [[MixCard]] / [[EventCard]] / [[ArticleCard]] (used by the not-wired-to-pages [[ContentFeed]]) were intentionally NOT updated — they don't appear in the live UI.

### Pre-existing bug uncovered + fixed: AnimatePresence blocked unmount

While verifying the genre filter wasn't visibly reducing the grid (despite `ranked.length` correctly dropping from 78 to 15 to 3), discovered that the [[ContentGrid]] `<AnimatePresence>` wrapper had been keeping ALL filtered-out cards mounted in the DOM at full opacity — even with `mode="popLayout"`, even with the `MosaicItem` wrapped in `forwardRef`, even with `layoutId` removed. Cards' exit transitions weren't firing; they just stayed.

This explains why **the in-page category filter has been silently broken**: clicking a CategoryRail row would update `categoryFilter` state, [[FeedHeader]] would reflect the new filter, `ranked` would correctly compute only N items — but the grid still rendered all 78 because AnimatePresence held onto them. Easy to miss because the FeedHeader UX gives a strong "filter is active" signal. Likely been broken since the AnimatePresence wrapper was added.

Fix: removed `<AnimatePresence>` from [[ContentGrid]] entirely. Each `<motion.div>` (MosaicItem) keeps its own `layout` + `initial`/`animate` props, so cards still get a smooth mount + reflow when the grid changes. The trade-off is no exit-fade animation when items leave (they unmount immediately) — acceptable for filter UX. If a richer exit animation matters later, the path forward is to find a Framer Motion 12 incantation that actually lets `popLayout` complete the exit without the children getting stuck mounted.

Also added `forwardRef` to `MosaicItem` for future flexibility (any parent that wants to attach a ref).

### Verified end-to-end in preview

1. Click `[Cumbia Electrónica]` chip on a home card → grid filters to 3 cards, all cumbia, FeedHeader reads `//SUBSISTEMA · FILTRADO · GÉNERO·CUMBIA ELECTRÓNICA`
2. Click `[×] LIMPIAR GÉNERO` → grid restores to 78
3. Open `?item=espectro-mix-008` (mix overlay) → click a genre chip inside → URL drops `?item=`, overlay closes, home grid filters to 11 (Minimal / Deep Tech), FeedHeader reflects new filter
4. Category filter via [[CategoryRail]] now also visibly reduces the grid (incidentally fixed by the AnimatePresence change)

[[Next Session]] roadmap: 3-A and 3-B done; only 3-C (brand pages) remains in this chunk.

---

## 2026-04-25 · INGEST · Fix — overlay PUBLICAR AHORA now goes through confirm modal

User caught an inconsistency: clicking `▶ PUBLICAR AHORA` from the draft overlay published the item directly, bypassing the [[Publish Confirmation Flow]] gate that the pending-card corner button uses. Fix is one line in [components/overlay/OverlayShell.tsx](../../components/overlay/OverlayShell.tsx) — `SessionItemStrip.handlePublish` now calls `usePublishConfirm.openConfirm(item.id)` instead of `upsertItem(item, 'published')` directly. Both surfaces now route through the same `[[PublishConfirmOverlay]]` modal.

Verified end-to-end in preview: draft → overlay PUBLICAR AHORA → modal opens with item preview → cancel keeps draft in `draft` state, confirm flips it to `published` and re-renders the strip from orange `DRAFT·SESIÓN` to green `PUBLICADO·SESIÓN`.

[[Publish Confirmation Flow]] updated with a new "Draft → Confirm (from overlay)" subsection under `## How` documenting this third entry point to the gate.

---

## 2026-04-25 · INGEST · Chunk 3-A — Search overlay

First piece of the Discovery + identity chunk. Adds the `/`-invoked search overlay called for in [[Next Session]].

**New module** [components/search/useSearch.tsx](../../components/search/useSearch.tsx) — `<SearchProvider>` + `useSearch()`. Owns the open/close state and the global `/` keyboard listener. The listener skips editable targets (`<input>`, `<textarea>`, `<select>`, contenteditable) and skips when modifier keys are held, so typing `/` into form fields works untouched and OS shortcuts pass through. `preventDefault` only fires when actually opening, so unrelated keystrokes aren't eaten.

**New component** [components/search/SearchOverlay.tsx](../../components/search/SearchOverlay.tsx). Borrowed the panel chrome from [[LoginOverlay]] / [[PublishConfirmOverlay]] (`eva-box eva-scanlines`, EVA-orange `//BÚSQUEDA` header chip, `[ESC] CERRAR`, backdrop blur, body scroll lock). Anchored top-of-viewport (`pt-20 items-start`) instead of centered — reads more like a command palette than a modal.

Per Next Session's brief — **invoked mode, not a default top-bar input**. No engagement-driven autocomplete, no ranking. The search results render as a focused subsystem mirroring [[FeedHeader]]: `//SUBSISTEMA · BÚSQUEDA · 'query' // N RESULTADOS` (pulsing dot, EVA orange). Empty-query state shows the keyboard hint `ESCRIBE PARA BUSCAR · ↑↓ NAVEGAR · ↵ ABRIR · ESC SALIR`.

**Corpus**: `MOCK_ITEMS` ∪ `useDraftItems()` deduped by slug (drafts win — editor's working copy beats seeded version). `partner` items excluded (sponsor rail, never surfaced through reading flow — [[Partners Isolation]]).

**Match**: substring against per-item haystack of `title + subtitle + excerpt + author + venue + artists`. First 30 hits, then a `· REFINA EL TÉRMINO ·` footer prompt.

**Result row**: type chip in `categoryColor(item.type)`, mono title, per-type secondary line (venue + artists for evento, artists for mix, author/subtitle for editorial-family), `[↵]` chevron on the selected row.

**Keyboard**: `↑/↓` move selection (clamped, reset to 0 on query change), `Enter` closes search and opens the selected item via [[useOverlay]] — same flow a card click takes, URL syncs to `?item=`. `Esc` closes. Hover updates selection so keyboard resumes from cursor position. Listeners bound at window level so focus drift doesn't break navigation.

**Layout wiring**: `<SearchProvider>` placed inside `<OverlayProvider>` (since `<SearchOverlay>` uses both contexts) and above `<CRTOverlay>` so state survives CRT mode flips. Mounted alongside the other overlays.

**Verified end-to-end** in preview:
1. `/` opens, input auto-focused
2. `donato dozzy` → 4 results across event/mix/noticia (matches Next Session's example exactly)
3. ↑↓ moves selection (`[↵]` indicator follows)
4. ESC closes, body scroll unlocks
5. Enter on a result closes search and opens the content overlay (`?item=fascinoma-2026-cdmx-outdoor`)
6. `/` is correctly suppressed when typing in dashboard form fields

[[index]] updated. New note [[SearchOverlay]] in `40 — Components`. No [[Open Questions]] entry closed (the search question wasn't filed there — it was a Next Session item).

---

## 2026-04-25 · INGEST · Editor closure — chunks 1 + 2

Two long arcs that close the dashboard publishing loop end-to-end. Recorded as a single entry since the work was continuous.

### Arc 1 — Quick wins (the dashboard → feed loop)

**Drafts surface in the feed.** New module [[drafts]] (`lib/drafts.ts`) owns a sessionStorage-backed store of `DraftItem` (a `ContentItem` with frontend-only `_draftState` + `_createdAt` + `_updatedAt`). Subscriber pattern fires `notify()` on every mutation so consumers re-render without reload. Public API:
- `getAllItems() / getItemById(id)`
- `upsertItem(item, state)` — insert or update by id
- `removeItem(id)`
- `useDraftItems()` hook for components
- `newItemId(type)` — stable id generator

**HomeFeedWithDrafts** ([[FeedHeader]]'s sibling) — client wrapper around [[ContentGrid]] that merges session items into the feed. Two phases of evolution:
- v1: prepend ALL session items (drafts + published) so dashboard publish surfaces immediately
- v2: filter to only `published` items + the one matching `?pending=<id>`. Pure drafts no longer pollute the public feed; they live in [[Dashboard Drafts]]. Aligns with the editor's POV: drafts are private work-in-progress.

**[DRAFT·SESIÓN] chip** added to [[ContentCard]] when `_draftState === 'draft'`. Mostly dormant on the home feed (drafts hidden) but still useful in the drafts list view.

**Session item strip** in [[OverlayShell]] — when an item has `_draftState`, a horizontal action bar appears between the chrome and the content:
- Draft items: orange strip with `EDITAR / ELIMINAR / ▶ PUBLICAR AHORA`
- Published items: green strip with `EDITAR / ELIMINAR`
- Real MOCK_ITEMS content: nothing

**404 page** ([app/not-found.tsx](../../app/not-found.tsx)) — terminal-aesthetic glitch. `// SEÑAL PERDIDA` headline with red text-shadow, glitching path readout that scrambles every 220ms via a chained-pattern `scramble()` helper, terminal "DIAGNÓSTICO" block listing failed system checks, RETORNAR AL FEED + category quick-links, hazard-stripe chrome.

**ShareButton** ([components/overlay/ShareButton.tsx](../../components/overlay/ShareButton.tsx)) — slotted into [[OverlayShell]]'s header next to ONLINE. `[⎘ COPIAR ENLACE]` → flips to green `ENLACE·COPIADO` for 1.8s. Uses `navigator.clipboard.writeText` with `execCommand` fallback for non-secure contexts.

**MixOverlay related-mixes section** — `04 SIGUIENTES MIXES` after the existing 3 panels. Curated by genre overlap, falls back to recent. Mirrors the [[ArticuloOverlay]] / [[ListicleOverlay]] pattern.

**Save indicator** — [[Dashboard Forms]] `SubmitFooter` now shows `◉ AUTOSAVE · HACE Xs` next to the action chips. Updates every 5 seconds via setInterval; reads `lastSavedAt` from `useDraftWorkbench`.

**Type-specific empty states** in [[ContentGrid]] — instead of a generic `// SIN CONTENIDO`, each filtered type gets its own copy: `// CABINA · BOOTH VACÍO` for mix, `// AGENDA · CALMA TEMPORAL` for evento, etc. Reads the active categoryFilter from [[VibeContext]].

**Bugs caught mid-build:**
- `commitItem` import was wrong (named export lived in `Fields.tsx`, not `lib/drafts.ts`); fixed to `upsertItem as _commitItem`.
- [[OverlayRouter]] only resolved slugs from MOCK_ITEMS — extended to look in `useDraftItems()` first so draft cards open via overlay.

### Arc 2 — Two-state model + pending confirmation + edit flow

User feedback drove a refactor of how publishing actually works. The key insight: a single one-click `PUBLICAR` button is too dangerous; a draft-saved-but-not-yet-public state is meaningful; pending content should be visible in the feed during review but visually distinct.

**Two-state model:**
- `SubmitFooter` now has TWO actions instead of one: `▣ GUARDAR DRAFT` (grey) and `▶ PUBLICAR` (orange).
- `useDraftWorkbench`'s old `publish()` was renamed `requestPublish()` — saves as draft + returns the item id. The actual transition to `published` happens elsewhere (see below).
- `saveDraft()` unchanged.
- The form's `onPublish` handler is now: `requestPublish() → setCategoryFilter(null) → router.push('/?pending=<id>')`.

**See [[Publish Confirmation Flow]]** for the full design rationale and state-machine sketch.

**Visual primitives for the pending state:**
- New CSS keyframes in [globals.css](../../app/globals.css): `pending-border-pulse` (red↔orange, 1.6s), `pending-scanline-sweep` (vertical line traversal, 2.4s), `pending-cover-flicker` (CRT distortion on cover image, 3.2s with 4-step keyframe punches), `pending-chip-flicker` (subtle opacity pulse on the chip).
- [[ContentCard]] renders `[PENDIENTE·CONFIRMAR]` chip (red) + glitch border + scanline overlay + cover flicker when `_pendingConfirm` is set. Replaces the `[DRAFT·SESIÓN]` chip in this state — only one signal at a time, less visual noise.
- Auto-scroll-into-view on mount when pending so the editor doesn't have to hunt for their card.
- Corner button `[✓ CONFIRMAR]` floating top-right, opens the confirmation modal.

**Confirmation modal** — new [[PublishConfirmOverlay]], globally mounted at layout level (alongside [[LoginOverlay]]). Driven by `usePublishConfirm` context — same shape as `useAuth`. Modal shows item type/slug/title preview + warning copy + `CANCELAR` / `▶ PUBLICAR DEFINITIVAMENTE`. On confirm: `upsertItem(item, 'published')` + clears `?pending` URL param via `router.replace`.

**Filter clear on publish** — when a category filter is active and the editor publishes a different type, the new card would be filtered out and invisible. Each form's `onPublish` calls `setCategoryFilter(null)` before routing. Surgical: only fires at publish-time, not on dashboard entry, so browsing-time filters are preserved.

**Edit flow** — any session item (draft OR published) gets `[✎ EDITAR]` in its overlay strip. Routes to `/dashboard?type=<type>&edit=<id>`.
- `useDraftWorkbench` accepts `editItemId` prop. On hydrate, prefers `getItemById(editItemId)` over the per-form local-draft key.
- Strips `_draftState` and `_pendingConfirm` flags before populating form state.
- Sets `committedId` to the existing item's id so subsequent saves UPDATE the same row instead of creating a new one.
- Wired in all 7 forms via `useSearchParams().get('edit')`.

**Visual session-strip differentiation:**
- Drafts: orange chrome, all 3 actions
- Published: green chrome, just edit + delete (already live; no need to re-publish)

### Arc 3 — Chunk 2: Editor closure

**Drafts list page** — `/dashboard/drafts` ([[Dashboard Drafts]]):
- Auth-guarded same as `/dashboard`
- Header row counts (`3 ENTRADAS · 2 DRAFTS · 1 PUBLICADAS`)
- Type filter chips (only types present, with per-type counts)
- State filter chips (TODOS / DRAFTS / PUBLICADAS) — composes with type
- Table rows: type chip · state chip (orange-pulsing draft, green published) · title + slug · `hace Xh` updated · `[✎ EDITAR]` `[▶ PUBLICAR]` (drafts only) `[🗑]`
- Empty states: "BANDEJA VACÍA" for fresh sessions, "SIN COINCIDENCIAS" for over-narrow filters
- Sorted newest-updated first
- DRAFTS link in [[Dashboard]] header status strip with live count from `useDraftItems()`

**Form validation feedback:**
- New `required` prop on `TextField` / `TextArea` → renders red `*` next to label, red-tinted border when empty
- New `errors: string[]` prop on `SubmitFooter` → renders `⚠ FALTA: TÍTULO · SLUG` red chip when invalid
- Each form computes its own errors array from required-field rules
- Eventually replaces the silent disabled-button-with-no-explanation pattern

**Image upload** — `ImageUrlField` extended with three input modes:
- Type / paste URL (existing)
- `[⎘ ELEGIR ARCHIVO]` button → native file picker → reads as data URL via `FileReader`
- Drag image onto the field → reads as data URL
- Result stored as a string (URL or `data:image/...;base64,...`) — drop-in for `imageUrl` everywhere
- URL field shows truncated display when storing a data URL (`data:image/png… [archivo cargado · 142 KB]`) + readonly to prevent corruption
- `[×] LIMPIAR` button to clear
- Type validation: rejects non-image with red error chip
- When backend lands, file picker / drop swap to upload-and-return-URL; rest of the form contract unchanged

**Opinion form** ([[Dashboard Forms]]) — clone of EditorialForm with `type: 'opinion'`. Adds 7th type to the dashboard.

**Articulo form** — the long-deferred big one. Closes dashboard type coverage at 8/9 (only `partner` excluded — rail-only). Self-contained file (~620 lines):
- Same identity / lead / vibe / media / footer pattern as other forms
- Block editor supporting all 10 `ArticleBlock` kinds: `lede / p / h2 / h3 / quote / blockquote / image / divider / qa / list`
- Each kind gets a kind-specific editor body (text input for h2/h3, dual cite+text for quote variants, full ImageUrlField for image, list-items editor for list, speaker + isQuestion toggle for qa, etc.)
- Footnotes editor: id + text rows, add/remove, with usage hint (`[^id]` syntax)
- Glyph icons in block headers for visual scannability
- Up/down/delete per block

### Files added across both chunks (in chronological-ish order)

**lib/**
- [drafts.ts](../../lib/drafts.ts) — store + hook + types

**components/**
- [HomeFeedWithDrafts.tsx](../../components/HomeFeedWithDrafts.tsx)
- [overlay/ShareButton.tsx](../../components/overlay/ShareButton.tsx)
- [publish/usePublishConfirm.tsx](../../components/publish/usePublishConfirm.tsx)
- [publish/PublishConfirmOverlay.tsx](../../components/publish/PublishConfirmOverlay.tsx)
- [dashboard/DraftsList.tsx](../../components/dashboard/DraftsList.tsx)
- [dashboard/forms/OpinionForm.tsx](../../components/dashboard/forms/OpinionForm.tsx)
- [dashboard/forms/ArticuloForm.tsx](../../components/dashboard/forms/ArticuloForm.tsx)

**app/**
- [not-found.tsx](../../app/not-found.tsx)
- [dashboard/drafts/page.tsx](../../app/dashboard/drafts/page.tsx)

### Files modified
- [lib/types.ts](../../lib/types.ts) — `_draftState` + `_pendingConfirm` on `ContentItem`
- [components/cards/ContentCard.tsx](../../components/cards/ContentCard.tsx) — chip swap, glitch wiring, corner confirm button, auto-scroll
- [components/overlay/OverlayShell.tsx](../../components/overlay/OverlayShell.tsx) — `SessionItemStrip` (was `DraftActionStrip`), ShareButton slot
- [components/overlay/OverlayRouter.tsx](../../components/overlay/OverlayRouter.tsx) — resolves drafts before MOCK_ITEMS
- [components/overlay/MixOverlay.tsx](../../components/overlay/MixOverlay.tsx) — related section
- [components/ContentGrid.tsx](../../components/ContentGrid.tsx) — per-type empty states
- [components/dashboard/forms/shared/Fields.tsx](../../components/dashboard/forms/shared/Fields.tsx) — workbench split (saveDraft / requestPublish), CommitFlash, SaveIndicator, errors prop, required prop, FieldLabel helper, ImageUrlField with drag-drop + file picker
- All 7 form files (Mix / Listicle / Evento / Review / Editorial / Opinion / Noticia / Articulo) — useRouter + useSearchParams + useVibe; onPublish navigation; required props; errors arrays
- [app/dashboard/page.tsx](../../app/dashboard/page.tsx) — Articulo + Opinion routed; DRAFTS link with live count
- [components/dashboard/TypePicker.tsx](../../components/dashboard/TypePicker.tsx) — Articulo + Opinion meta
- [app/layout.tsx](../../app/layout.tsx) — PublishConfirmProvider + PublishConfirmOverlay mounted
- [app/globals.css](../../app/globals.css) — pending-* keyframes + utility classes

### Bugs caught mid-build (already fixed; noted for the record)

- `commitItem` import didn't exist in `lib/drafts.ts` (the named re-export lived in `Fields.tsx`). Fixed to `upsertItem as _commitItem`.
- [[OverlayRouter]] only knew about MOCK_ITEMS, so clicking a draft card opened nothing. Fixed: looks up drafts via `useDraftItems()` first.
- [[HeroCard]] `TYPE_LABEL` was missing the `listicle` entry (latent regression from listicle introduction). Fixed.
- Dashboard with active categoryFilter would publish a different type → invisible card. Fixed by `setCategoryFilter(null)` in each form's `onPublish`.
- Tailwind `base` color collision (still open as a deeper refactor; patched locally in [[MixOverlay]] earlier).

### Still open / explicitly deferred

- **Dashboard chrome redesign** — user noted DRAFTS link is too subtle in the header; deferred to a dedicated dashboard pass.
- **Real backend** — every "session" feature becomes a real DB write when [[Supabase Migration]] lands. The seam is `lib/drafts.ts`'s API — replace functions, callers don't change.
- **Audio context session** — mix transport + listicle inline track embeds + reactive HUD still deferred.
- **Inline track embeds in listicles** — still link-outs; same audio-context dependency.
- **Mobile pass** — accidental desktop-only bits (CategoryRail at lg+, AuthBadge at md+, dashboard split-view).
- **Tailwind `base` color rename** — spawned task, not yet picked up.
- **CRT scanline sweep on filter change** — user-suggested polish, see [[CRT Scanline Sweep]].
- **Reduced-motion respect** for the pending glitch + CRT animations (a11y).

### Where the dashboard now stands

| Type | Form | Notes |
|---|---|---|
| evento | ✓ | dates, venue, line-up, tickets |
| mix | ✓ | embeds, structured tracklist, contexto |
| listicle | ✓ | streamlined block editor (4 kinds incl. track) |
| articulo | ✓ | full block editor (10 kinds) + footnotes |
| review | ✓ | reader-family |
| editorial | ✓ | reader-family + editorial flag default |
| opinion | ✓ | reader-family columnist variant |
| noticia | ✓ | leaner, fast-decay |
| partner | — | rail-only, intentionally not editable |

8 of 9 types fully editable. Same pipeline for all: workbench autosave + edit hydration + filter clear + pending confirmation + drafts list management.

### New notes from this session

- [[Publish Confirmation Flow]] — design + state machine
- [[Dashboard Drafts]] — page note
- [[drafts]] — module note
- (Various component notes still pending — see [[Open Questions]])

### Updates

- [[Dashboard]] — drafts subpage link, two-state model
- [[Dashboard Forms]] — validation, image upload, articulo + opinion, edit hydration
- [[Open Questions]] — closed: drafts injection, articulo form, opinion form, save indicator, image upload, drafts list, validation feedback, MixOverlay related, 404 page
- [[index]] — new pages + components
- [[Next Session]] — fresh start brief

## 2026-04-25 · INGEST · Dashboard, in-page category filter, polish pass

Catch-up entry covering ~24h of work that wasn't logged in real time. Three big arcs.

### Arc 1 — Insider dashboard (visual prototype)

User-facing goal: editors / partners log in via header overlay, hit a `/dashboard` route, pick a content type, see a form whose layout mirrors how the type renders in the feed. Live preview panel on the right reflects edits in real time.

**Auth system** — visual prototype only, hardcoded `admin/admin`:
- [[useAuth]] context + `<AuthProvider>` wrapping the app, sessionStorage-backed.
- [[LoginOverlay]] — terminal-aesthetic modal triggered by a header button. Uses the same panel chrome as [[OverlayShell]] for visual coherence. Validates credentials, sets session, auto-closes.
- [[AuthBadge]] in [[Navigation]] — slots between MAGI cluster and timer. Swaps `LOGIN` (orange) ↔ `DASHBOARD` link (green) + `⏻` logout when authed. Mobile-only hidden for now (kept the existing `≡` toggle clean).
- When real auth lands (Supabase), `useAuth.login()` is the only thing that changes — rest of the app consumes via `useAuth()` and is provider-agnostic.

**Dashboard route** — `/dashboard`:
- Auth-guarded client component. Unauthed users get prompted via the login overlay.
- Type picker grid: 6 tiles (mix · listicle · evento · review · editorial · noticia). Each tile in the type's `categoryColor` with a top accent stripe.
- Picking a type routes to `/dashboard?type=mix` (URL-driven so back/forward works) and renders a split view: form (left) + [[LivePreview]] (right).
- Excluded from v1: `articulo` (needs full structured-block editor), `opinion` (trivial duplicate of editorial), `partner` (rail-only, separate flow). Placeholder shown if user lands on those.

**Forms — one per type**, per the per-type-components preference:
- [components/dashboard/forms/MixForm.tsx](../../components/dashboard/forms/MixForm.tsx) — full mix shape: identity, copy, vibe + genres, media, embeds, contexto (series/recordedIn/format/BPM/key/status), tracklist editor.
- [components/dashboard/forms/EventoForm.tsx](../../components/dashboard/forms/EventoForm.tsx) — date/end-date pickers (datetime-local), venue, line-up (StringListField), tickets, price.
- [components/dashboard/forms/ReviewForm.tsx](../../components/dashboard/forms/ReviewForm.tsx), [EditorialForm.tsx](../../components/dashboard/forms/EditorialForm.tsx), [NoticiaForm.tsx](../../components/dashboard/forms/NoticiaForm.tsx) — reader-family triplet sharing the same fields with type-appropriate defaults (e.g. editorial defaults `editorial: true`, noticia is leaner with no author/readTime).
- [components/dashboard/forms/ListicleForm.tsx](../../components/dashboard/forms/ListicleForm.tsx) — the most complex. Standard fields plus an `articleBody` block editor supporting four block kinds (`lede`, `p`, `divider`, `track`). Each track block has rank, artist, title, year, BPM, cover, embeds, commentary.
- Shared primitives in [components/dashboard/forms/shared/Fields.tsx](../../components/dashboard/forms/shared/Fields.tsx) — `Section`, `TextField`, `TextArea`, `Toggle`, `VibeField`, `GenreMultiSelect`, `StringListField`, `EmbedList`, `ImageUrlField`, `SubmitFooter`, plus `slugify` and `publishDraft` helpers.
- Each form: hydrate from sessionStorage on mount, autosave on change, slug auto-generated from title (overrideable).

**LivePreview** — right pane:
- Renders the draft `ContentItem` through its real overlay component (`MixOverlay`, `ListicleOverlay`, `EventoOverlay`, `ReaderOverlay`, etc.) inside a scaled-down panel that mimics [[OverlayShell]] without taking over the screen.
- Updates in real time as the form is edited. Verified by typing a title and watching the preview's H1 update synchronously.

**Submit / publish (visual only)**:
- Console-logs the constructed `ContentItem` with a fresh id + timestamp.
- Persists to `sessionStorage.gradiente:dashboard:published` (capped to 20).
- Brief green `◉ DRAFT PUBLICADO EN SESIÓN` confirmation chip.
- Drafts do NOT yet inject into the home feed — see [[Open Questions]].

**Block editor streamlined** (after first version was clearly cluttered):
- Track blocks now collapsible to a 1-row summary (rank · cover thumb · artist/title · embed count). Toggleable per block. Default expanded on add, collapsible after.
- Primary `AÑADIR TRACK` button (large, orange) + secondary chips for `LEDE` / `PÁRRAFO` / `DIVISOR` — weights the dominant content unit appropriately.
- **Auto-rank**: new track blocks pre-fill rank by detecting countdown vs. ascending pattern from existing tracks. First track 10 → next track auto-fills 9, etc.
- **Insert-between** rows: thin hairline gap between every pair of blocks; on hover a `+` reveals a mini picker to insert any kind at that position.
- **Auto-focus** lands on the first editable field of newly-added blocks (artist for track, textarea for lede/p).
- Inline cover thumb in the expanded track view — immediate visual feedback as URL is typed.
- Kind glyphs in headers (`Disc3` / `Type` / `Minus`) for quick scanning.

**Form polish — type-contextual paste handlers**:
- **Mix tracklist**: `PEGAR LISTA` toggle opens a textarea + parser. Recognizes `01. Artist - Title (134)`, `Artist — Title [134 BPM]`, `Artist - Title 134`, `Artist - Title`. Skips `#` comment lines. Live "N pistas detectadas" count. Enter in the last row's BPM cell adds a new row + auto-focuses ARTIST. Multi-line paste in any row also parses and splits in place.
- **EmbedList** (mix + listicle track blocks): URL input live-syncs platform dropdown as you type/paste (YouTube URL → tab snaps to YOUTUBE). Auto-focus on add. Multi-URL paste splits into rows with per-platform detection.
- **StringListField** (evento line-up, etc.): same `PEGAR LISTA` pattern, one entry per line. Per-row paste also splits multi-line. Enter creates new row.

**Tailwind `base` color collision regression** — see [[Open Questions]]. Hit again in `MixOverlay`'s excerpt; fixed locally with `md:text-[15px]`. Spawned task to rename the token.

### Arc 2 — Two new listicle fixtures

The user wanted to see how listicles actually look in the feed. Added two:

- **`5 eventos imperdibles · Mayo 2026`** — events-themed list using `lede / h2 / image / p / divider` blocks. Each event entry has a ranked h2, flyer image with date+venue caption, and editorial description. Demonstrates that the existing block kinds can carry an event listicle without a dedicated `event` block kind.
- **`10 tracks que definieron el verano · CDMX 2026`** — 10 track blocks countdown 10→1, summer-vibe BPMs (110-132), house/breaks/electro/disco genres. Real producers (DJ Tennis, Roman Flügel, Hagan, Anz, Karenn, Skee Mask, Floating Points, Siete Catorce, Loraine James, Donato Dozzy at #1).

### Arc 3 — In-page category filter

User flagged the rail as taking them to dedicated routes (`/agenda` etc.), breaking the contained-surface idiom. Reworked to filter the home grid in place.

**Mechanics**:
- Added `categoryFilter: ContentType | null` + `setCategoryFilter` to [[VibeContext]].
- [[CategoryRail]] refactored from `<a href>` links to `<button>` toggles. Click sets the filter; click again on the active category clears it. Added `//TODOS` pseudo-row at top (active when no filter). Added a `×` clear affordance in the SECCIÓN header that shows only when a filter is active.
- [[ContentGrid]] applies the category filter alongside the vibe filter on the home feed (mode === 'home' only — type-specific pages already filter at the route level so they're not affected).
- [[HeroCard]] returns `null` when a filter is active and doesn't match its type. Also caught a latent bug: `HeroCard.TYPE_LABEL` was missing the `listicle` entry — fixed.
- Active category dims inactive entries to 40% opacity for visual focus.

**Dedicated type routes preserved** — `/agenda`, `/mixes`, `/articulos`, etc. still exist for deep-linking and bookmarking. The rail simply no longer points to them. Editorial decision per the user.

**Transition polish** so filter changes don't snap:
- [[ContentGrid]] now wraps the items map in `<AnimatePresence mode="popLayout">`. `popLayout` is the right mode here — exiting cards stay in their original DOM slot until they finish animating, allowing remaining cards to reflow cleanly via Framer's shared-layout animation.
- Each card has explicit `initial / animate / exit`: exit is `opacity → 0`, `scale → 0.85`, 220ms easeIn (decommission feel). Initial is `opacity 0`, `scale 0.92` → animates to the prominence-driven standing scale.
- [[FeedHeader]] new client component replacing the previously static "TODO LO QUE VIENE" strip in [[Home]]. Reads `categoryFilter` and switches between the default editorial intro and a terminal-flavored `//SUBSISTEMA · FILTRADO · {TYPE}` status line (in the category color, with a pulsing dot) + a `[×] LIMPIAR FILTRO` button as a second clear affordance alongside the rail's `×`.

### Misc small things

- **Curation maps were missing `listicle`** — `ATTENTION_HALF_LIFE_HOURS`, `FRESHNESS_HALF_LIFE_HOURS`, `peaks` initializer, and `TYPE_SCORE_MULTIPLIER` all needed the new key, otherwise lookups returned undefined and produced NaN scores → invisible cards. Fixed.
- **CategoryRail was missing `listicle`** — same class of bug, same fix.
- **ContentCard / OverlayShell `TYPE_LABEL`** also needed `listicle: 'LISTA'`.
- Listicle track-block rank text overflowed its column (`md:text-6xl` in 80px col cropped under cover image). Adjusted to `md:text-5xl` in 96px col → 11px clearance.

### Out of scope / explicit deferrals

- **Drafts injecting into the home feed** — currently sessionStorage-only. The plumbing (`useDrafts()` hook + grid merge) is one focused change away. See [[Open Questions]].
- **Articulo dashboard form** — needs the `articleBody` editor to handle all block kinds (lede/p/h2/h3/quote/blockquote/image/divider/qa/list). Listicle covers the subset (lede/p/divider/track); articulo would extend.
- **CRT scanline sweep on filter change** — user-suggested polish. See new roadmap note [[CRT Scanline Sweep]].
- **Inline track embeds in listicles** — still link-outs. Deferred to the audio-context session for the same iframe-vs-Web-Audio reason as the mix player.

### New notes

- [[Dashboard]], [[useAuth]], [[LoginOverlay]], [[AuthBadge]], [[LivePreview]], [[Dashboard Forms]], [[FeedHeader]]
- [[CRT Scanline Sweep]]

### Updated notes

- [[CategoryRail]] — now in-page filter, not navigation
- [[VibeContext]] — categoryFilter added
- [[ContentGrid]] — AnimatePresence + exit animations + category filter
- [[Open Questions]] — draft injection, CRT scanline added; tailwind `base` collision still open
- [[Content Types]] — already updated previously for listicle
- [[index]]

## 2026-04-24 · INGEST · Mix overlay + Listicle content type shipped

Two deliverables, one shared infrastructure.

**Mix overlay** — mix no longer falls through to [[GenericOverlay]]. New [[MixOverlay]] renders a two-column terminal layout matching a mockup the user shared: editorial column (title, excerpt, metadata row with 10-bar vibe gauge, body, genres) + system column with three numbered panels — `01 AUDIO EMBED // REPRODUCTOR` (source tabs, cover, decorative seeded waveform, non-functional transport, `[ABRIR FUENTE]` link-out), `02 CONTEXTO` (SERIE / GRABADO EN / FORMATO / BPM / KEY / ESTATUS key-value grid), `03 TRACKLIST / ETIQUETAS` (numbered artist/title/BPM table + tag chips).

**Mix type fields extended** (see [[Content Types]]):
- `embeds: MixEmbed[]` — multi-platform sources (SoundCloud / YouTube / Spotify / Bandcamp / Mixcloud), drives the overlay tabs. `mixUrl` retained as legacy fallback.
- Structured `tracklist: MixTrack[]` — rows `{ artist, title, bpm? }` replacing the old `string[]`. Safe change — no existing mix had `tracklist` data populated.
- New context metadata: `mixSeries`, `recordedIn`, `mixFormat`, `bpmRange`, `musicalKey`, `mixStatus` (`'disponible' | 'exclusivo' | 'archivo' | 'proximamente'`).
- `mx-001` (Siete Catorce) and `mx-002` (Rat Pack Crew) enriched with full shape as visual test fixtures. Other mixes degrade gracefully — empty panels show explicit empty states ("Sin metadata de contexto.", "Tracklist no publicado.").

**Listicle** — ninth content type. Concept: ranked/structured list features ("Top N tracks that defined X"). Architecturally a sibling of [[ArticuloOverlay]]: same `articleBody: ArticleBlock[]`, same prose primitives, plus a new `track` block variant `{ kind: 'track', rank, artist, title, year, bpm, imageUrl, embeds, commentary }`.

**`track` block is shared infra** — the case lives inside `BodyBlocks` in [[ArticuloOverlay]] (which is now exported). This means any `articulo` can also embed track references with zero duplication. Listicle is where it's the primary content unit; articulo could use it for inline track citations.

**Routing/labeling:**
- `'listicle'` added to `ContentType`, `categoryColor` (`#FB923C` orange — shares the mix panel color family), `TYPE_LABEL` ('LISTA' — Spanish convention; internal key stays 'listicle' to match the user's terminology).
- Curation tuning: [curation.ts](../../lib/curation.ts) `ATTENTION_HALF_LIFE_HOURS`, `FRESHNESS_HALF_LIFE_HOURS`, `peaks` initializer, and `TYPE_SCORE_MULTIPLIER` (1.3, matches articulo) all extended. Without these, `Record<ContentType, number>` lookups returned undefined at runtime, producing NaN scores and invisible cards — caught during verification.

**Visual prototype scope:**
- **Audio playback is not wired anywhere** — transport controls in mix overlay are visible but disabled; track-block source buttons in listicles are link-outs (`<a target="_blank">`). Per user decision, all audio work (persistent audio across overlays, reactive-from-audio HUD, custom transport, click-to-embed facade for listicle tracks) is deferred to a dedicated audio-context session. See [[Open Questions]].
- Iframe-based embeds were explicitly avoided — iframes sandbox the audio stream and would have to be ripped out when the audio session happens anyway.

**Shared infrastructure landed:**
- [[Embed Primitive]] — `components/embed/platforms.ts` holds `PLATFORM_LABELS`, `PLATFORM_ORDER`, and `detectPlatform(url)`. Small by design; will grow (iframe src builders, `<EmbedPlayer>` component) when the audio session happens.

**Bug surfaced, partially fixed:** Tailwind config in [tailwind.config.ts](../../tailwind.config.ts) declares `colors.base: '#000000'`. This makes Tailwind generate `.text-base { color: #000000 }` alongside the default font-size rule. At md+ breakpoint, `md:text-base` overrode `text-secondary` on the excerpt `<p>`, rendering the text invisible on the black background (user-reported). Fixed locally in [[MixOverlay]] with `md:text-[15px]`; the latent bug remains anywhere else using `text-base` or `md:text-base`. A spawned task was filed to rename the `base` color token and sweep usages. Spot-check [[GenericOverlay]] at `text-base`. Flagged in [[Open Questions]].

**New fixtures:**
- One enriched mix (mx-001) matching the mockup's richness — multi-source embeds, full CONTEXTO, 5-row tracklist.
- One listicle (`li-hard-techno-cdmx-2026`) — "5 tracks que definieron el hard techno en CDMX · 2026" — with lede, intermission paragraphs, divider blocks, and 5 countdown-ranked `track` blocks each with 2-4 source embeds spanning all four major platforms.

**Layout fix during verification:** Rank digits in track blocks initially used `md:text-6xl` in an 80px column, overflowing into the cover image. Adjusted to `md:text-5xl` in a 96px column — 5px overflow absorbed by grid gap, 11px clearance to cover.

**New notes:**
- [[MixOverlay]], [[ListicleOverlay]], [[Embed Primitive]]
- [[Content Types]] expanded with listicle section and full mix field docs

**Updates:**
- [[Open Questions]] — MixOverlay resolved; audio-context session consolidation added; tailwind `base` color collision noted.

**Next up (per user):** admin dashboard with morphing upload forms. The listicle is ready — dashboard needs to offer it as one of the upload type options alongside evento / mix / noticia / review / editorial / opinion / articulo.

## 2026-04-24 · INGEST · VibeSlider redesigned — phosphor tape + continuous range

[[VibeSlider]] rebuilt end-to-end to resolve the choppy clipped-gradient look and the integer-snap slider feel.

**Visual — from clipped stripe band → phosphor tape:**
- Removed `STRIPE_MASK`, `NEON_GRADIENT`, and the `clipPath: inset()` overlay. The old design cropped a full-width rainbow with a 45° black mask; as the handle moved, the crop was visually choppy and the mask made the colors feel muddy.
- Replaced with **three horizontal rows of short vertical dashes** evoking a static waveform display: 120 dashes in the middle row (dense, near-continuous baseline), 40 in the top and bottom rows at a half-step offset from each other to create a subtle saw rhythm. All dashes 2.5px wide, 3–6px tall, with a tight colored halo glow when lit.
- Each dash's color is computed once via a new `interpolateVibeColor()` helper that linearly interpolates between adjacent `vibeToColor()` anchors — so the band is smooth but snaps to the discrete per-item slot colors at integer positions. See [[Vibe Gradient]] for the updated three-expression breakdown.
- Dash positions/widths use a `Math.imul`-based integer hash — bit-exact across Node SSR and V8 client, avoiding React hydration warnings (earlier `Math.sin`-based attempt produced last-digit FP drift between server/client).

**Mechanics — from stepped → continuous:**
- `getValueFromX` no longer rounds: `vibeRange` now stores continuous floats in `[0, 10]` rather than integers 0–10. Dragging from GLACIAL toward VOLCÁN glides smoothly instead of snapping per-slot.
- Handle label and label color still snap to the nearest integer slot via `Math.round(min)` — the named vibes (GLACIAL, POLAR, CHILL…) remain legible rather than reading `3.73`.
- The lit/unlit boundary inside the phosphor tape is **pixel-precise** — each dash stores its exact float vibe and the `d.vibe >= min && d.vibe <= max` check produces a crisp boundary that slides smoothly with the handle.
- Content filtering (`filterByVibe` in [[ContentGrid]] / [[ContentFeed]]) automatically benefits — items' integer vibes compared against float boundaries give smooth activation as handles cross half-integer thresholds.

**Deliberately preserved:**
- Sticky positioning below [[Navigation]], RESET button, click-track-to-move-nearer-handle, label overlap threshold (14%), genre chip strip below the band.
- The 11 slot names (GLACIAL → VOLCÁN) are unchanged — finer granularity than `vibeToLabel` by design, needed for slider positions.

**Out of scope / deferred:**
- Unifying the three color expressions (Tailwind pastel, discrete saturated, dash interpolation) — deferred. See [[Vibe Gradient#Should they unify]].
- Making the phosphor tape reactive to audio — still future. See [[project_audio_vision]] in memory. The current static 3-row print is deliberately shaped to read as a waveform preview, priming the eye for when embeds land and the tape becomes a real HUD.

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
