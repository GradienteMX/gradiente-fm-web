---
type: component
status: current
tags: [component, card, mosaic, overlay]
updated: 2026-08-30
---

# ContentCard

> One card component, three size tiers (sm/md/lg), **two faces**: at rest every card is a poster (full-bleed artwork + title), on hover/keyboard-focus it CUTS to the dense caption card (meter, chips, meta, genres). Clicking opens a full-screen overlay — see [[Overlay System]].

## Source

[components/cards/ContentCard.tsx](../../components/cards/ContentCard.tsx)

## The two faces (2026-08-30)

Iker's call after fase B shipped: the caption-forward tiers made the feed read as text with small images, inverting the image-forward law. The fix keeps BOTH looks:

- **Poster face (rest)** — `PosterFace`, shared by all tiers: full-bleed `ArtPlate`, the **kicker dash** + title (+ subtitle on md/lg) seated on the ink scrim slab (`PANEL_SCRIM_GRADIENT`), `DateChip` beside the title for events, `SavedBadge` top-left. Nothing else. It is `aria-hidden` (no focusables inside) so screen readers hear one card, not two.
  - **Kicker dash** = the type signal at rest: a short category-colored rule (28px, 36px on lg × 4px) above the title, where a magazine kicker sits. Color-only is a *sanctioned bend* of the never-color-alone law: the poster is aria-hidden (AT reads the dense face's full swatch+code+word pairing) and the complete signal is one hover away. Uses `categoryColor` (lib/utils — the DARK-ground palette) because it sits on the ink scrim, not cream. Known alias: reseña/artículo ambers blur at glance level by design.
- **Dense face (hover/focus)** — the fase-B tier layouts (`SmCard`/`MdCard`/`LgCard`), absolutely positioned `inset-0`, revealed by the **«ficha» wipe** (`.card-face-dense` in globals.css): a bottom-to-top `clip-path` pass + 10px rise — the spec sheet fed through a platen, directional and mechanical, never a dissolve. Timing is asymmetric: in = 220ms `cubic-bezier(0.16,1,0.3,1)` after a **60ms hover-intent delay** (skimming the cursor across the mosaic must not strobe cards); out = 130ms, no delay. The card wrapper carries `overflow-hidden` to clip the sheet's rise mid-wipe. `prefers-reduced-motion` falls back to the instant cut. `:focus-within` mirrors `:hover` — covers both the wrapper's `tabIndex` focus and tabbing onto inner links, so every chip stays keyboard-reachable and keyboard users get the same pass.
- **Touch** — no hover exists; the tap opens the overlay, which carries the same info. The poster face is the whole mobile read.
- **`PollCardCanvas` rides the wrapper**, above both faces (chip z-20 / ballot z-30): the poll affordance stays visible at rest and an open ballot survives the pointer leaving the card.

**Egress trap**: both faces render the same artwork. `cardArtSizes(item, size)` produces ONE `sizes` string per card, used by both plates — diverging `sizes` attrs would make the browser download two resolutions of the same image per card (~140 cards). Keep them shared.

## Three tiers (the dense face)

### SM (1×1)
Side art plate (38%) + caption column: meter, chip row, title (3 lines), date/venue/author, up to 2 genres.

### MD (2×1 wide, 1×2 tall, or 1×1)
Side plate (42%) when the **rendered cell** is wide/square, top plate (45%) when tall. Orientation comes from ContentGrid (clamped `colSpan` vs `rowSpan`), NOT from the content type — `MD_GEOMETRY` is only the spawn shape and `rankItems`' SHAPE_CYCLE variety pass reassigns any type into any md shape. (The type-based inference was a real bug: a text type in a 150px wide bar used the tall layout and its line-clamped title — min-content ≈ 0 — collapsed to nothing. Titles now also carry `shrink-0` so they are never the first thing an overconstrained caption sacrifices.) Adds artists row, subtitle, meta row with icons (MapPin/Play/Clock/Ticket), CreatorChip.

### LG (2×2 / 3×2 featured)
Full-bleed art + scrim-overlaid title, bottom caption bar on paper: meter, chip row, excerpt, genre + tag chips, venue/city, price, TICKETS → button, read time.

The tier is picked by [`cardLayout(item).tier`](../../lib/curation.ts) and passed in as a prop. [[ContentGrid]] is the only wirer.

## Shared bits

- `ArtPlate` — the artwork zone (SmartImage `object-cover object-top`, low-alpha ink field when no image). No scrims except the LG/poster title slab, no hover zoom.
- `ChipRow` — type identity (swatch + full display label; the 2-letter code was dropped 2026-08-30 as redundant beside the word — «LI · LISTA» → «LISTA»), editorial ★, NUEVO (`.print-fresh` first hour, scraped events excluded), BORRADOR, PASADO, //FRANJA stamp, publisher-only HL chip.
- `CreatorChip` — @username → /u/[username] as a **stamped byline**: 1px ink hairline + hover fill-inversion, the clickable-chip grammar on paper. Deliberately distinct from the free-text `item.author` credit, which stays plain — clickable platform identity vs printed editorial credit are different registers.
- `CardMeter` — `VibeMeterLight` with `effectiveVibeBand(item)`, pads right when a poll chip could collide.
- `DateChip` — printed date block (mono month/day-name around a Syne day number), events only.

## Interaction

The top-level export wraps both faces in a clickable `role="button"` `<div>` that:

1. Captures the card's `getBoundingClientRect()` on click (overlay grow-from-origin).
2. Fires `recordHpEvent(item.id, 'click')` (fire-and-forget, anon 401s silently).
3. Calls `open(item.slug, rect)` from [[useOverlay]] → URL `?item=<slug>`.

Keyboard: `Enter` / `Space` trigger the same handler. Focus ring is the 2px ink outline.

Exception: `TICKETS →` on LG event cards is an `<a>` with `stopPropagation` — external escape hatch, per [[Contained Single Surface]].

## Links

- [[ContentGrid]]
- [[Overlay System]]
- [[useOverlay]]
- [[Contained Single Surface]]
- [[HP Curation System]]
