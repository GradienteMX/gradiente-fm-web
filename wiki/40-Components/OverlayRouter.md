---
type: component
status: current
tags: [component, overlay, state-machine]
updated: 2026-04-23-b
---

# OverlayRouter

> Reads `openSlug` from [[useOverlay]], runs a mount/exit state machine, picks the right type-specific overlay, wraps it in [[OverlayShell]]. Mounted once at the root layout.

## Source

[components/overlay/OverlayRouter.tsx](../../components/overlay/OverlayRouter.tsx)

Mounted inside [app/layout.tsx](../../app/layout.tsx) so it's available on every page.

## Client component? Yes

## The state machine

Two pieces of local state:

- `mounted: ContentItem | null` — the overlay currently in the DOM
- `exiting: boolean` — whether it's playing its `out` animation

A `useEffect` on `openSlug` drives transitions. The reason the router holds its own `mounted` (not just deriving from `openSlug`) is that the overlay needs to stay rendered during exit animation even after `openSlug` is cleared. Once the animation finishes, [[OverlayShell]] calls `onExited` and the router decides what to do next:

```ts
onExited={() => {
  const next = openSlug ? getItemBySlug(openSlug) : null
  if (next && next.slug !== mounted.slug) {
    setMounted(next)        // swap to the new overlay
    setExiting(false)
  } else {
    setMounted(null)        // fully close
    setExiting(false)
  }
}}
```

This handles three cases cleanly:

| Scenario | Flow |
|---|---|
| Open fresh | `mounted: null → item`, exit=false |
| Close | `mounted: item`, exit=true → onExited → `mounted: null` |
| Switch items | exit=true (old item) → onExited → `mounted: newItem`, exit=false |

## Type routing

```ts
function renderByType(item) {
  switch (item.type) {
    case 'evento':                                           return <EventoOverlay item={item} />
    case 'articulo':                                         return <ArticuloOverlay item={item} />
    case 'editorial':
    case 'review':
    case 'opinion':
    case 'noticia':                                          return <ReaderOverlay item={item} />
    default:                                                 return <GenericOverlay item={item} />
  }
}
```

`mix` still falls through to [[GenericOverlay]] until a dedicated MixOverlay lands (see [[Open Questions]]).

`articulo` has its own [[ArticuloOverlay]] (longform reader with TOC rail, pull-quotes, footnotes, related reading) — distinct from [[ReaderOverlay]] because its lead image is primary rather than archival.

## Lookup

Uses [`getItemBySlug`](../../lib/mockData.ts) — a simple `MOCK_ITEMS.find(i => i.slug === slug)`. Returns `null` on miss, which makes the overlay silently no-op on invalid `?item=` params. When we switch to Supabase this becomes `await getItemBySlug(slug)` — one-line change.

## Why not AnimatePresence

Earlier version used Framer Motion's `<AnimatePresence>` to coordinate mount/exit. The exit animation would play to completion but the component wouldn't unmount — a Framer Motion quirk in this setup that never reproduced cleanly. Replaced with the explicit state machine above. Mechanical, predictable, inspectable.

## Links

- [[Overlay System]]
- [[useOverlay]]
- [[OverlayShell]]
- [[ReaderOverlay]]
- [[ArticuloOverlay]]
- [[EventoOverlay]]
- [[GenericOverlay]]
- [[mockData]]
