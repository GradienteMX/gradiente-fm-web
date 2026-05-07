---
type: page
status: current
tags: [page, events, agenda]
updated: 2026-05-07
---

# Agenda — `/agenda`

> Events-only view. Date-forward.

## Source

[app/agenda/page.tsx](../../app/agenda/page.tsx)

## What

Filters items to `type === 'evento'` via `filterForCategory`, sorted by date. Renders via [[ContentGrid]] in `mode="agenda"` — future events first (soonest at top), then past events.

Unlike the home page, this view:
- Drops the category rail and partners rail (cleaner focus).
- Does **not** get the pinned hero (hero is for editorial content).

The slide-in calendar sidebar that used to live on this page (and Home) was retired 2026-05-07 — date-forward sort + the [[EventosRail]] marquee on home covered the same need without the modal friction.

## Copy

Header: `AGENDA · EVENTOS · {count} ENTRADAS · PRÓXIMOS · ARCHIVO ABAJO`
Empty: `// SIN EVENTOS EN ESTE RANGO`

## Links

- [[ContentGrid]]
- [[Content Types]]
- [[utils]]
