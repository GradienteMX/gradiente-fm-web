---
type: roadmap
status: in-progress
tags: [roadmap, scraper, ingestion, ra, automation]
updated: 2026-05-01
---

# Scraper Pipeline

> A Resident Advisor webscraper already exists (used to produce the current `mockData.ts` seed). The plan: productionize it as the long-tail ingestion engine for the site.

## Phase strategy (2026-05-01)

The scraper has two distinct operating modes that map to two project phases. The pipeline must be designed so the phase shift is a config/flag change, not a rewrite.

### Phase 1 — Launch / event-listing-first (NOW)

User-acquisition is event-listing-driven (see [[Event-listing-first MVP]] in personal memory and [[Guides Not Gatekeepers]] for the longer thesis). The scraper is **necessary infrastructure for launch**, not a post-launch enhancement.

- Scraped events appear in the home grid alongside editorial content. HP curation does the sorting; editorial still gets spawn-HP advantage.
- Ingest is direct: RA GraphQL → script → typed `lib/scrapedEvents.ts` (or equivalent) → imported next to `mockData.ts`. **No Excel intermediate, no Supabase.** The Excel step in the original v1 scraper is being skipped — it was a debugging artifact, not a load-bearing part of the design.
- Editor review is post-hoc / out-of-band: the team reviews scraped output by reading the generated TS file (or a small admin surface later) and editing `vibe`, `editorial`, etc. in-place.

### Phase 2 — Editorial / community matures (PARTIALLY ARRIVED EARLY · 2026-05-01)

Original plan was to demote scraped events to `/agenda` only once `/foro`, opinion, editorial, and user activity had gained organic traction. **In practice this arrived on day one:** when 128 RA events landed in the home mosaic alongside the editorial seed, they immediately swarmed the page (190 cards, mostly scraped). The fix shipped same-day:

- Scraped events with `source === 'scraper:ra' && !elevated` are filtered OUT of the home mosaic and into a new horizontal **[[EventosRail]]** mounted directly under the pinned hero. Auto-scrolling marquee, ~5-7 visible at desktop width, click → same EventoOverlay path. Reduces the mosaic from 190 → 71 entries; the home page reads as editorial-led with a live ticker of agenda activity below the hero.
- Editor lever: a new `elevated?: boolean` field on `ContentItem`. When an editor sets it true on a scraped event, that event leaves the rail and joins the main mosaic where it competes with editorial content via HP. Default is `false` — scraped goes to rail by default, elevation is the editor's "this one's worth featuring" gesture.
- `/agenda` route still shows the full firehose (no filter applied there) — that's the destination for users who want to browse all upcoming events.

This is [[Guides Not Gatekeepers]] reasserting itself: editorial dominates home, scraped lives in its own surface, editor elevation pulls individual scraped events back into the editorial competition.

**What this did NOT change:**
- The launch user-acquisition thesis from [[Event-listing-first MVP]] is intact: the rail is highly visible (mounted between hero and mosaic, motion + LIVE FEED chip draw the eye). Users still land on the home page and see "what's happening tonight" prominently — just in a denser format than a mosaic flood.
- The aggregator framing is unchanged (hotlinked images, ticketUrl back to RA, `source` field tracked).

### Phase 3 — Automation (POST-Supabase)

Cron-driven scraper runs into Supabase, full review queue at `/admin`, notification fanout. This is the original target architecture below — still the destination, just not the immediate next step.

## Current state (as of 2026-05-01)

- A local webscraper exists at `Webscraper/ra_scraper_v2.py` that pulls events from Resident Advisor via GraphQL → Excel (`atascado_venues2.xlsx`) → hand-transcribed into [lib/mockData.ts](../../lib/mockData.ts).
- One-shot — not scheduled, not automated end-to-end.
- Output is `editorial: false` events plus whatever metadata RA exposes.
- `.gitignore` entries `Webscraper/` and `__RAVE FLYERS, RECORD COVERS, ETC/` suggest the scraper + image assets live locally on the lead's machine, not in the repo.
- **Phase 1 work in progress:** building the direct RA → app pipeline, skipping the Excel intermediate.

## Target state

```
┌────────────────────────────────────────────────────────────┐
│  RA Scraper (cron: weekly or monthly)                      │
│    fetch CDMX events → normalize → dedupe via external_id  │
│           │                                                │
│           ▼                                                │
│  Supabase `items` table (published: false, source: 'ra')   │
│           │                                                │
│           ▼                                                │
│  Editor notification (email/Slack/Discord):                │
│    "12 new events scraped, 3 high-vibe candidates"         │
│           │                                                │
│           ▼                                                │
│  /admin review queue                                       │
│    editor:                                                 │
│      - approve as-is → published: true, editorial: false   │
│      - elevate → editorial: true (spawn HP 50)             │
│      - adjust vibe, add flyer, write better copy           │
│      - discard (never publish)                             │
│           │                                                │
│           ▼                                                │
│  Live feed                                                 │
└────────────────────────────────────────────────────────────┘
```

## Key design decisions

### 1. Scraper output is never live

Scraper writes `published: false`. Only editor approval flips the flag. Prevents bad data from showing up on the public site without review.

### 2. Vibe is always editor-assigned

RA doesn't know the scene. Scraper leaves `vibe` empty or sets a safe default (5 = NEUTRAL); editor sets the real value on review. See [[Vibe Spectrum]].

### 3. `source` field on every item

New field on `ContentItem`:

```ts
source?: 'scraper:ra' | 'scraper:instagram' | 'manual:editor' | 'manual:partner'
```

Provenance for the review queue, for filtering in admin, and for future trust signals.

### 4. Dedup via `external_id`

RA events have stable IDs. Store them as `external_id` on the item. Re-runs UPSERT, don't duplicate.

### 5. Manual-entry path is a first-class citizen

Not all underground events are on RA. Instagram-only, DM-only, word-of-mouth events need an `/admin/new` form. Same DB table, same ranking, just `source: 'manual:editor'`.

## Implementation notes

- **Scheduler options:** GitHub Actions cron (simple, free, but scraper needs to run in CI), Supabase Edge Functions + pg_cron (pay for compute but tightly integrated), Railway/Render worker (cheap, simple), or a local launchd/systemd if the lead wants to keep it on their machine.
- **Scraping etiquette:** RA's ToS. Rate limit. User-agent. Cache aggressively. If RA changes markup, the scraper needs maintenance — budget 1hr/month.
- **Instagram scraping:** harder (TOS + rate limits are stricter). Probably manual-only for Instagram-sourced events unless someone wants to build a semi-assisted clipper.
- **Flyer images:** RA serves images on their CDN. Re-host to Supabase Storage or Cloudflare R2 on ingest — don't hotlink (bad for them, fragile for us).

## Dependencies

The **Phase 3** (automated, scheduled) version doesn't ship without [[Supabase Migration]]. Phase 1 (direct RA → typed TS file → app) has no backend dependency and is what's being built first.

## Open questions

- Which editors get digest notifications? How do we route them if there's >1 editor?
- Cadence: weekly feels too infrequent for a music-events site in CDMX where the calendar moves fast. Daily? Ad-hoc?
- What's the auto-publish policy? Manual review of every item is probably impossible at scale. Maybe: auto-publish low-vibe standard events, flag high-vibe / unusual events for review.
- Who handles maintenance when RA changes their HTML? (Answer: probably ikerio + hzamorate.)

## Links

- [[Admin Dashboard]]
- [[Supabase Migration]]
- [[mockData]]
- [[Content Types]]
- [[Editorial Flag]]
- [[Guides Not Gatekeepers]]
