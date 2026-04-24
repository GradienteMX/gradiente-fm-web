---
type: component
status: draft
tags: [component, overlay, fallback]
updated: 2026-04-23
---

# GenericOverlay

> Fallback overlay for any content type that doesn't have a dedicated overlay yet. Currently used for `mix`. Will be retired once each type gets its own.

## Source

[components/overlay/GenericOverlay.tsx](../../components/overlay/GenericOverlay.tsx)

## Client component? Yes

## Layout

Single column. `imageUrl` at top (16:9), metadata row, excerpt, bodyPreview paragraphs, tracklist (for mixes), genre/tag chips. Ends with a muted footer: `OVERLAY GENÉRICO · {TYPE} · PENDIENTE DE VISUAL DEDICADO` — a visible reminder that this type's real overlay hasn't been built yet.

## What it covers

| Type | Why it's here |
|---|---|
| `mix` | Needs a MixOverlay with embedded player + prominent tracklist + DJ bio. Not built yet. |
| (theoretical new types) | Lands here until a dedicated overlay ships. |

## Replacement plan

- **MixOverlay** — embedded player (SoundCloud or HTML5 `<audio>`), tracklist as the primary content block, DJ bio, vibe readout. The player should play inside the overlay (see [[Contained Single Surface]] — no new tab).

## Links

- [[Overlay System]]
- [[OverlayRouter]]
- [[ReaderOverlay]]
- [[EventoOverlay]]
- [[Open Questions]]
