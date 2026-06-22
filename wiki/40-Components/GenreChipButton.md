# GenreChipButton

> `components/genre/GenreChipButton.tsx` — clickable genre chip that sets the global genre filter and lands on home.

## What it does

Wraps any genre label (or custom children) in a `<button>` that:

1. Calls `setGenreFilter([genreId])` — replaces the active genre set rather than toggling (additive multi-select belongs to the VibeSlider chip strip)
2. Calls `close()` on [[useOverlay]] — dismisses any open overlay
3. Navigates to `/` if not already there

Works identically whether triggered from a card chip on the home grid or from inside an overlay. Composes with `categoryFilter` — both can be active simultaneously (e.g. category=mix + genre=techno).

## Props

| Prop | Type | Notes |
|------|------|-------|
| `genreId` | `string` | Looked up in [[genres]] via `getGenreById` |
| `className` | `string?` | Per-site visual styles (color, bg, border) take precedence over hover utilities |
| `style` | `CSSProperties?` | |
| `children` | `ReactNode?` | Defaults to `genre.name` |

## Interaction design

`stopPropagation` + `preventDefault` on click so the chip doesn't bubble to the parent card (which would open an overlay or navigate elsewhere).

Hover signal: `scale-110 brightness-150` — tells users the chip is interactive without the card surface behaving like a chip.

## Related

- [[VibeContext]] — `setGenreFilter` lives here
- [[VibeSlider]] — the additive multi-genre toggle strip
- [[ContentCard]] — primary consumer on card chips
- [[genres]] — `getGenreById` lookup
