---
type: domain
status: current
tags: [hero, portada, editorial]
updated: 2026-09-10
---

# Pinned Hero → Portada Carousel

> **2026-09-10 — DECISION REVERSED (ikerio, pending lead sign-off).** The portada is now a **carousel of every pinned item, any content type except franja**, plus admin one-click pin/unpin from the feed. The original 2026-04-22 reasoning below argued for exactly one, text-only slot ("a carousel of five makes it five things to skim"). It is kept for the record; the counter-argument that won today: one frame still shows one piece at a time, the dwell (9 s) keeps its weight, and the team wanted events and mixes to be able to headline.

## What (current)

- Selection: [`getPortada`](../../lib/utils.ts) → all `pinned` items except franjas, newest first; if none, the newest editorial-flagged text piece stands in alone. `getPinnedHero` is kept as "first slide" for callers.
- Frame: [HeroCarousel](../../components/HeroCarousel.tsx) — the same mechanics as [[EventosRail]]: a native horizontal scroll track with full-width snap slides, so auto-advance (9 s dwell), the ‹ › keys, trackpad swipe and touch drag all move one property and cooperate. First slide cloned at the end for a seamless wrap. Paused on hover/focus, hidden tab, the reader's ❚❚ key, and for 4 s after any manual gesture; reduced motion disables auto-advance and jumps instantly. Off-screen slides drop out of the tab order. The category filter narrows the set in place. The kicker prints `EN PORTADA · n/N`; the hero's admin key only ever removes.
- Slides adapt their byline: events print date + venue and «VER EVENTO →», mixes print series/duration and «ESCUCHAR →», text keeps author + reading time.
- All pinned items are excluded from the mosaic (`app/page.tsx`).

## Who can pin

- **Staff in the composer**: «Fijar en portada» in the review rail of all eight composers (`ComposeRail`, `showPin`). Non-staff never see it and the publish route ignores `pinned` from them.
- **Admins from the feed**: [PortadaToggle](../../components/portada/PortadaToggle.tsx) — a «⌖ PORTADA» chip in every card's chip row, «QUITAR DE PORTADA» on the hero, and a key in the overlay header beside ELIMINAR. One click → `PATCH /api/admin/items/[id]/portada` → `router.refresh()`; the piece moves between mosaic and carousel without a reload. Admin-only (`canAssignRoles`); `pinned` is a declarative flag, so no ledger row.
- The single-slot "unpin the others" rule from earlier today was removed again the same day.

## Still deliberate

Franjas never enter. `pinned: true` remains a promise about editorial cadence — rotate the set, don't churn it daily.

---

## Historical — the single-slot decision (2026-04-22)


> Exactly one item holds the portada slot on the home page. Chosen by `pinned: true`, with an editorial fallback.

## What

The home page renders a [[HeroCard]] above the main mosaic. The hero is picked by [`getPinnedHero`](../../components/HeroCard.tsx):

```ts
function getPinnedHero(items): ContentItem | null {
  // 1. Most recent pinned item in {editorial, review, noticia, opinion}
  // 2. Fallback: most recent editorial-flagged item in the same set
  // 3. Else: null
}
```

## Constraints

- **Only one.** If multiple items have `pinned: true`, the most recent `publishedAt` wins.
- **Text types only.** Eligible: `editorial`, `review`, `noticia`, `opinion`. **Not**: `evento`, `mix`, `franja`. The hero is about editorial voice — events and mixes don't belong in portada.
- **Hero is removed from the grid** to avoid double-rendering. See [app/page.tsx:18-21](../../app/page.tsx).

## Why exactly one

A portada with rotating features loses its weight. The hero is the thing the editor wants you to read this week. A carousel of five makes it five things to skim.

The header even says so: `//EN PORTADA · SE ACTUALIZA SEMANALMENTE`.

## Why the type restriction

Events have their own prominence via imminence bonus (see [[HP Curation System]]) — they dominate the top of the grid near their date without needing hero placement. Mixes are listened-to, not read. The hero is for long-form editorial content.

## Structure of a hero

From [[HeroCard]]:

- **Left:** image (45% width on desktop, full width on mobile), vibe-colored left edge, type badge, NGE corner bracket.
- **Right:** meta row (author, date, read time, subtitle) → title → body paragraphs (from `bodyPreview.split('\n\n')`) → genre/tag chips → CTA button.

Body preview is multi-paragraph by splitting on double newlines. The first paragraph gets a heavier text style; subsequent paragraphs dim. Paragraphs 3+ are hidden on mobile.

## How to change the portada (2026-09-10)

Until 2026-09-10 **nothing in the UI could write `pinned`**: the composer rail only exposed the editorial flag, `/admin` only displayed a FIJADO chip, and no PATCH route touched the column — so the hero stayed on whatever row the seed had pinned, with the "most recent editorial text piece" fallback the only way it ever moved. Now:

- Staff (guide/admin) see **«Fijar en portada»** in the review rail of the four hero-eligible composers (editorial · review · noticia · opinion) — [ComposeRail.tsx](../../components/dashboard/compose/editor/ComposeRail.tsx). Non-staff never see it; the route ignores `pinned` from them.
- `POST /api/items` keeps the single-slot invariant: when staff publish with `pinned: true` it **unpins every other row** (service-role update), so the toggle always wins. Unpinning the current hero falls through to the newest editorial-flagged text piece.
- The home is `force-dynamic`; with `staleTimes.dynamic = 0` in `next.config.mjs` the next client navigation refetches it, so the new portada shows immediately.

Still deliberate: events, mixes, artículos and listicles are not hero-eligible (`getPinnedHero` in `lib/utils.ts`). Widen `heroTypes` there if the team wants longform artículos in portada.

## Authoring tips

- **Use `bodyPreview`, not `excerpt`, for heroes.** `excerpt` is a one-liner for cards; `bodyPreview` is a proper multi-paragraph teaser.
- **Match image to subject, not to vibe.** The vibe color already shows as the accent — the image can be thematic.
- **`pinned: true` is a promise** to leave it up for the editorial cadence (weekly-ish). Don't flip pinned items daily.

## Links

- [[HeroCard]]
- [[Editorial Flag]]
- [[Home]]
- [[Content Types]]
