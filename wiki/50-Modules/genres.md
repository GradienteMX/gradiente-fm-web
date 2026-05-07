---
type: module
status: current
tags: [module, genres, tags, catalog, taxonomy, hierarchy]
updated: 2026-05-05
---

# genres

> Hierarchical genre taxonomy: 18 root categories + ~175 leaf subgenres + ~47 legacy ids. Items tag with leaves; filters roll up parents → descendants. Plus a transversal tag catalog for cross-genre qualities.

## Source

[lib/genres.ts](../../lib/genres.ts)

## Genre type

```ts
interface Genre {
  id:       string
  name:     string
  parents:  string[]   // empty for top-level roots; one or more parent ids for subgenres
  legacy?:  boolean    // pre-taxonomy entries kept for DB back-compat
}
```

The pre-2026-05-05 4-bucket `category: 'electronic' | 'club' | 'organic' | 'experimental'` is gone. Replaced with the hierarchy.

## The 18 root categories

```
techno · house · dub-reggae · dnb-jungle · dubstep-uk · ambient-drone
krautrock-kosmische · fourth-world · lofi-bedroom · hyperpop-deconstructed
industrial-ebm · post-punk-shoegaze · electronica-idm · jazz
soul-funk-rnb · hip-hop-rap · musique-concrete · world-bass
```

Source: `generos.txt` (curator-authored). Each has a Spanish or mixed-language display name (e.g. `Drum & Bass / Jungle`, `Música Concreta / Académica`, `World / Global Bass / Latinoamérica`).

## Subgenres + cross-listing

Each subgenre carries `parents: string[]`. Most have one parent; some are cross-listed:

- `techno-industrial-dub` (Industrial Dub) → `[techno, dub-reggae, industrial-ebm]`
- `techno-dub` (Dub Techno) → `[techno, dub-reggae]`
- `ambient-industrial` → `[ambient-drone, industrial-ebm]`
- `proto-ambient` → `[krautrock-kosmische, ambient-drone]`
- `lo-fi-hip-hop` → `[lofi-bedroom, hip-hop-rap]`
- `cold-wave`, `dark-wave` → `[industrial-ebm, post-punk-shoegaze]`
- `jazz-rap` → `[jazz, hip-hop-rap]`
- `tropical-ambient` → `[fourth-world, ambient-drone]`

Cross-listed entries appear once in the catalog with multiple parent linkages — `getRollup` walks all of them.

## Option B: leaves with parents (decided 2026-05-05)

Items tag with **leaf ids** when possible. Filtering by a parent rolls up to match any of its descendants. Filtering by a leaf matches just that leaf.

```ts
itemMatchesGenreFilter(['techno-raw', 'ambient'], ['techno']) === true
//   item-side leaf 'techno-raw' is descendant of filter 'techno' → match
itemMatchesGenreFilter(['deep-house'], ['techno']) === false
//   no overlap
itemMatchesGenreFilter(['deep-house'], ['house']) === true
//   parent rollup catches the leaf
```

This is the "Option B" choice from the pre-implementation discussion (vs Option A: flat, no parent linkage; vs Option C: store parent + leaf both).

## Legacy entries

47 pre-taxonomy ids preserved with `legacy: true`. Each parented to its closest taxonomy root so:

- DB rows tagged with `hard-techno` still display correctly
- Filtering by `techno` (parent) rolls up and includes `hard-techno`
- The dashboard composer **hides them from new tagging UIs** (per the `legacy: true` flag) so curators adopt the new taxonomy

Examples: `hard-techno → [techno]`, `deep-house → [house]`, `nu-disco → [house]`, `psy-trance → [techno]`, `gqom → [world-bass]`.

## Helpers

```ts
GENRES: Genre[]                       // ROOTS + SUBGENRES + LEGACY (~240 entries)
getGenreById(id): Genre | undefined
getGenreNames(ids): string[]          // display names with id fallback
getRootGenres(): Genre[]              // the 18 top-level roots
getDirectChildren(id): Genre[]        // single-level descendants (legacy excluded)
getRollup(id): string[]               // [id, ...all descendants]
itemMatchesGenreFilter(itemGenres, activeFilters): boolean
```

Lookups are `Map`-backed — `GENRE_BY_ID` constructed once at module load. Children index `CHILDREN_BY_PARENT` precomputed for fast rollup.

## Tags (transversal qualities)

Separate from genres. The `tags` field on `ContentItem` is for orthogonal qualities — things that compose with any genre. Recently expanded with the transversal list from `generos.txt`:

```
greyscale · degradado · devocional · ritual · maximalista · minimalista
granular · dancefloor · sala-grande · audifonos · outdoor · after
soundsystem · modular · acustico · voz · instrumental · live-set
cdmx · latinoamericano · diasporico · afrofuturista
```

Plus the original event-format tags: `festival`, `workshop`, `lgbtq`, `club-night`, `open-air`, `b2b`, `live`, `radio`, `feminist`, `vinyl-only`, etc.

## GENRE_VIBE — the deprecated stereotype

Kept around for two reasons:

1. **[[VibeSlider]] fallback** — when `visibleGenres` is null (e.g. on `/foro`), the chip strip uses `GENRE_VIBE` keys to populate. Falls back gracefully.
2. **[[Foro]] genre→vibe filter** — `genresIntersectVibeRange` checks each thread's tagged genres against the slider's range. Foro threads have no vibe field of their own; this map is the only way to gate them.

Per [[Vibe Philosophy]] idea 2, this is a stereotype shortcut and should eventually go. For now: kept resolvable. Coverage isn't exhaustive — uncovered ids fall through to "always pass" so new genres don't disappear.

## Why this taxonomy + this shape

- **Hierarchy** matches how curators actually think about genre — there's a "techno" headspace and there are subdivisions of it. Forcing flat ids loses that structure.
- **Leaves with parents** (Option B) keeps item rows compact (one id per actual subgenre) while supporting both broad and narrow filtering.
- **Cross-listing via array of parents** handles the real cases ("Industrial Dub" really does belong under both genealogies).
- **Legacy preservation** means we don't have to migrate DB rows. New content adopts the new ids; old content keeps working.

## Open questions

- Composer UX: with ~190 visible entries, the search-as-you-type filter is necessary. A hierarchy-aware view (collapsible parent → expand children) would be cleaner but more work. Out of scope for the migration slice.
- A genre might want to live under more than one parent. Already supported via `parents: string[]` — but the dashboard picker doesn't visualize this. Curator just sees the leaf name.
- `GENRE_VIBE` deprecation. Replacing the foro filter with a real vibe field per thread (or per author?) would let us drop the stereotype map entirely. Defer until foro grows.

## Links

- [[Vibe Philosophy]] — idea 2 underpins this
- [[Vibe Spectrum]]
- [[VibeSlider]] — chip strip consumer (rollup-aware)
- [[ContentGrid]] — filter consumer (`itemMatchesGenreFilter`)
- [[GenreChipButton]]
- [[Foro]] — uses `genresIntersectVibeRange`
