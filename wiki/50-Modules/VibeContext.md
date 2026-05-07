---
type: module
status: current
tags: [module, context, state, client, multi-genre]
updated: 2026-05-05
---

# VibeContext

> Global client state: vibe range, calendar date, category filter, multi-genre filter set, and the currently-visible-in-feed genre union.

## Source

[context/VibeContext.tsx](../../context/VibeContext.tsx)

## Shape

```ts
interface VibeContextValue {
  vibeRange:        [number, number]
  setVibeRange:     (r: [number, number]) => void

  selectedDate:     Date | null
  setSelectedDate:  (d: Date | null) => void

  calendarOpen:     boolean
  toggleCalendar:   () => void

  categoryFilter:   ContentType | null
  setCategoryFilter: (t: ContentType | null) => void

  // Multi-select genre filter (was string | null pre-2026-05-05).
  // Empty array = no filter. Multiple ids intersect via OR semantics
  // through `itemMatchesGenreFilter` in [[genres]].
  genreFilter:      string[]
  setGenreFilter:   (ids: string[]) => void
  toggleGenre:      (id: string) => void
  clearGenres:      () => void

  // Genres actually present in the current vibe-filtered feed. Pushed
  // by [[ContentGrid]], consumed by [[VibeSlider]]'s chip strip so it
  // mirrors feed reality rather than the GENRE_VIBE stereotype map.
  // null = no feed has reported in (e.g. on /foro) — slider falls back.
  visibleGenres:    string[] | null
  setVisibleGenres: (ids: string[] | null) => void
}
```

## Defaults

- `vibeRange`: `[0, 10]`
- `selectedDate`: `null`
- `calendarOpen`: `false`
- `categoryFilter`: `null`
- `genreFilter`: `[]`
- `visibleGenres`: `null`

## Who writes to it

| Field | Writer |
|---|---|
| `vibeRange` | [[VibeSlider]] handles + RESET |
| `selectedDate`, `calendarOpen` | [[CalendarSidebar]] |
| `categoryFilter` | [[CategoryRail]], dashboard form-success handlers |
| `genreFilter` | [[VibeSlider]] chip strip (toggle), [[GenreChipButton]] (replace), [[FeedHeader]] (clear) |
| `visibleGenres` | [[ContentGrid]] (pushed via `useEffect` after each filter pass) |

## Who reads from it

| Reader | Fields used |
|---|---|
| [[ContentGrid]] | `vibeRange`, `selectedDate`, `categoryFilter`, `genreFilter` (filter), `setVisibleGenres` (push) |
| [[ContentFeed]] | `vibeRange`, `selectedDate` |
| [[VibeSlider]] | `vibeRange`, `setVibeRange`, `genreFilter`, `toggleGenre`, `visibleGenres` |
| [[VibeFader]] | (none — uses [[useAuth]] + [[vibeChecks]] hooks instead) |
| [[CalendarSidebar]] | `selectedDate`, `calendarOpen`, `toggleCalendar` |
| [[CategoryRail]] | `categoryFilter`, `setCategoryFilter` |
| [[FeedHeader]] | All filters (display + clear actions) |
| [[GenreChipButton]] | `setGenreFilter` (replace with `[id]`) |

## Multi-genre semantics

Filtering is OR across active genres, AND-rolled-up via `getRollup`:

- Active filters `[techno]` → matches items tagged with `techno` OR any descendant (`techno-hard`, `techno-raw`, `techno-dub`, etc., including legacy ids parented to `techno`).
- Active filters `[techno, jazz]` → matches items tagged with anything under `techno` OR anything under `jazz`.

Rollup happens in [[genres]]'s `itemMatchesGenreFilter`. The context just stores the active set — the filter logic is centralized.

## Card-chip vs slider-chip behaviors

Two different write paths converge on `genreFilter`:

- **[[GenreChipButton]]** (clicked from a card or overlay) calls `setGenreFilter([id])` — *replaces* the active set. Preserves the "jump to filter by this genre" UX from the pre-multi era.
- **[[VibeSlider]] chip strip** calls `toggleGenre(id)` — adds if absent, removes if present. This is the additive multi-select surface.

Both paths are intentional and complementary: card chip = "show me this," slider chip = "build up a filter set."

## visibleGenres push pattern

[[ContentGrid]] pushes after each filter pass:

```ts
const feedGenres = useMemo(() => {
  const vibeFiltered = filterByVibe(items, vibeRange)
  const scoped = mode === 'home' && categoryFilter
    ? vibeFiltered.filter(i => i.type === categoryFilter)
    : vibeFiltered
  return Array.from(new Set(scoped.flatMap(i => i.genres))).sort()
}, [items, vibeRange, categoryFilter, mode])

useEffect(() => { setVisibleGenres(feedGenres) }, [feedGenres])
useEffect(() => () => setVisibleGenres(null), [])  // cleanup on unmount
```

Computed from vibe + category filtered items (NOT including the genre filter — that would be circular: filtering by Techno would narrow the chips to only Techno).

Cleanup nulls on unmount so navigating to a route without a `ContentGrid` doesn't show stale data — the slider falls back to its `GENRE_VIBE` heuristic.

## Provider

`<VibeProvider>` wraps `{children}` in `app/layout.tsx` so it's available everywhere. See [[App Router Patterns]].

## Hook

`useVibe()` throws if called outside the provider. Fail-loud on misuse.

## Persistence

**None.** Refresh resets to defaults. The filter set is intentionally a momentary browse tool, not a saved preference. URL-based persistence (`?genres=techno,house`) is plausible future work.

## Migration notes

- Pre-2026-05-05: `genreFilter: string | null`. Single-select. Replaced wholesale with `string[]` for multi-select. Consumers updated in same slice ([[ContentGrid]], [[FeedHeader]], [[GenreChipButton]], [[VibeSlider]]).
- The clear-all helper for the multi-genre case is `clearGenres()`. `setGenreFilter([])` works too.

## Links

- [[VibeSlider]]
- [[ContentGrid]]
- [[genres]]
- [[Vibe Philosophy]]
- [[App Router Patterns]]
