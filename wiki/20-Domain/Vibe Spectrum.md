---
type: domain
status: current
tags: [vibe, filter, core-concept]
updated: 2026-04-22
---

# Vibe Spectrum

> 0 glacial → 10 volcán. A single numeric axis encoding musical intensity. Every [[Content Types|content item]] has one.

## What

Every `ContentItem.vibe` is an integer 0–10. The scale is **subjective-editorial** — vibes are assigned by the curator, not computed from features.

| Value | Name | Feel |
|---|---|---|
| 0 | GLACIAL | ambient / ice / drone |
| 1 | POLAR | lo-fi / downtempo |
| 2 | CHILL | organic house / dub / ambient techno |
| 3 | COOL | deep house / minimal / jazz / neo soul |
| 4 | FRESH | house / electronica / melodic techno / nu disco |
| 5 | GROOVE | tech house / electro / IDM / latin electronic |
| 6 | WARM | techno-raw / progressive / afro house / breaks |
| 7 | HOT | peak techno / D&B / UKG / UK bass |
| 8 | FUEGO | hard techno / dark / jungle / footwork |
| 9 | BRASA | industrial / noise / deconstructed |
| 10 | VOLCÁN | psy-trance / hyperpop / gqom |

(Labels from [VibeSlider.tsx:12](../../components/VibeSlider.tsx). An adjacent shorter scale in [utils.ts::vibeToLabel](../../lib/utils.ts) uses 8 slot names for compact badges.)

## Why

- **Genre is too granular.** A user doesn't browse "drum-and-bass" — they're looking for "something fast." Vibe sits above genre.
- **One axis, not two.** Tempo + darkness could be a 2D space, but 1D is legible on a slider. Peak techno and hard techno both pin to the right; melancholic ambient and bright ambient both pin to the left. Information loss is acceptable.
- **No auto-assignment.** See [[No Algorithm]] — the curator's ear is the source of truth.

## How

### Visual rendering

`vibeToColor(n)` — 11-step discrete palette from cyan → red, used as the item accent color. See [utils.ts:19](../../lib/utils.ts).

```
0  #00FFFF   cyan
1  #00CCFF
2  #0066FF
3  #6600FF
4  #CC00FF
5  #FF00FF   magenta (midpoint)
6  #FF0066
7  #FF5500
8  #FFAA00
9  #FF2200
10 #FF0000   red
```

A second, smoother gradient lives in `tailwind.config.ts::bg-vibe-gradient` (ice-to-volcano with 8 color stops) — used for the [[VibeSlider]] track and long bars. See [[Vibe Gradient]].

### Filtering

`vibeRange: [min, max]` is a tuple in [[VibeContext]]. `filterByVibe(items, range)` keeps items whose vibe falls in `[min, max]` inclusive. See [utils.ts:88](../../lib/utils.ts).

Default range is `[0, 10]` (no filter). User sets it via the [[VibeSlider]].

### Default genre → vibe map

[[VibeSlider]] also holds `GENRE_VIBE: Record<string, number>` — it's used only to **display which genres live in the current slider range**, not to auto-assign vibes to items. Source of truth for an item's vibe remains the curator.

## Invariants

- `vibe` is required on every `ContentItem` (no `| undefined`). Partners have vibe too — typically 5 (neutral).
- `vibe` is an integer. Fractions would be allowed by the type (`number`), but nothing in the UI handles them — keep it integer-clean until there's a reason not to.

## Links

- [[Vibe Gradient]]
- [[VibeSlider]]
- [[VibeContext]]
- [[Content Types]]
- [[utils]]
