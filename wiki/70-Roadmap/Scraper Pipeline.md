---
type: roadmap
status: draft
tags: [roadmap, scraper, ingestion, ra, automation]
updated: 2026-04-22
---

# Scraper Pipeline

> A Resident Advisor webscraper already exists (used to produce the current `mockData.ts` seed). The plan: productionize it as the long-tail ingestion engine for the site.

## Current state (as of 2026-04-22)

- A local webscraper exists that pulls events from Resident Advisor → Excel → hand-transcribed into [lib/mockData.ts](../../lib/mockData.ts).
- One-shot — not scheduled, not automated end-to-end.
- Output is `editorial: false` events plus whatever metadata RA exposes.
- `.gitignore` entries `Webscraper/` and `__RAVE FLYERS, RECORD COVERS, ETC/` suggest the scraper + image assets live locally on the lead's machine, not in the repo.

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

This pipeline doesn't ship without [[Supabase Migration]]. The DB + auth + admin UI are the enabling infrastructure.

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
