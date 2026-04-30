---
type: decision
status: current
tags: [decision, polls, content, engagement]
updated: 2026-04-30
---

# Decision — Polls As Attachments

> A poll is never a feed object. It's an optional attachment on an existing `ContentItem`, with a `kind` that adapts the poll's behavior to the parent type. Voters interact from the card without leaving the grid.

## Decision

Polls are an extension of the existing content types — not a ninth content type:

- The poll definition lives at `ContentItem.poll?: PollAttachment`.
- The `kind` field controls how choices are resolved: `from-list` for listicle, `from-tracklist` for mix, `attendance` for evento, `freeform` for any text-content type (noticia / review / editorial / opinion / articulo).
- Vote storage is a separate session-scoped store ([[polls]] `gradiente:polls`) — only the votes are mutable per session.
- Card-level interaction: a small chip on the card's image area opens a temporary canvas that *replaces* the image while the poll is open. After voting, the canvas swaps to results bars; closing returns to the image.
- Overlay-level: the same poll renders as a permanent section ([[PollSection]]) inside the parent's content overlay.
- **Anonymous-until-vote**: aggregated counts are hidden from any viewer who hasn't cast a vote. Once they vote (or once the poll closes), counts reveal.

## Why an attachment, not a content type

A poll without a parent has nothing to ask about. The interesting polls — "tu favorito de la lista", "mejor track del mix", "vas al evento" — are per-context and per-type. Modeling poll-as-content-type would either:

- Duplicate the parent's structure (track list, tracklist, evento metadata) inside the poll, or
- Force the editor to author choices manually for every poll, including the ones that should auto-derive.

Embedding on the parent keeps the parent the source of truth. Editing a listicle's tracks updates the poll's choices automatically; the poll never drifts from the content it sits on.

## Card-as-canvas — the visual challenge

The card already has its own visual identity (image, title, type badge, vibe stripe, optional date block, save mark, optional editorial mark). Stacking poll chrome alongside that would either compete with the image or break the mosaic grid heights.

**The pitch.** When a card has an active poll, it gets *one* small chip in a corner of the image. Click → the image area becomes the poll surface for that interaction:

- The image dims under a black scrim.
- The prompt + choices stack over the dimmed image.
- After voting, the rows flip to vibe-colored horizontal result bars.
- ESC / click-outside / close button restores the image.

The card retains its mosaic position and chrome — title, badges, save mark all stay put. Only the image swaps. The poll *borrows* the image's real estate rather than competing for new space.

## Anonymous-until-vote

Two reasons to gate results behind the user's own vote:

1. **Reduces bandwagoning.** Seeing "70% picked X" before voting biases toward consensus. Hiding counts forces the voter to commit before learning the room's read.
2. **Makes voting feel like an exchange.** The user reveals their preference; the room reveals its. Cleaner than a passive read-and-leave gesture.

Closed polls (past `closesAt`) reveal results unconditionally — the gate is for active polls, not archives.

## Per-type variant table

| Parent | Poll `kind` | Choices source | Default prompt |
|---|---|---|---|
| `listicle` | `from-list` | `articleBody` `track` blocks | "Tu favorito?" |
| `mix` | `from-tracklist` | `tracklist` array | "Mejor track del set?" |
| `evento` | `attendance` | fixed (`VOY` / `TAL VEZ` / `NO PUEDO`) | "Vas?" |
| `noticia`, `review`, `editorial`, `opinion`, `articulo` | `freeform` | editor authors | (editor authors) |
| `partner` | (none) | — | — |

Editors can override the prompt for any kind. For non-freeform kinds, choices are auto-derived; the editor doesn't author them. For freeform, the [[Dashboard Forms]] PollFieldset surfaces an add/remove choice list.

## Alternatives rejected

1. **Poll as a separate content type, surfaced in the feed.** Would lose context — voters need the parent (the list, the mix, the event) to know what they're voting on. Also breaks the grid logic (polls would compete for HP/curation slots).
2. **Always-visible result bars on the card.** Bandwagon problem. Also conflicts with [[No Algorithm]] / [[Size and Position as Only Signals]] — visible counts would become an engagement metric on the surface.
3. **Modal popover anchored to the card via `getBoundingClientRect`.** Considered. The trade-off: modal overlays the surrounding cards too, which feels heavier than borrowing the card's own image. Also brittle on scroll. The canvas-in-card avoids both.
4. **Inline expanding section beneath the card.** Breaks mosaic heights — cards would need to grow when expanded, reflowing the grid.

## Consequences

- **Pro:** the editor never has to wonder "where does the poll go?" — it's already attached to the parent.
- **Pro:** mosaic grid stays stable. No card grows or shifts when a poll is opened.
- **Pro:** reads as one clean affordance per card (the chip), one clean section per overlay.
- **Pro:** the storage shape is small — only votes need session-scoped state; the poll definition rides with the seed/draft pipeline.
- **Con:** one poll per item by design. If editors want multiple polls on a single article, they'd need a different shape (deferred — not currently a need).
- **Con:** the canvas's vertical real estate scales with the card size; very small cards (`sm` in the mosaic) can fit ~3 choice rows comfortably. For freeform polls with 5+ choices on a small card, the choice list scrolls inside the canvas. Acceptable; could revisit.

## Engagement-metric carve-out

Polls produce visible counts. That's a deliberate carve-out from [[No Algorithm]] / [[Size and Position as Only Signals]] — but with explicit guardrails:

- Poll results sit *inside the poll itself*, not on the card chrome (no permanent count badge).
- Poll counts never affect feed ordering, card size, or curation. HP doesn't read polls.
- Counts gate behind anonymous-until-vote so they don't bias casual readers.

The line: counts on the *poll* itself are fine; counts on the *content* (card view counts, like counts) are still rejected.

## Links

- [[polls]] — the storage layer + hooks + per-type resolver
- [[PollCardCanvas]] · [[PollSection]] · [[PollFieldset]] — the three UI surfaces
- [[Dashboard Forms]] — where editors author polls per content type
- [[No Algorithm]] · [[Size and Position as Only Signals]] — the rules polls live alongside
- [[Roles and Ranks]] — anonymous-until-vote shares the same "labels on people, not weights on content" instinct
