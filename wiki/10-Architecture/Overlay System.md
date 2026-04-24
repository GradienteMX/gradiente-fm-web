---
type: architecture
status: current
tags: [overlay, ux, routing, url-state]
updated: 2026-04-23
---

# Overlay System

> Card click → full-screen overlay over the grid. No route changes. URL updates via `?item=<slug>` for deep-linking. The site feels like one continuous surface.

## What

Every `ContentCard` and the [[HeroCard]] opens a full-screen overlay when clicked. The overlay expands over the existing page (dim + blur backdrop) and shows a type-specific reading or event panel. Closing returns the user to the same grid state they came from.

The system has four moving parts:

```
[card click]
     │  open(slug, rect)
     ▼
[[useOverlay]] context  ← stores openSlug + click-origin rect
     │  + history.replaceState(?item=<slug>)
     ▼
[[OverlayRouter]]       ← reads openSlug, runs mount/exit state machine
     │
     ▼
[[OverlayShell]]        ← backdrop, chrome, CRT boot-in animation, close affordances
     │
     ▼
type-specific overlay   ← [[ReaderOverlay]] | [[EventoOverlay]] | [[GenericOverlay]]
```

## Why

See [[Contained Single Surface]] for the UX thesis. Routes would leave the grid; modals/overlays stay on the grid. The "contained" feeling is load-bearing, not decorative.

A URL param (not route) was chosen so:
- editorials + events are shareable (copy URL → link opens overlay on mount)
- back/forward still work via `popstate`
- but the page itself never navigates, so grid state and animations stay smooth

Initial attempt used Next.js `router.replace()` to sync the URL. That triggered RSC roundtrips that remounted the overlay mid-animation. Swapped to `window.history.replaceState` + a local `openSlug` state — pure client-side, no server refetch. See [[useOverlay]].

## How

### Entry

Cards and the hero both call `open(slug, rect)` on click:

```ts
const { open } = useOverlay()
const ref = useRef<HTMLElement>(null)

const handleOpen = () => {
  const rect = ref.current?.getBoundingClientRect()
  open(item.slug, rect ? { x, y, width, height } : undefined)
}
```

The `rect` is captured so the CRT boot-in can grow from roughly where the card lived (via `transform-origin`).

### State machine

[[OverlayRouter]] keeps two pieces of state:

- `mounted: ContentItem | null` — the overlay currently in the DOM
- `exiting: boolean` — whether it's playing its exit animation

When `openSlug` changes, `useEffect` drives the transitions:

| Before | After | Transition |
|---|---|---|
| null | new item | mount new, `exiting: false` |
| item A | null | `exiting: true`, wait for `onExited`, unmount |
| item A | item B | `exiting: true`, wait for `onExited`, then mount B |

`onExited` is called by [[OverlayShell]] when the backdrop's CSS `overlay-backdrop-out` animation fires `animationend`. This way the state machine is driven by the animation itself, not a `setTimeout`.

### Type routing

Inside `renderByType(item)`:

| Type | Overlay |
|---|---|
| `evento` | [[EventoOverlay]] — flyer-as-hero, event metadata prominent |
| `editorial` / `review` / `opinion` / `noticia` | [[ReaderOverlay]] — article-first, flyer demoted to rail |
| `mix` / fallback | [[GenericOverlay]] — placeholder until a dedicated `MixOverlay` ships |

Per-type rather than one unified shell. Gives each content type the latitude to differ visually. See [[Reader Terminal Layout]] for the shared reading philosophy.

### Animation

Pure CSS keyframes defined in [app/globals.css](../../app/globals.css):

- `overlay-backdrop-in/out` — dim + blur fade
- `overlay-panel-in` — CRT boot-in (horizontal line collapse → vertical expand → brightness settle)
- `overlay-panel-out` — mirror of the above, compressed
- `overlay-phosphor-in` — one-shot radial orange flash on mount

Framer Motion was tried first but animations were not firing reliably in this setup. CSS keyframes are simpler and sufficient for the current motion vocabulary.

### URL deep-linking

[[useOverlay]] reads `?item=<slug>` on mount and subscribes to `popstate`. So:

- Loading `/?item=foo` hydrates with the overlay open.
- Copying the URL while the overlay is open and pasting it in a new tab → same state.
- Back/forward navigate between `/` and `/?item=<slug>` states.

## Invariants

- Only one overlay open at a time (state is a single slug).
- `partner` type never opens an overlay — partners live in [[PartnersRail]] and are not clickable-into.
- Body scroll is locked while open (via `document.body.style.overflow`); restored on unmount.
- Section navigation (`/agenda`, `/editorial`, …) still uses Next.js routes. "Contained" applies to **content consumption**, not section switching.

## Links

- [[useOverlay]]
- [[OverlayShell]]
- [[OverlayRouter]]
- [[ReaderOverlay]]
- [[EventoOverlay]]
- [[GenericOverlay]]
- [[Contained Single Surface]]
- [[Reader Terminal Layout]]
- [[ContentCard]]
- [[HeroCard]]
