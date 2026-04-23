---
type: component
status: stale
tags: [component, card, orphan, mix, waveform]
updated: 2026-04-22
---

# MixCard

> **Orphaned.** Linear mix row with play button, fake waveform, and play-count placeholder. Used by [[ContentFeed]] which isn't wired.

## Source

[components/cards/MixCard.tsx](../../components/cards/MixCard.tsx)

## Structure

- Top accent stripe in vibe color
- Left: play button (56px wide, opens `mixUrl` in new tab)
- Right: title / subtitle / **fake waveform** / meta row (genres, date, duration)

## The fake waveform

32 bars computed from `Math.sin(i * 0.7 + item.vibe) * 0.4 + 0.6`. Every 4th bar at full opacity, others at 50%. Pure decoration — it doesn't represent the actual audio waveform.

```ts
const h = Math.sin(i * 0.7 + item.vibe) * 0.4 + 0.6
// height = max(15%, round(h * 100))%
```

Vibe-colored. Different vibe → different visible pattern (phase shift from `item.vibe` in the seed). Neat touch.

## Why orphaned

See [[Dual Feed Systems]].

## If resurrected — ideas

- Swap decorative waveform for a real one via a static pregen (SoundCloud has an image URL for waveforms)
- Add in-page playback via `<audio>` or an embedded SoundCloud/Mixcloud iframe

## Links

- [[ContentFeed]]
- [[Dual Feed Systems]]
- [[ContentCard]]
