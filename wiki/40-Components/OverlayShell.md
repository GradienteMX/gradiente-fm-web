---
type: component
status: current
tags: [component, overlay, chrome]
updated: 2026-05-21
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

- **ESC** — global `keydown` listener. If the comments column is open, ESC collapses *that* first; second ESC closes the overlay.
- **X button / `[ESC] CERRAR`** — top-right of the session bar
- **Click backdrop** — the outer `onClick` fires `close()`; the inner panel uses `stopPropagation` so clicks inside don't bubble

Not implemented (flagged for follow-up):
- Swipe-down on mobile — skipped for v1 to avoid conflicts with inner scroll.

## Keyboard shortcuts

- **`ESC`** — collapse comments first, else close overlay (see above)
- **`c` / `C`** — toggle the comments column. Ignored when focus is in any `input` / `textarea` / `contentEditable` so the composer still receives the letter; also ignored with any modifier (`⌘ / Ctrl / Alt`) held to avoid clobbering native bindings.

## Comments rail button + `useOverlayShell()` context

The vertical "terminal tab" anchored to the wrapper's right edge is the primary way to reach the discussion. Visible on `sm+` only — mobile users reach comments via the in-body DISCUSIÓN entry in [[ReaderOverlay]] + the `[C]` keystroke.

At-rest design is a live system readout:

```
┌─────┐
│ 00  │  ← zero-padded count (or ·· while loading)
│  ▢  │  ← MessageSquare icon
│  C  │
│  O  │
│  …  │  ← COMENTARIOS (or OCULTAR when open)
│ ● N │  ← presence dot + count, only when N > 0
└─────┘
```

- Closed-state colors: text `#FF9A33`, border `rgba(249,115,22,0.55)`, bg `#0a0a0a` — orange-on-rest so the button reads as a CTA, not chrome.
- Open + hover-state: text + border full `#F97316`, bg `rgba(249,115,22,0.08–0.12)`.
- Hover slides the button 8px inward + brightens.
- Size: 44×220px minimum, `font-mono text-[12px]`, `MessageSquare size=14`.

The count is live (Supabase realtime via [[useComments]]) and available to children through a shell-scoped React context:

```ts
const { commentsOpen, setCommentsOpen, commentsTotal, commentsLoading, comments, commentsUsersById } = useOverlayShell()
```

Why context: the count needs to be visible *before* the user opens the column (rail button + metadata row + footer all show it at rest). Lifting `useComments(item.id)` to the shell makes one subscription serve every consumer. [[CommentsColumn]] reads the comments + users out of this context instead of calling the hook itself — two `useComments` calls for the same itemId would both subscribe to the realtime channel `comments:${itemId}` and the second would crash. The context is the dedupe.

**SWC parser gotcha for context providers.** The shell's `<OverlayShellContext.Provider value={{ ...inline object }}>` was rejected by Next 14's SWC ("Unexpected token X. Expected jsx identifier") despite the same shape working elsewhere in the codebase. The workaround: extract the value into a `const shellCtxValue = { ... }` above the return so the JSX reads `<OverlayShellContext.Provider value={shellCtxValue}>` — a single identifier reference. Apply this shape if you hit the same error on another provider.

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
