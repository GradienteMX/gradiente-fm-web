---
type: component
status: current
tags: [overlay, listicle, track, embed]
updated: 2026-04-24
---

# ListicleOverlay

> Reader for the `listicle` content type — ranked/structured list features like "Top N tracks that defined X". Shares [[ArticuloOverlay]]'s `BodyBlocks` rendering pipeline.

## What

Renders when [[OverlayRouter]] receives an item with `type: 'listicle'`. File: [ListicleOverlay.tsx](../../components/overlay/ListicleOverlay.tsx).

Structure is a trimmed variant of [[ArticuloOverlay]]:

- Header — eyebrow `//LISTA` (orange `#FB923C`), title, subtitle/excerpt, byline strip (POR / FECHA / VIBE), plus an `NN ENTRADAS · COUNTDOWN / ASCENDENTE / SIN·RANGO` tag computed from the ranks of the `track` blocks in the body
- Hero image with optional caption
- Three-column reading area:
  - **Left rail:** `LISTA` mini-index listing each track (rank + artist · title) + scroll progress blocks
  - **Main column:** `<BodyBlocks />` imported from [[ArticuloOverlay]] — renders all standard article blocks plus the new `track` block
  - **Right rail:** FIRMA (author chip), META (tipo/entradas/orden/señal), ETIQUETAS
- Related lectures section (other listicles first, then articulo/editorial/review sharing a genre)
- Sticky scroll-progress footer

## Why

Listicle is conceptually a sibling of articulo — same `articleBody: ArticleBlock[]`, same prose primitives, plus the new `track` block variant. Two design choices worth naming:

1. **Distinct overlay rather than route 'listicle' → ArticuloOverlay.** Per the per-type-components-for-expressive-latitude preference (see user memory `feedback_customization_over_unification`). The visual differences are real: no TOC sidebar (the list *is* the structure), countdown/ascending tag in the header, META rail instead of CONTEXTO, "LISTA" rail instead of ÍNDICE of h2s.

2. **Shared `BodyBlocks`.** The body-rendering logic (lede drop-cap, paragraphs, h2/h3, quotes, images, dividers, lists, and the new track block) is exported from [[ArticuloOverlay]] and reused. This means any `articulo` can also embed track blocks — shared infrastructure, zero duplication.

## How

**Block rendering:** `import { BodyBlocks } from './ArticuloOverlay'`. The `track` block case lives inside `BodyBlocks` so both articulo and listicle pick it up.

**`track` block shape:**
```ts
{
  kind: 'track'
  rank?: number            // visual rank, e.g. 10..1 for countdown
  artist: string
  title: string
  year?: string | number
  bpm?: number
  imageUrl?: string        // cover art
  embeds?: MixEmbed[]      // shared with mix — SC/YT/SP/BC/Mixcloud
  commentary?: string      // editor's take, rendered as prose
}
```

**Track card layout:** 2-column CSS grid — rank column (96px on desktop, text-5xl rank digit) | main column (cover + artist/title/year/BPM, commentary prose, source link-out buttons). Border color `#F97316` matches the mix panel color for family coherence.

**Rank overflow fix (2026-04-24):** Originally `text-6xl` in an 80px column, the digits "05" etc. overflowed horizontally and cropped under the cover image. Adjusted to `text-5xl` in a 96px column — 5px text overflow absorbed by the grid gap, 11px clearance to the cover.

**Source buttons:** Rendered as `<a target="_blank">` link-outs, one per platform the track has. No tab state per track — all platforms are exposed as parallel escape hatches. Inline iframe embedding is deferred to the audio-context session.

**Rank direction heuristic:** `rankDirection = first.rank > last.rank ? 'countdown' : 'ascending'`. Shown in the header tag and META rail. Tracks with no rank fall through to `unranked`.

## Links

- [[ArticuloOverlay]] — shares `BodyBlocks`, shares hero/rail patterns
- [[Overlay System]]
- [[OverlayRouter]]
- [[Embed Primitive]]
- [[Content Types]]

## Open questions

- **Inline track embeds** — deferred to the audio-context session. Each track block could render an iframe (SC/YT/BC) instead of link-outs. Decided against for now because iframes lock us out of the reactive-audio vision; facade pattern recommended for the interim. See [[Open Questions]].
- **Listicle card treatment on the grid** — currently uses generic [[ContentCard]] with the `//LISTA` eyebrow. A numbered badge or "Top N" affordance could hint at the list format.
- **Listicle filter page** — no `/listicles` route yet; listicles live on the home feed and at deep-link URLs. Add a page if the content volume justifies.
