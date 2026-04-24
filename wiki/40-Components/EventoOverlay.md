---
type: component
status: current
tags: [component, overlay, evento]
updated: 2026-04-23
---

# EventoOverlay

> Event overlay. Flyer-as-hero on the left, rich event metadata on the right (date, venue, lineup, price, tickets CTA). The flyer is the artifact here — opposite stance to [[ReaderOverlay]].

## Source

[components/overlay/EventoOverlay.tsx](../../components/overlay/EventoOverlay.tsx)

## Client component? Yes

(Renders inside [[OverlayShell]] which requires `'use client'` context.)

## Layout

Desktop — two columns, flyer prominent:

```
┌────────────────────────┬──────────────────────────────────────┐
│                        │ [★ EDITORIAL]                        │
│                        │                                      │
│   FLYER (aspect 4:5)   │ FASCiNOMA 2026                       │
│                        │ Espacio al aire libre CDMX · …       │
│   [date block          │                                      │
│     MAY                │ ───────────────────────────────────  │
│      22                │ 📅 FECHA     jueves 22 de mayo …     │
│     JUE]               │ 🕐 HORA      14:00 – 23:59           │
│                        │ 📍 LUGAR     Espacio TBA             │
│                        │ 🎫 PRECIO    $1,800 – $4,500         │
│                        │ ⚡ VIBE      7 · VOLCÁN               │
│                        │ ───────────────────────────────────  │
│                        │ LINE-UP                              │
│                        │ Surgeon · Donato Dozzy · Sicaria …   │
│                        │                                      │
│                        │ excerpt                              │
│                        │                                      │
│                        │ [genre chips] [tag chips]            │
│                        │                                      │
│                        │ [ 🎫 COMPRAR BOLETOS → ]             │
└────────────────────────┴──────────────────────────────────────┘
```

Mobile: columns stack (flyer first, info below).

## Why flyer-as-hero here

For eventos, the flyer **is** the editorial artifact. Event posters carry the scene's visual language — typography, design, grain, era signals — and are often what the user remembers from the flyer on Instagram or Telegram. Demoting it to a thumbnail would erase content.

This stance is the opposite of [[ReaderOverlay]] and it's intentional. See [[Reader Terminal Layout]] for the per-type philosophy.

## Data mapping

Consumes the event fields on [[types|ContentItem]]:

| Field | Renders |
|---|---|
| `imageUrl` | Full-height flyer column (aspect 4/5 mobile, full on desktop) |
| `date` / `endDate` | Date block + `FECHA` + `HORA` rows |
| `venue` / `venueCity` | `LUGAR` row (city below venue) |
| `price` | `PRECIO` row |
| `artists[]` | `LINE-UP` section |
| `excerpt` | Paragraph below lineup |
| `genres` / `tags` | Chips at the bottom |
| `ticketUrl` | `COMPRAR BOLETOS` CTA — the one intentional external escape hatch |
| `editorial` | `★ EDITORIAL` badge above the title |

## The tickets CTA

External URLs are not part of the "contained" interaction model — they're explicit user choices. The CTA is styled as a deliberate secondary action (red border, external-link icon) so it's clearly a "leave the site" affordance, not the primary path. See [[Contained Single Surface]] for the rule.

## Links

- [[Overlay System]]
- [[OverlayShell]]
- [[ReaderOverlay]]
- [[Reader Terminal Layout]]
- [[Contained Single Surface]]
- [[Content Types]]
