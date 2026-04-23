---
type: module
status: current
tags: [module, context, state, client]
updated: 2026-04-22
---

# VibeContext

> Global client state: current vibe range, selected calendar date, calendar-open flag.

## Source

[context/VibeContext.tsx](../../context/VibeContext.tsx)

## Shape

```ts
interface VibeContextValue {
  vibeRange:      [number, number]
  setVibeRange:   (r: [number, number]) => void

  selectedDate:   Date | null
  setSelectedDate: (d: Date | null) => void

  calendarOpen:   boolean
  toggleCalendar: () => void
}
```

## Defaults

- `vibeRange`: `[0, 10]` — full range, no filter
- `selectedDate`: `null`
- `calendarOpen`: `false`

## Who writes to it

- [[VibeSlider]] → `setVibeRange`
- [[CalendarSidebar]] → `setSelectedDate`, `toggleCalendar`

## Who reads from it

- [[ContentGrid]] → uses `vibeRange` to filter, `selectedDate` to pin matches to the top
- [[ContentFeed]] → same (but unused, see [[Dual Feed Systems]])
- [[CalendarSidebar]] → self-read for active day highlight
- [[VibeSlider]] → self-read for current handles

## Provider

`<VibeProvider>` wraps `{children}` inside `app/layout.tsx` so it's available everywhere. See [[App Router Patterns]].

## Hook

`useVibe()` throws if called outside the provider. Fail-loud on misuse.

## Persistence

**None.** Refresh resets to defaults. If we want "remember last vibe range across sessions", localStorage sync would go here.

Intentional for now — the slider is intended as a momentary browse tool, not a saved preference.

## Links

- [[VibeSlider]]
- [[CalendarSidebar]]
- [[ContentGrid]]
- [[App Router Patterns]]
