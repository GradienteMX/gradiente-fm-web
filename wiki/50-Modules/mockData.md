---
type: module
status: current
tags: [module, data, mock, seed]
updated: 2026-04-22
---

# mockData

> The seed content dataset. Everything the UI shows comes from here. No backend yet.

## Source

[lib/mockData.ts](../../lib/mockData.ts)

## Shape

```ts
export const MOCK_ITEMS: ContentItem[]
```

A hand-curated array of ~70-80 items across all seven [[Content Types]]. Images reference `public/flyers/*.jpg`.

## Real-world anchors

Per the header comment: _"Real info: Fascinoma (fascinoma.space · @fascinoma_mx) + Club Japan (Monterrey 56, Roma Norte · @japan_cdmx)"_.

Many events are actual events at real venues (FASCINOMA 2026, Club Japan industrial nights, Atrevida by N.A.A.F.I., etc.). This isn't synthetic data — it's editorial content standing in for the eventual CMS. See [[FASCINOMA]] and [[Club Japan]].

## Conventions

- **IDs prefixed by type:**  `ev-*` for events, `mx-*` for mixes, etc. Not enforced; just a convention in the existing data.
- **Slugs kebab-case** and descriptive: `fascinoma-2026-cdmx-outdoor`.
- **Every item has a `vibe`** — no zero-default. The curator picks a real number.
- **Real Passline / Bandcamp / SoundCloud URLs** where they exist.

## Known limitations

- **No HP values in the seed.** `hp` and `hpLastUpdatedAt` are all undefined. [`currentHp`](../../lib/curation.ts) falls back to `spawnHp(item)` + `publishedAt` for every item. This works; it just means the site is never showing "post-editor-nudge" HP states.
- **Dates are 2026.** When the calendar ticks past, items auto-expire. The mock set will need future-dated additions to remain functional.
- **Not all types are fully represented.** Audit needed. See [[Open Questions]].

## Swap plan

When the backend arrives ([[Supabase Migration]]), the shape of `MOCK_ITEMS` is exactly what a `GET /api/content` should return. The seed file can become the fallback for local dev / CI.

## Links

- [[Content Types]]
- [[types]]
- [[Supabase Migration]]
- [[FASCINOMA]]
- [[Club Japan]]
