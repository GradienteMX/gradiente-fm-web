---
type: module
status: current
tags: [module, genres, tags, catalog]
updated: 2026-04-22
---

# genres

> The genre and tag catalogs. 60+ genres, 25+ tags. Items reference by id.

## Source

[lib/genres.ts](../../lib/genres.ts)

## Exports

```ts
GENRES: Genre[]
TAGS:   Tag[]
getGenreById(id):  Genre | undefined
getTagById(id):    Tag   | undefined
getGenreNames(ids: string[]): string[]   // with id fallback if missing
getTagNames(ids:   string[]): string[]
```

## Genre structure

Each genre has `{ id, name, category }` where category is one of:

- **`electronic`** — house, techno, trance, D&B, dubstep, breaks, etc. (the dominant category)
- **`club`** — reggaeton, ballroom, jersey club, UKG, hyperpop, footwork — dancefloor but not strictly techno
- **`organic`** — hip hop, R&B, jazz, soul, cumbia, salsa, dub, son huapango — the Latin/organic side
- **`experimental`** — ambient, noise, IDM, deconstructed club, wave — the outer edges

Catalog starts with the official Beatport list, extends with an "Extended Electronic" block and an "Organic & World" block. See [lib/genres.ts](../../lib/genres.ts).

## Tag catalog

25 tags — event modifiers, mostly. `festival`, `workshop`, `club-night`, `rave`, `live`, `anl` (all night long), `lgbtq`, `feminist`, `vinyl-only`, `free`, `residency`, etc.

## Lookups are O(n)

`getGenreById` does `Array.find`. For 60 genres on every card render, that's fine. If genre tables grow to hundreds of entries, memoize into a `Map`.

## Cross-references

- [[VibeSlider]] reads `GENRE_VIBE` (a map inline in VibeSlider.tsx, different from this module) to show which genres are in range — that map maps genre id → expected vibe.
- [[ContentCard]], [[HeroCard]], [[EventCard]], [[MixCard]], [[ArticleCard]] all use `getGenreNames` / `getTagNames` for chip display.

## Links

- [[Content Types]]
- [[VibeSlider]]
- [[Vibe Spectrum]]
