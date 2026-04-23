---
type: module
status: current
tags: [module, utils, filters, formatting]
updated: 2026-04-22
---

# utils

> Vibe helpers, date helpers, format helpers, filter helpers. Pure functions, no state.

## Source

[lib/utils.ts](../../lib/utils.ts)

## Categories

### Vibe helpers

```
categoryColor(type)    → hex color per ContentType
vibeToColor(vibe)      → 11-step discrete palette (see [[Vibe Gradient]])
vibeToLabel(vibe)      → 8-step short label set (GLACIAL/CHILL/COOL/NEUTRAL/WARM/HOT/FUEGO/VOLCÁN)
vibeToPercent(vibe)    → 0-100 for % positioning
isInVibeRange(vibe, [min, max])  → boolean
```

**Note:** `vibeToLabel` is an **8-label** scale, while [[VibeSlider]] uses an **11-label** slot set inline. Different granularities for different UIs.

### Date helpers

```
isExpired(item, now)      → events past endDate, or non-events past expiresAt
isUpcoming(item, now)     → negation of isExpired
getItemDate(item)         → parseISO(item.date ?? item.publishedAt)
```

### Filter helpers

```
filterForHome(items, now)        → upcoming, ASC by date
filterForCategory(items, type)   → single type, DESC by date
filterByVibe(items, [min, max])  → items where vibe ∈ [min, max]
filterByDate(items, date)        → items on a given calendar day
getEventDates(items)             → dates of all events (for calendar dots)
```

### Format helpers (Spanish locale)

```
fmtDateShort(iso)    → "18 ABR"
fmtDateFull(iso)     → "jueves 18 de abril"
fmtDayNumber(iso)    → "18"
fmtMonthShort(iso)   → "ABR"
fmtDayName(iso)      → "JUE"
fmtTime(iso)         → "22:00" (try/catch on parse)
```

All use `date-fns/locale/es`.

### Misc

```
clsx(...classes)     → tiny class joiner
```

(`clsx` as a dep exists too — `"clsx": "^2.1.1"` in package.json — but utils has its own local version. Could collapse; not urgent.)

## Potential refactor

- The 8-label and 11-label vibe scales diverging is a small smell. Unify into one source of truth — probably a single exported map keyed by integer 0-10, with an optional `short` / `full` variant.
- Same for vibe color — the 11-step discrete in `vibeToColor` vs. the 8-stop gradient in `tailwind.config.ts::bg-vibe-gradient`. See [[Vibe Gradient]].

## Links

- [[Vibe Spectrum]]
- [[Vibe Gradient]]
- [[Data Flow]]
- [[Content Types]]
