---
type: component
status: current
tags: [component, overlay, reader, articulo, longform]
updated: 2026-04-23
---

# ArticuloOverlay

> Longform reader for the `articulo` type — hero-led, sticky TOC rail, typographic rhythm (pull-quotes, Q&A, footnotes). Distinct from [[ReaderOverlay]] because the hero image is primary, not archival.

## Source

[components/overlay/ArticuloOverlay.tsx](../../components/overlay/ArticuloOverlay.tsx)

## Client component? Yes

Scroll progress tracking, active-section tracking for the TOC, section-anchor scrolling.

## Why a separate overlay

[[ReaderOverlay]] *demotes* the flyer to a sticky "ARCHIVO VISUAL" rail — the article body is the protagonist, the image is evidence. That works for `editorial` / `review` / `opinion` / `noticia`, where the flyer is often a lateral artifact (a gig flyer referenced by an editorial, say).

For `articulo` — substack-style deep-dives — the lead image is *part of the read*. So this overlay leads with it. Consistent with the repo's bias toward type-specific components over conditional unified layouts: a second reader with expressive latitude beats one reader with `if (type === 'articulo') …` branches.

Design reference: [firstfloor.substack.com](https://firstfloor.substack.com) — translated through Gradiente's terminal/vibe idiom (monospace meta, `//` prefixes, block-bar progress, hazard-stripe FIN marker).

## Layout

Desktop — 3-column inside [[OverlayShell]]'s scroll area:

```
┌────────┬──────────────────────────────────┬──────────────────┐
│ ÍNDICE │  [★ //ARTÍCULO]                  │  ┌────────────┐ │
│        │                                  │  │ 01 FIRMA   │ │
│ §01 …  │  BIG TITLE (Syne 5xl–6xl)        │  │  [AV] Name │ │
│ §02 …  │                                  │  └────────────┘ │
│ §03 …  │  vibe-colored dek (62ch)         │  ┌────────────┐ │
│        │                                  │  │ 02 CONTEXTO│ │
│ PROG.  │  ─ POR · FECHA · LECTURA · VIBE ─│  │  TIPO: ART.│ │
│ 34%    │                                  │  │  LECTURA   │ │
│ █████· │  [ HERO IMAGE · full-width ]     │  │  ESTADO    │ │
│        │  IMG·01 // caption     //ARTÍCULO│  │  SEÑAL ●   │ │
│        │                                  │  └────────────┘ │
│        │  drop-cap lede paragraph         │  ┌────────────┐ │
│        │  ───────────                     │  │ 03 TAGS    │ │
│        │  paragraphs…                     │  │  # genres  │ │
│        │  // Primero: el costo            │  │  # tags    │ │
│        │  paragraphs…                     │  └────────────┘ │
│        │  ┃ pull quote (vibe-colored)     │                 │
│        │  ┃ — attribution                 │                 │
│        │  Shawn: question (italic)        │                 │
│        │  Matías: answer (bold speaker)   │                 │
│        │  [inline figure · caption]       │                 │
│        │                                  │                 │
│        │  NOTAS //2                       │                 │
│        │  [1] footnote text               │                 │
│        │  [2] footnote text               │                 │
│        │                                  │                 │
│        │  ╱╲╱╲  FIN·DEL·ARTÍCULO          │                 │
├────────┴──────────────────────────────────┴──────────────────┤
│ //SIGUIENTES·LECTURAS ──────────── 3 · CURADO                │
│ [card]  [card]  [card]                                       │
├──────────────────────────────────────────────────────────────┤
│ SCROLL 34% [█████·········]  · MODO LECTURA · LONGFORM       │ ← sticky footer
└──────────────────────────────────────────────────────────────┘
```

Grid: `md:grid-cols-12` → `2 / 7 / 3`. On mobile, columns stack (title + hero + body + footnotes + rails + related), footer stays sticky.

## Structured body — `ArticleBlock[]`

The main differentiator from [[ReaderOverlay]]. `articulo` items carry a structured `articleBody` instead of (or alongside) `bodyPreview`. Rendered per-kind:

| `kind` | Renders as |
|---|---|
| `lede` | First paragraph, `19px` with a big drop-cap first letter (Syne, 64px). |
| `p` | Standard paragraph, Grotesk `17px` / line-height `1.82`. |
| `h2` | Syne bold `3xl` with `//` prefix in category color. `data-section-id` for TOC. |
| `h3` | Syne bold `xl`, no prefix. |
| `quote` | Pull-quote: vibe-colored left border, Syne bold italic `2xl`, optional `cite` footer. |
| `blockquote` | Inline block-quote: border-l, italic, smaller, secondary color. |
| `image` | Bordered `<figure>` with `IMG //` terminal caption. |
| `divider` | Ornamental `⋯ ─── ⋯` strip. |
| `qa` | Q&A interview format — speaker name in Syne bold, text. `isQuestion: true` adds a left-border + italicizes the body. |
| `list` | `ordered` → `<ol>` with decimals; otherwise `<ul>` with category-colored square bullets. |

Inline text supports **bold** via `**text**` and footnote refs via `[^id]` which render as a superscript anchor `[n]` linking to `#fn-<id>`.

Fallback: if `articleBody` is absent, `bodyPreview ?? excerpt` is split on `\n\n`, first paragraph becomes `lede`, rest become `p`.

## Footnotes

Rendered under "NOTAS // N" after the body, before the FIN marker. Each `<li id="fn-<id>">` is anchorable from inline `[^id]` refs. Counter numbering uses the order the refs appear (`refCount`), not the order they're listed in `footnotes[]` — so you can reorder the list without breaking refs.

## TOC rail

Left column, `md:sticky md:top-4`. Lists every `h2` block as `§01 · label`, clickable to scroll-anchor. Active section tracked via scroll listener on the ancestor `.overflow-y-auto`; the topmost heading above `scrollTop + 120` is marked active (category-colored).

Below the TOC: `PROGRESO XX%` + 14-block bar in category color, mirroring the sticky footer's style but in vertical form.

## Right rail — FIRMA / CONTEXTO / ETIQUETAS

Mirrors [[ReaderOverlay]]'s `ArchivalBlock` idiom (`RailBlock` here, local subcomponent):

- `01 FIRMA` — initials badge (category-colored) + author name + "DISPATCH · LONGFORM"
- `02 CONTEXTO` — key/value: `TIPO // ARTÍCULO`, `LECTURA`, `ESTADO: PUBLICADO`, `SEÑAL: ● ACTIVA`
- `03 ETIQUETAS` — genres (vibe-colored) + tags with `#` prefix

## Related reading

Below the article, `//SIGUIENTES·LECTURAS` — up to 3 curated picks via `getRelated(item)`:

1. Other `articulo` items, up to 3.
2. If fewer than 3, fill with editorial-family items (`editorial` / `review` / `opinion` / `noticia`) sharing at least one genre.

Rendered as `ContentCard` `size="sm"`. Clicking one swaps the overlay in place — the [[OverlayRouter]]'s state machine handles the exit/enter transition. The reader never leaves the contained surface. See [[Contained Single Surface]].

Non-algorithmic by design — no view counts, no engagement weights. See [[No Algorithm]] and [[Size and Position as Only Signals]].

## Data mapping

| Field | Source | Fallback |
|---|---|---|
| Title | `item.title` | required |
| Dek | `item.subtitle` | `item.excerpt` |
| Body | `item.articleBody` | paragraph-split `bodyPreview` / `excerpt` |
| Hero | `item.imageUrl` | figure hidden if absent |
| Hero caption | `item.heroCaption` | `'MATERIAL DE ARCHIVO'` |
| Footnotes | `item.footnotes` | section hidden if empty |
| Related | `getRelated(item)` against [[mockData]] | section hidden if 0 picks |

## What it deliberately does NOT do

- No engagement bar (likes, shares, comments) — contravenes [[Size and Position as Only Signals]].
- No subscribe CTA — subscriptions aren't part of the product, "Ready for more?" translates to curated `SIGUIENTES·LECTURAS`.
- Not eligible for the [[Pinned Hero]] — `heroTypes` in `getPinnedHero` deliberately excludes `articulo`. Articulos compete in the feed but don't auto-promote.
- No author bio block beyond the FIRMA initials card — deeper author profiles are out of MVP scope.

## Links

- [[Overlay System]]
- [[OverlayShell]]
- [[OverlayRouter]]
- [[ReaderOverlay]]
- [[Content Types]]
- [[Contained Single Surface]]
- [[Reader Terminal Layout]]
- [[Typography]]
- [[NGE Aesthetic]]
