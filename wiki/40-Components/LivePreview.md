---
type: component
status: current
tags: [dashboard, preview, overlay-reuse]
updated: 2026-04-25
---

# LivePreview

> Right-pane preview in the [[Dashboard]] split view. Renders the in-progress draft `ContentItem` through its **real** overlay component inside a scaled-down panel that mimics [[OverlayShell]] without taking over the screen.

## Source

[components/dashboard/LivePreview.tsx](../../components/dashboard/LivePreview.tsx)

## What

Single component, props: `{ draft: ContentItem }`. Switches on `draft.type` and dispatches to the correct overlay:

| Draft type | Renderer |
|---|---|
| `mix` | [[MixOverlay]] |
| `listicle` | [[ListicleOverlay]] |
| `evento` | [[EventoOverlay]] |
| `editorial`, `review`, `opinion`, `noticia` | [[ReaderOverlay]] |
| (anything else) | [[GenericOverlay]] fallback |

## Chrome

Wraps the overlay output in a smaller `eva-box eva-scanlines` frame — same chrome as [[OverlayShell]] but constrained in height (`max-h: calc(100vh - 240px)`) so it fits beside the form on a desktop split view.

Adds a header strip:
- Left: `//PREVIEW` + slug
- Right: green `◉ LIVE` indicator

And a footer note explaining audio is visual-only in this preview (echoing the same caveat as the production overlays).

## Why reuse the production overlays

Single source of visual truth — what the editor sees in the dashboard preview is *the same component* the public will see when they click the card. No "preview-only" rendering pipeline that can drift from production. Edit the form, the preview updates synchronously through React state.

This is also why every form's submit just produces a `ContentItem` of the same shape mockData uses — the seam is the data, not the renderer.

## Limitations

- The preview's overlay components reference `useEffect`-based scroll listeners that look for an `.overflow-y-auto` ancestor. They mostly work inside the preview frame, but some scroll-triggered behaviors (TOC active section in [[ArticuloOverlay]], scroll-progress in [[ListicleOverlay]]) only update if you scroll the inner preview area.
- No keyboard shortcuts (the overlay's ESC etc. are deliberately not bound here — they'd conflict with the form).

## Links

- [[Dashboard]] · [[Dashboard Forms]]
- [[OverlayShell]] · [[OverlayRouter]]
- [[MixOverlay]] · [[ListicleOverlay]] · [[EventoOverlay]] · [[ReaderOverlay]]
