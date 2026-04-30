---
type: component
status: current
tags: [poll, card, canvas, vote]
updated: 2026-04-30
---

# PollCardCanvas

> Card-level poll affordance. Renders a small chip when closed; replaces the card's image area with a vote/results canvas when open. Mounts inside the card's image container so it borrows the existing visual real estate without breaking mosaic heights.

## Source

[components/poll/PollCardCanvas.tsx](../../components/poll/PollCardCanvas.tsx)

## Two states

**Closed** — a single corner chip on the card image. Per-kind copy:

- `from-list` → `?VOTAR · FAV`
- `from-tracklist` → `?VOTAR · TRACK`
- `attendance` → `?VAS?`
- `freeform` → `?VOTAR`

After the viewer has voted, the chip flips to `✓VOTASTE` (sys-orange) regardless of kind. After the poll closes, it flips to `CERRADA`.

**Open** — fills `absolute inset-0` over the image. Backdrop scrim dims the image; prompt + choices stack on top.

- Pre-vote: choice rows are clickable with no counts visible.
- Post-vote: rows flip to vibe-colored result bars with `%` + `(count)`. The viewer's pick is highlighted with the vibe accent.
- ESC, click-outside, and an explicit close button all return to the chip.

## Anonymous-until-vote gate

Counts are hidden behind `hasVoted = useUserVote(...) !== null`. Closed polls show counts unconditionally (the gate is for active polls). See [[Polls As Attachments]] for the rationale.

## Login gate

Voting requires login. When a logged-out viewer clicks a choice, the canvas calls `useAuth.openLogin()` instead of casting the vote. The poll is read-only until they sign in.

## Why this shape

See [[Polls As Attachments]] § "Card-as-canvas — the visual challenge" for the full reasoning. Short version: the card already has its own visual identity, and stacking poll chrome alongside the image either competes with it or breaks the mosaic. Borrowing the image temporarily — image dims, poll content slides in, image returns on close — keeps the card stable in the grid while still letting voters interact without leaving the home view.

## Mounting

Inside [[ContentCard]]'s `CardImage` and inside [[HeroCard]]'s left image panel. The component renders nothing when `item.poll` is undefined; gates internally.

## Click isolation

Both the chip and the canvas backdrop call `e.stopPropagation()` on their click handlers — the parent card has its own `onClick` that opens the content overlay. The poll lives separately from the read flow.

## Links

- [[polls]] — the underlying store + per-type resolver
- [[PollSection]] — sibling component for inside the overlay
- [[PollFieldset]] — author-side editing (dashboard)
- [[ContentCard]] · [[HeroCard]] — mount points
- [[Polls As Attachments]] — the design decision
