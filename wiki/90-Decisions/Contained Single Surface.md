---
type: decision
status: current
tags: [decision, ux, navigation, overlay]
updated: 2026-04-23
---

# Decision — Contained Single Surface

> The page is one continuous surface. Reading an article, watching a mix, or inspecting an event happens **on** the grid, never somewhere else.

## The rule

Clicking a card opens a full-screen overlay over the grid. **No route change. No external navigation as the default action.**

The site should feel like a single terminal/console you never leave, not a traditional website you navigate through.

## Why

Verbatim from the project lead (2026-04-23):

> "An essential part of the user experience is to make the page feel like everything is contained in a single spot, no page changes, no external links."

## Concrete implications

1. **No `/[type]/[slug]` detail routes.** Card click → overlay, not navigation. The earlier recommendation in [[Open Questions]] to build dedicated routes with NGE reader chrome is **overruled** by this decision.
2. **URL updates via `?item=<slug>`**, not via route change. This preserves shareability (deep-linking) without breaking containment. See [[useOverlay]].
3. **Article bodies, mix playback, event details, tracklists** all render inside the overlay. Not in new tabs, not on dedicated pages.
4. **External URLs** (ticket purchases, SoundCloud, Substack origin credits, partner websites) are **explicit user-chosen escape hatches** from inside the overlay — styled as clearly-secondary actions, never the default card behavior.
5. **Section navigation** (`/agenda`, `/editorial`, `/mixes`, …) still uses Next.js routes. Containment is about **content consumption**, not section switching. If the user later wants sections contained too (e.g. tabbed filter), that'll be a separate decision.
6. **Transitions should reinforce containment.** The CRT boot-in + dim/blur backdrop make it feel like the content emerges from the grid, not that the grid is replaced. See [[Overlay System]].

## Alternatives rejected

| Option | Why rejected |
|---|---|
| Dedicated `/[type]/[slug]` routes | Leaves the grid. Every click is a navigation. Breaks containment. |
| In-place card expansion (card grows in the grid) | Hard to lay out with variable-sized mosaic cards. Doesn't give enough reading space. |
| Inspection panel (side drawer) | Eats horizontal real estate on desktop, awkward on mobile. Less dramatic than full overlay. |
| Modal + also route (hybrid) | Worst of both: two places to maintain the same layout, URL-to-mount dance is fragile. |

The overlay was chosen because it's the **only** option that lets the grid stay behind (subtly visible through the blur) while giving the article/event the full stage.

## Consequences

- **Pro:** the site has a distinct "console" feel. You don't page through a blog; you pull records out of a live system.
- **Pro:** the grid keeps its scroll position. Close the overlay, you're exactly where you were.
- **Pro:** one transition language across all content (CRT boot-in), one close language (ESC / X / backdrop).
- **Pro:** deep-linking still works via `?item=` — no SEO/UX cost from skipping routes.
- **Con:** server-rendering the overlay for deep-links is less straightforward (`?item=` is read client-side in a `useEffect`). Acceptable for MVP; revisit if SEO for individual pieces becomes important.
- **Con:** search crawlers won't index each piece as its own URL. Given [[No Algorithm]] and editorial-led discovery, this is aligned with the product ethos.
- **Con:** external escape hatches (tickets, SoundCloud) still exist — the containment is about the default, not an absolute.

## See also

The companion decision about **how** the reading overlay should look is [[Reader Terminal Layout]]. Per-type overlays, article body primacy, flyer as archival asset.

## Links

- [[Overlay System]]
- [[Reader Terminal Layout]]
- [[useOverlay]]
- [[OverlayShell]]
- [[OverlayRouter]]
- [[ReaderOverlay]]
- [[EventoOverlay]]
- [[Why NGE Aesthetic]]
- [[No Algorithm]]
