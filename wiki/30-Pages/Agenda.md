---
type: page
status: current
tags: [page, events, agenda]
updated: 2026-04-22
---

# Agenda — `/agenda`

> Events-only view. Date-forward. Keeps the sidebar calendar.

## Source

[app/agenda/page.tsx](../../app/agenda/page.tsx)

## What

Filters `MOCK_ITEMS` to `type === 'evento'` via `filterForCategory`, sorted **descending** by date. Renders via [[ContentGrid]] in `mode="category"`.

Unlike the home page, this view:
- Keeps the [[CalendarSidebar]] (events-only page → calendar is maximally useful here).
- Drops the category rail and partners rail (cleaner focus).
- Does **not** get the pinned hero (hero is for editorial content).

## Copy

Header: `AGENDA · EVENTOS · {count} ENTRADAS · HOY → PASADO`
Empty: `// SIN EVENTOS EN ESTE RANGO`

The `HOY → PASADO` tagline is slightly misleading — events are actually sorted descending (newest first at the top). Worth reviewing. See [[Open Questions]].

## Links

- [[ContentGrid]]
- [[CalendarSidebar]]
- [[Content Types]]
- [[utils]]
