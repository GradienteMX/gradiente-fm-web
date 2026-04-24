---
type: module
status: current
tags: [hook, context, state, url]
updated: 2026-04-23
---

# useOverlay

> The context + hook that drives the [[Overlay System]]. Holds the open slug + click-origin rect, and syncs the URL via `history.replaceState`.

## Source

[components/overlay/useOverlay.tsx](../../components/overlay/useOverlay.tsx)

Lives in `components/overlay/` (not `context/`) because it's tightly coupled to the overlay feature. [[VibeContext]] stays in `context/` because it's app-wide UI state.

## API

```ts
interface OverlayOrigin { x: number; y: number; width: number; height: number }

function useOverlay(): {
  openSlug: string | null
  open: (slug: string, rect?: OverlayOrigin) => void
  close: () => void
  originRect: OverlayOrigin | null
}
```

Plus an `<OverlayProvider>` that wraps the app (mounted in [app/layout.tsx](../../app/layout.tsx) inside `<VibeProvider>`).

## Why not `useRouter` + `useSearchParams`

First version used Next.js `router.replace('?item=...')`. That fires an RSC refetch (you can see them in devtools as `?_rsc=...` requests), which re-renders the page tree and was remounting the overlay mid-animation. Animations would play partway then restart.

Current version uses `window.history.replaceState` directly. The URL still updates, back/forward still work (via `popstate`), but there's no server roundtrip. The overlay just lives and dies based on local React state.

Tradeoff: the URL change isn't visible to server components, so SSR can't pre-render the overlay for `?item=...` deep-links. Instead, `OverlayProvider` reads the URL on mount (`useEffect`) and populates state client-side. This means an extra paint on first load — acceptable for MVP.

## Mechanics

```ts
function OverlayProvider({ children }) {
  const [openSlug, setOpenSlugState] = useState<string | null>(null)
  const [originRect, setOriginRect] = useState<OverlayOrigin | null>(null)

  // Hydrate from URL on mount + listen for back/forward.
  useEffect(() => {
    setOpenSlugState(readSlugFromUrl())
    const h = () => setOpenSlugState(readSlugFromUrl())
    window.addEventListener('popstate', h)
    return () => window.removeEventListener('popstate', h)
  }, [])

  const setOpenSlug = useCallback((slug) => {
    setOpenSlugState(slug)
    writeSlugToUrl(slug) // history.replaceState
  }, [])

  // ...provide
}
```

`open(slug, rect)` sets both the origin rect (used by [[OverlayShell]] for `transform-origin`) and the slug (triggers [[OverlayRouter]]).

`close()` clears both.

## URL contract

The URL param is `?item=<slug>`. Reading/writing goes through:

```ts
function readSlugFromUrl() {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('item')
}

function writeSlugToUrl(slug) {
  const url = new URL(window.location.href)
  if (slug) url.searchParams.set('item', slug)
  else      url.searchParams.delete('item')
  window.history.replaceState(window.history.state, '', url.toString())
}
```

`replaceState` (not `pushState`) so closing the overlay doesn't add a history entry. Trade-off: browser back can't "close the overlay" by popping — it exits the site. Acceptable; ESC / X / backdrop already cover close.

## Consumers

- [[OverlayRouter]] — reads `openSlug`
- [[OverlayShell]] — reads `originRect` for `transform-origin`, calls `close()` from ESC/backdrop/X
- [[ContentCard]] — calls `open(slug, rect)` on click
- [[HeroCard]] — calls `open(slug, rect)` on click

## Links

- [[Overlay System]]
- [[OverlayShell]]
- [[OverlayRouter]]
- [[VibeContext]]
