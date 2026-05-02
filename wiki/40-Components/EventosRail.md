---
type: component
status: in-use
tags: [components, home, scraper, agenda, rail]
updated: 2026-05-01
---

# EventosRail

> Auto-scrolling horizontal marquee of scraped events. Mounted under the [[HeroCard]] and above [[ContentGrid]] on `/`. Solves the "RA firehose floods the mosaic" problem — see [[Scraper Pipeline]] for the phase strategy.

## Why it exists

When [[Scraper Pipeline]] Phase 1 shipped (2026-05-01) it added 128 RA-scraped events to `MOCK_ITEMS`. They flooded the home grid: 190 cards total, mostly scraped. Same day fix was the rail.

The rail isolates scraped agenda content from the editorial mosaic. Editorial dominates home; scraped lives in its own surface; editor can pull individual scraped events back into the mosaic via `elevated: true`. This is [[Guides Not Gatekeepers]] arriving early.

## Behavior

- Filters input to `i.type === 'evento' && i.date != null` and sorts ascending by date (chronological "what's next").
- Renders each as a compact 180px-wide card in a flex row with `gap-2`.
- Cards duplicated (`[...sorted, ...sorted]`) so the seamless wrap is invisible (the second half is visually identical to the first; subtracting `scrollWidth/2` lands on a matching card).
- **Scroll model — rAF-driven `scrollLeft`, NOT CSS transform.** Originally shipped with `nge-ticker` keyframes, but Iker (correctly) noted that `overflow-hidden` + CSS marquee meant once a card scrolled past, you had to wait the full cycle to see it again. Replaced 2026-05-01 with a `requestAnimationFrame` loop nudging `track.scrollLeft` by `35 * dt` pixels per frame. Manual scroll (wheel, touch, drag) and auto-scroll cooperate on the same property — users can backtrack freely; auto-scroll resumes from wherever they left off.
- **Pause rules:**
  - Hovered or focus-within: paused indefinitely (set `stateRef.current.hovered = true` on `mouseenter` / `focusin`, false on the corresponding leave/out).
  - User-initiated scroll (`wheel` / `pointerdown` / `touchstart`): paused for 3s after last interaction (`stateRef.current.pausedUntil = now + 3000`).
- Edge fades on left + right (gradient to `bg-base`) signal off-screen content + soften the wrap seam. Native scrollbar is hidden (`scrollbar-width: none` for Firefox, `.evento-rail-track::-webkit-scrollbar { display: none }` in `globals.css` for WebKit) — auto-motion + edge fades carry the affordance.
- **Reduced-motion respect:** the rAF loop short-circuits when `matchMedia('(prefers-reduced-motion: reduce)').matches` is true. Manual scroll still works (wrapper is always `overflow-x-auto`); only the auto-nudge stops.
- Click → `useOverlay().open(slug, rect)` — same EventoOverlay flow as [[ContentCard]] (contained-single-surface UX).

## Card anatomy

Built inline (`EventoRailCard` — local to this file, not exported). Per-card layout:

- `aspect-[4/5]` image area, `object-cover` so flyer aspect ratios crop consistently
- `//EVENTO` label top-left in `categoryColor('evento')` red
- Date chip top-right: month / day / weekday in mono, three lines, white-on-black with `border-white/20`
- Title: `font-syne text-xs font-bold` clamped to 2 lines
- Venue: `font-mono text-[9px] text-muted` clamped to 1 line

Keyboard: button is the focusable element; Enter/Space triggers `onClick`. `aria-label="Abrir evento <title>"` for screen readers.

## Empty state

If `sorted.length === 0`, returns `null` — no header, no chrome. Other pages that don't have scraped events (any non-`/` route, or a future filtered view) won't see a stray rail.

## Header chrome

- `nge-divider` with calendar icon + `//AGENDA` in event red
- Right-aligned: pulsing `bg-sys-green` dot + `<count> EVENTOS · LIVE FEED · RA`
- Sub-line: `PRÓXIMOS · ORDEN CRONOLÓGICO · CLICK PARA DETALLE` in `sys-label` muted

## Where it's mounted

- [[Home]] page (`app/page.tsx`) — between the [[HeroCard]] and the main mosaic
- The page filters: `railEvents` = scraped + not-elevated; `gridItems` = everything else minus partners minus the hero. The `isRailEvent` predicate is the single source of truth for the split

## What it depends on

- `useOverlay` for the click handler
- `categoryColor('evento')` for the accent red
- `.evento-rail-track::-webkit-scrollbar { display: none }` rule in `globals.css` (hides the native scrollbar on WebKit)
- `lucide-react` Calendar icon

## Open follow-ups

- **//FUENTE · RA chip** — the rail currently shows `RA` in the header text but individual cards don't carry attribution. When the EventoOverlay gets the //FUENTE chip, the rail cards could mirror it.
- **Date-tab filter** — option (b) from the ship discussion: TONIGHT / TOMORROW / THIS WEEKEND tabs above the rail. Skipped for the first ship; revisit if the rail feels too undifferentiated.
- **Mobile pass** — desktop-validated. Mobile-viewport behavior of the marquee + reduced-motion fallback isn't tested yet (consistent with the broader [[Next Session]] mobile-pass debt).
