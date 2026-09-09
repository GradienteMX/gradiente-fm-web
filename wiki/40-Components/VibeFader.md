---
type: component
status: current
tags: [component, vibe, vibe-checks, fader, overlay]
updated: 2026-09-09
---

# VibeFader

Shared vibe-check instrument in the six content overlays and dashboard Reproductor. See [[Vibe Checks]] for the unchanged author-to-median threshold and authenticated write contract.

## Layout and color

The track fills its seat. Metadata occupies a separate row; there are no reserved label widths squeezing the interactive axis. Both compact and expanded variants show 0–10 and a 44px-tall interaction surface, with 32px-wide hit areas around visible 14×32px grips. Edge padding keeps targets inside the faceplate.

The tape uses the canonical eleven hard-stepped [[Vibe Gradient]] colors. Slots are centered on their numbered positions (half slots at 0 and 10). The full spectrum remains visible at low opacity, with the effective range lit. A single-point reading lights one slot rather than disappearing into a zero-width band.

- Thermal tape: author range until five checks, then collective median. Existing attack/release animation and reduced-motion behavior remain.
- White grips: your stored range, or the effective range before your first check. Grips turn gold while adjusting.
- White held bracket: your committed reading.
- Dotted reference beneath the tape: original author calibration.
- Expanded view: Glacial/Volcán endpoints, explicit personal/effective range legend and login-aware instructions. Author values remain listed when the collective range takes over.

## Interaction

A pointer drag exceeding 3px commits on release. A bare click only arms; it does not submit. Single-point left/right auto-switching remains. Pointer cancellation, clicking outside and Escape discard the preview.

Keyboard: Tab to either slider, arrow keys preview integer adjustments bounded by 0–10 and the other endpoint, Enter or Space commits. Screen-reader instructions describe the interaction. Login remains required for pointer and keyboard input.

Dashboard sign-in opens above the listening sheet; that sheet yields its keyboard trap while login is open.

## Realtime lifecycle

`useVibeCheckAggregate` shares one channel per item across simultaneous dashboard/overlay consumers. The last consumer releases it. Each channel lifetime gets a unique name so asynchronous removal cannot collide with immediate remounts. Regression coverage lives in `tests/vibe/subscriptions.test.ts` (`npm run test:vibe`).

## Validation limits

Compact and expanded desktop layouts, overlay coexistence and the login gate are checked in Chrome. Authenticated vote persistence requires a real signed-in account and was not exercised during this desktop refinement. Mobile-specific tuning remains separate.

## Links

- [[Vibe Checks]]
- [[Vibe Philosophy]]
- [[Vibe Gradient]]
- [[Pliego Desktop Refinement]]
