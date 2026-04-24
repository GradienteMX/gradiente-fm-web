---
type: component
status: current
tags: [component, overlay, reader, editorial]
updated: 2026-04-23
---

# ReaderOverlay

> Terminal reader for long-form content. Article body is the protagonist; the flyer demotes to a sticky archival rail. Used for `editorial`, `review`, `opinion`, `noticia`.

## Source

[components/overlay/ReaderOverlay.tsx](../../components/overlay/ReaderOverlay.tsx)

## Client component? Yes

Scroll progress tracking, `F` key listener, flyer lightbox state.

## Layout

Desktop — 8/4 split inside [[OverlayShell]]'s scroll area:

```
┌─────────────────────────────────────────┬──────────────────────────┐
│  [★ EDITORIAL]                          │  ┌────────────────────┐ │
│                                         │  │ 01 ARCHIVO VISUAL  │ │
│  Big Syne title (3xl → 5xl)             │  │    // FLYER ORIG.  │ │
│                                         │  │  [ flyer preview ] │ │
│  dek (vibe-colored mono, 62ch)          │  │  [VER AMPLIADO]    │ │
│                                         │  └────────────────────┘ │
│  ─────────────────────────────────      │  ┌────────────────────┐ │
│  AUTOR · PUBLICADO · LECTURA · VIBE     │  │ 02 CONTEXTO        │ │
│  ─────────────────────────────────      │  │  VENUE  : ...      │ │
│                                         │  │  CIUDAD : ...      │ │
│  Body paragraph 1 (Grotesk, 1.8 lh)     │  │  ESTADO : PUBLICADO│ │
│                                         │  │  SEÑAL  : ● ACTIVA │ │
│  Body paragraph 2                       │  └────────────────────┘ │
│                                         │  ┌────────────────────┐ │
│  Body paragraph 3                       │  │ 03 ETIQUETAS       │ │
│                                         │  │  # Techno (Raw)    │ │
│  ─────────────────────────────────      │  │  # Industrial/EBM  │ │
│  [genre chips] [tag chips]              │  │  # ...             │ │
│                                         │  └────────────────────┘ │
└─────────────────────────────────────────┴──────────────────────────┘
│ SCROLL 24% [█████·······]  · MODO LECTURA · ACTIVO  [F] VER FLYER  │ ← sticky footer
└──────────────────────────────────────────────────────────────────────┘
```

Mobile: columns stack (article first, rail after), footer still sticky.

The rail is `md:sticky md:top-4 md:self-start` — stays visible as the article scrolls.

## Why this shape

See [[Reader Terminal Layout]] for the design thesis. Summary: the expanded card is a reading session, not a bigger card. The flyer is evidence inside the narrative (often referenced by the article itself), not a banner. Title + dek + first paragraph should land on the first viewport.

## Archival rail blocks

Uses a local `ArchivalBlock` subcomponent. Each block has:

- Numbered index (`01` / `02` / `03`)
- Label + optional sublabel (e.g. `ARCHIVO VISUAL // FLYER ORIGINAL`)
- Green signal dot (right-aligned)
- Body content

Three default blocks:

| Block | Content |
|---|---|
| `01 ARCHIVO VISUAL` | Flyer thumbnail, "FUENTE VISUAL · MATERIAL DE ARCHIVO" caption, `[VER AMPLIADO]` link |
| `02 CONTEXTO` | Key/value rows: `VENUE`, `CIUDAD`, `FIRMA`, `ESTADO: PUBLICADO`, `SEÑAL: ● ACTIVA`. Only shows rows with data. |
| `03 ETIQUETAS` | Genre + tag list with `#` prefix, genres in vibe color |

## Reading affordances

- **Scroll progress** — ref's `.closest('.overflow-y-auto')` ancestor is the scroll container; a listener updates `scrollPct`. Rendered as `XX%` + 12 block characters (`█` filled, `·` empty) in vibe color.
- **F key** — opens the `FlyerLightbox` (z-60, 90% black, click/ESC/F closes). Captures key with `capture: true` to suppress [[OverlayShell]]'s ESC when lightbox is open.
- **[F] VER FLYER** button in the sticky footer — same toggle.
- **Sticky footer strip** — `SCROLL XX%` + `MODO LECTURA · ACTIVO` + `[F] VER FLYER`. `position: sticky; bottom: 0` inside the scroll container.

## Data mapping

| Field | Source | Fallback |
|---|---|---|
| Title | `item.title` | required |
| Dek | `item.subtitle` | `item.excerpt` |
| Body | `item.bodyPreview` split on `\n\n` | `[CUERPO DE ARTÍCULO NO DISPONIBLE · CONTENIDO PENDIENTE DE INGESTA]` |
| Flyer | `item.imageUrl` | block hidden if absent |
| Context: venue/city | `item.venue`, `item.venueCity` | rows hidden if absent |
| Tags / genres | [`getGenreNames`, `getTagNames`](../../lib/genres.ts) | blocks hidden if both empty |

Does not yet consume a `body` field — [[Admin Dashboard]] and [[Supabase Migration]] proposes adding it. For MVP, `bodyPreview` is enough for visual validation.

## What it deliberately does NOT do

- No full-width hero flyer (the whole reason this component exists separately from [[EventoOverlay]]).
- No large title slab before metadata — metadata sits underneath title + dek, above body.
- No modal close button inside the body — close controls live in [[OverlayShell]]'s chrome.
- No per-user tracking or analytics hooks (consistent with [[No Algorithm]]).

## Links

- [[Overlay System]]
- [[OverlayShell]]
- [[OverlayRouter]]
- [[EventoOverlay]]
- [[Reader Terminal Layout]]
- [[Contained Single Surface]]
- [[Typography]]
- [[NGE Aesthetic]]
