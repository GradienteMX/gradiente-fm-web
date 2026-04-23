---
type: component
status: current
tags: [component, calendar, sidebar, filter]
updated: 2026-04-22
---

# CalendarSidebar

> Slide-in month calendar. Shows event dots per day. Selecting a day pins matching items to the top of the [[ContentGrid]].

## Source

[components/CalendarSidebar.tsx](../../components/CalendarSidebar.tsx)

## Client component? Yes

Owns `viewMonth` state and reads/writes [[VibeContext]] for `selectedDate` and `calendarOpen`.

## Anatomy

- **Toggle button** — fixed to left-center, always visible. Calendar icon inside a right-open tab.
- **Panel** — 240px wide, slides in from left (`translate-x` transition, 300ms).
- **Header** — `CALENDARIO` label + close `X`.
- **Month nav** — `<` / `MES YYYY` / `>`, localized Spanish month names.
- **Day grid** — Monday-first week (Spanish convention). Day headers `L M M J V S D`.
- **Event dots** — small orange dot under a day if any event's `date` falls on that day. Uses `eventDates` prop.
- **Selected date chip** — under the grid, shows the formatted date + a dismiss button.
- **Footer hint** — `"Los puntos naranjas indican eventos."`
- **Backdrop** — blurred overlay, click-to-close when panel is open.

## Interaction

- Click a day → set `selectedDate`
- Click the same day again → clear `selectedDate`
- Other-month days are disabled
- Today is highlighted with `text-vibe-cool`
- Selected day gets `bg-vibe-cool/20` + full color text + dot in `vibe-cool` instead of `vibe-hot`

## Where it's used

- [[Home]] — integrates with the mosaic for day-pinning via [[ContentGrid]]
- [[Agenda]] — same behavior, scoped to events

Not rendered on the text-only category pages ([[Editorial]], [[Mixes]], [[Noticias]], [[Reviews]]).

## Links

- [[VibeContext]]
- [[ContentGrid]]
- [[Home]]
- [[Agenda]]
