---
type: roadmap
status: stale
tags: [roadmap, backend, supabase, db, superseded]
updated: 2026-05-02
---

# Supabase Migration

> **Superseded by [[Backend Plan]] (2026-05-02).** That note is the consolidated, current plan covering stack, schema, RLS, auth, beta gate, image lifecycle, foro retention, scraper schedule, realtime, captcha, budget, and phasing. Kept here because the schema sketch + effort estimate are still useful reference.

> The code already expects a backend to arrive. [[curation]] comments reference Supabase specifically. [[mockData]] exists to be replaced.

## What exists

- A clean `ContentItem[]` shape ([[types]]) that's basically a DB row.
- Pure filter/rank functions that don't care where data comes from.
- All data flows through server components — SSR-friendly from day one.

## What changes on migration

### 1. Data source

```diff
- import { MOCK_ITEMS } from '@/lib/mockData'
+ import { getItems } from '@/lib/data/content'

  export default async function HomePage() {
-   const homeItems = filterForHome(MOCK_ITEMS, now)
+   const homeItems = await getItems({ upcoming: true })
  ...
```

Every `app/*/page.tsx` becomes `async`. Next.js supports this natively.

### 2. HP becomes authoritative

Right now `hp` is always undefined on seed items. With a DB, HP is a real column and we actually **write** to it when something changes (editor edits item, new interaction signal, scheduled decay cron).

`currentHp` still computes the lazy decay from the stored snapshot, so the math doesn't change.

### 3. Peak normalization upgrades

[[curation]] comments:

> Proper spec uses rolling-90d p90. For the prototype with mock data, we approximate with the current max HP observed per type. This is enough to show relative sizing; swap for real p90 when Supabase + history exist.

With a DB, `computePeakByType` becomes a per-type SQL `percentile_cont(0.9)` over a 90-day window, cached for ~1 hour. Probably a materialized view.

### 4. Editor tooling

The editor currently edits `mockData.ts` in VSCode and PRs changes. With Supabase:
- Supabase Studio as a temporary admin UI
- Or a minimal `/admin` route gated by auth, with a form to set `editorial`, `pinned`, `vibe`, `hp`

### 5. Images

`public/flyers/*.jpg` works for ~50 items. Past that, move to Supabase Storage or Cloudflare R2. Urls stay `/flyers/...` or become full HTTPS.

## Schema sketch

```sql
create table items (
  id text primary key,
  slug text unique,
  type text check (type in ('evento','mix','noticia','review','editorial','opinion','partner')),
  title text not null,
  subtitle text,
  excerpt text,
  vibe int check (vibe between 0 and 10),
  genres text[] default '{}',
  tags   text[] default '{}',
  image_url text,
  published_at timestamptz not null,
  date timestamptz,
  end_date timestamptz,
  expires_at timestamptz,
  -- event
  venue text,
  venue_city text,
  artists text[],
  ticket_url text,
  price text,
  -- mix
  mix_url text,
  duration text,
  tracklist text[],
  -- article
  author text,
  read_time int,
  editorial bool default false,
  pinned bool default false,
  body_preview text,
  -- partner
  partner_kind text check (partner_kind in ('promo','label','promoter','venue','sponsored')),
  partner_url text,
  partner_last_updated timestamptz,
  -- curation
  hp float,
  hp_last_updated_at timestamptz
);
```

JSON → DB migration is mechanical. Camel case → snake case is the only transformation.

## Effort estimate

- Schema + RLS + seed migration from mockData: ~1 day
- Swap server data calls: ~1 day
- Minimal admin page: ~2 days
- Move images: ~1 day
- Rolling p90 + cache: ~1 day

One focused week. But don't start until the content model is stable.

## Links

- [[mockData]]
- [[types]]
- [[curation]]
- [[HP Curation System]]
- [[Data Flow]]
