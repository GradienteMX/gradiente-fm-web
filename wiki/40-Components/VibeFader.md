---
type: component
status: current
tags: [component, vibe, vibe-checks, fader, overlay]
updated: 2026-05-05
---

# VibeFader

> Inline draggable fader that replaces the static VIBE row in every overlay. Renders the displayed band (author or crowd median) and lets authed users commit their own [[Vibe Checks|vibe check]] by dragging.

## Source

[components/VibeFader.tsx](../../components/VibeFader.tsx)

## Client component? Yes

Owns drag state via refs; subscribes to per-item realtime via [[vibeChecks]] hooks.

## Where it renders

Used by all six content overlays in place of the old `swatch + vibeRangeLabel` row:

- [[ReaderOverlay]]
- [[EventoOverlay]]
- [[MixOverlay]]
- [[ArticuloOverlay]]
- [[ListicleOverlay]]
- [[GenericOverlay]]

## Anatomy

```
↯ VIBE  [▓▓▓▓▓░░░░░]  4-7 · COOL → HOT  ◇1  ★4-7
        ⌃         ⌃
       (author tick anchors)
```

Five visual layers stacked on the 220px-wide track:

1. **Faint full-axis backdrop** — `bg-vibe-gradient` at 15% opacity. Shows the 0-10 scale subtly so the user has visible terrain past the lit band.
2. **Lit displayed band** — full vibe-color gradient between the displayed band's min/max. Dims to 30% in edit mode so the user vote takes focus.
3. **User-vote ghost** — same vibe-color gradient at the user's `[vibeMin, vibeMax]`. Opacity scales with interaction:
   - **Default:** 25% (persistent post-commit feedback)
   - **Hover:** 60%
   - **Edit:** 100% + EVA-gold outline
4. **Thumbs** — white in view mode at displayed-band edges (subtle affordance hint), gold + draggable in edit mode at the user-vote / drag-preview edges.
5. **Author tick marks** — 1px white-on-45% verticals below the band at `[vibeMin, vibeMax]`. Self-revealing: when displayed band == author band they sit directly under the lit segment; only visually separate when crowd median diverges from author.

Right of the track:

- **Numeric label** — `vibeRangeLabel` format (`4-7 · COOL → HOT` or `5 · NEUTRAL`). Updates live during drag. Color tracks the band midpoint.
- **Crowd-check count** — `◇N` (under threshold, author still authoritative) or `◆N` (≥5, crowd is authoritative). Hidden in edit mode but slot stays reserved (`invisible`) so layout doesn't shift.

## Layout-shift hardening

Both the label and count slots have `min-width` (12rem and 1.75rem) so when the label content swaps between single-point (`5 · GROOVE`) and range (`0-10 · GLACIAL → VOLCÁN`), or the count badge appears/disappears between modes, the surrounding meta strip doesn't reflow. Some overlays use `ml-auto` on the meta block — without these slot widths, every label change shifted the block left.

## Interaction model

Login-gated. Logged-out tooltip: `Inicia sesión para hacer tu vibe check` — clicking fires `openLogin()`.

For authed users:

| Gesture | Effect |
|---|---|
| Hover (view mode) | Track gets faint orange shadow; ghost overlay fades from 25% → 60% |
| Click anywhere on track | Enter edit mode (gold shadow on track, thumbs glow gold) |
| Drag a thumb | Live preview band tracks the drag; label updates to current edit range |
| Release after drag | Commits via `castVibeCheck` (optimistic). Exits edit mode. |
| Click outside / ESC | Cancels without committing |

The drag-to-set physicality is intentional friction — see [[Vibe Philosophy]] idea 4.

### Single-point auto-switch

When `userVote.vibeMin === userVote.vibeMax`, both thumbs sit at the same x-position. The DOM stacking order would otherwise capture the click for the max thumb only, making leftward drags impossible. Fix in [VibeFader.tsx:99](../../components/VibeFader.tsx) (the `onMove` handler): when `curMin === curMax` and the drag direction is leftward, the active thumb auto-flips to `min`. Drag right → max thumb. Drag left → min thumb. Either gesture works first-try.

### Drag void threshold

Pointer-up within 3px of pointer-down counts as a click, not a drag. Bare clicks on a thumb stay in edit mode without saving — protects against accidental votes.

## State sources

- `useUserVibeCheck(item.id, viewerId)` → user's saved vote (or null)
- `useVibeCheckAggregate(item.id)` → `{ checkCount, medianMin, medianMax }`. Realtime-subscribed to `vibe_checks` changes for this item.
- `item.vibeMin/vibeMax` (prop) → author's range
- `currentUser` from [[useAuth]] → for login gate

Computed locally:

```ts
displayedBand = aggregate.checkCount >= VIBE_CHECK_THRESHOLD
  ? [aggregate.medianMin, aggregate.medianMax]
  : authorBand
```

## Why a separate file from VibeSlider

The slider is a **filter** for the home feed (writes to `vibeRange`). The fader is a **vote** on a specific item (writes to `vibe_checks`). Different state targets, different gestures (range narrowing vs single-band selection), different RLS shape. Sharing a single component would tangle the two concerns; keeping them separate lets each evolve.

Both render the same vibe-color palette via `vibeToColor` / `vibeRangeLabel`, so visual consistency comes from shared utilities, not shared component state.

## Open questions

- Visual cue for "your vote is far from consensus" — currently it's just the gap between ghost and lit band. Could be louder (e.g. a tiny `Δ` indicator) but defer until users complain.
- Mobile: drag-to-set works on touch but the chip count badge can crowd small screens. Audit during the [Mobile pass](../Next%20Session.md).

## Links

- [[Vibe Checks]] — the feature this UI surfaces
- [[Vibe Philosophy]] — idea 4 explains the friction
- [[vibeChecks]] — the cache + hooks module
- [[VibeSlider]] — sibling, but different concern (filter not vote)
- [[Vibe Gradient]]
