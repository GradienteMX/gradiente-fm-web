---
type: domain
status: current
tags: [hero, portada, editorial]
updated: 2026-04-22
---

# Pinned Hero

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
- **Text types only.** Eligible: `editorial`, `review`, `noticia`, `opinion`. **Not**: `evento`, `mix`, `partner`. The hero is about editorial voice — events and mixes don't belong in portada.
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

## Authoring tips

- **Use `bodyPreview`, not `excerpt`, for heroes.** `excerpt` is a one-liner for cards; `bodyPreview` is a proper multi-paragraph teaser.
- **Match image to subject, not to vibe.** The vibe color already shows as the accent — the image can be thematic.
- **`pinned: true` is a promise** to leave it up for the editorial cadence (weekly-ish). Don't flip pinned items daily.

## Links

- [[HeroCard]]
- [[Editorial Flag]]
- [[Home]]
- [[Content Types]]
