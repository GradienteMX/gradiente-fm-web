---
type: component
status: current
tags: [component, overlay, chrome]
updated: 2026-04-23
---

# OverlayShell

> The frame for every overlay. Handles backdrop, session chrome, close affordances, body scroll lock, and the CRT boot-in/out animations. Type-specific overlays render inside it.

## Source

[components/overlay/OverlayShell.tsx](../../components/overlay/OverlayShell.tsx)

## Client component? Yes

Needs `useEffect` for scroll lock + ESC key + `onAnimationEnd`.

## Structure

```
┌──────────────────────────────────────────────────────────────────────┐
│  dim + blur backdrop (fixed inset-0 bg-black/75 backdrop-blur-md)   │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ //TYPE · slug · [spacer] · ● ONLINE · [ESC] CERRAR             │ │ ← session bar
│  ├────────────────────────────────────────────────────────────────┤ │
│  │                                                                │ │
│  │              {children} — type-specific overlay                │ │ ← scrollable
│  │                                                                │ │
│  ├────────────────────────────────────────────────────────────────┤ │
│  │ (phosphor flash — fades out on enter, one-shot)                │ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

The panel uses `.eva-box` + `.eva-scanlines` for NGE chrome.

## Props

```ts
interface OverlayShellProps {
  item: ContentItem
  exiting: boolean       // set by OverlayRouter when the overlay should play exit
  onExited: () => void   // called when exit animation completes; triggers unmount
  children: ReactNode
}
```

`exiting` + `onExited` are the contract with [[OverlayRouter]]'s state machine. See [[Overlay System]].

## Animations

Driven by CSS classes, not Framer Motion. On mount → `overlay-backdrop-in` + `overlay-panel-in` + `overlay-phosphor-in`. On `exiting=true` → `overlay-backdrop-out` + `overlay-panel-out`. The backdrop's `animationend` for the `out` keyframe is what fires `onExited`.

Keyframes live in [app/globals.css](../../app/globals.css):

- `overlay-panel-in` — 0% scaleY 0.005 scaleX 0.35 brightness 3.5 → 25% horizontal line full-width → 60% scaleY 1.02 overshoot → 100% rest. The CRT boot signature.
- `overlay-phosphor-in` — radial orange glow, fades 0.95 → 0 over 600ms.
- `overlay-backdrop-in/out` — simple opacity.
- `overlay-panel-out` — mirror of `-in`, 240ms.

`transform-origin` is set to the clicked card's center point (from [[useOverlay]]'s `originRect`) so the grow effect roughly emanates from where the card was.

## Close affordances

- **ESC** — global `keydown` listener calls `close()` from [[useOverlay]]
- **X button / `[ESC] CERRAR`** — top-right of the session bar
- **Click backdrop** — the outer `onClick` fires `close()`; the inner panel uses `stopPropagation` so clicks inside don't bubble

Not implemented (flagged for follow-up):
- Swipe-down on mobile — skipped for v1 to avoid conflicts with inner scroll.

## Body scroll lock

On mount: `document.body.style.overflow = 'hidden'`. Restored on unmount.

## Chrome / header

The session bar shows:

- `//TYPE` in category color (from [[Color System]])
- `item.slug` uppercased, truncated, muted
- `● ONLINE` indicator (green pulsing dot + label)
- `[ESC] CERRAR` button

This is the one chrome shared by every overlay. Type-specific overlays render their own reader/event layouts inside the scrollable body.

## Links

- [[Overlay System]]
- [[OverlayRouter]]
- [[useOverlay]]
- [[ReaderOverlay]]
- [[EventoOverlay]]
- [[Contained Single Surface]]
- [[NGE Aesthetic]]
