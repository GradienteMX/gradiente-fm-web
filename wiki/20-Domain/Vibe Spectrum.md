---
type: domain
status: current
tags: [vibe, filter, core-concept]
updated: 2026-05-05
---

# Vibe Spectrum

> 0 glacial → 10 volcán. A single numeric axis encoding musical intensity. Every [[Content Types|content item]] has one. The framing reasoning lives in [[Vibe Philosophy]]; this note covers mechanics.

## What

Every `ContentItem` carries a curator-assigned `[vibeMin, vibeMax]` range (single-point items set `min === max`). The scale is **subjective-editorial** — vibes are assigned by the curator, not computed from features. The crowd refines via [[Vibe Checks]].

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

- **Genre is too granular.** A user doesn't browse "drum-and-bass" — they're looking for "something fast." Vibe sits *alongside* genre as a peer axis, not under it. See [[Vibe Philosophy]] idea 1 (two-axis system) and idea 2 (genre alone is a lie).
- **One axis, not two.** Tempo + darkness could be a 2D space, but 1D is legible on a slider. Peak techno and hard techno both pin to the right; melancholic ambient and bright ambient both pin to the left. Information loss is acceptable.
- **No auto-assignment.** See [[No Algorithm]] — the curator's ear is the source of truth. The crowd refines via [[Vibe Checks]] but never replaces it.

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

`vibeRange: [min, max]` is a tuple in [[VibeContext]]. `filterByVibe(items, range)` keeps items whose **effective band** overlaps `[min, max]`. The effective band is the author's `[vibeMin, vibeMax]` until the [[Vibe Checks]] crowd reaches threshold (5 votes), then it's the crowd median. So vibe checks affect feed *eligibility*, not just visual chrome.

Default range is `[0, 10]` (no filter). User sets it via the [[VibeSlider]].

### Genre catalog (used to be GENRE_VIBE)

Pre-2026-05-05 `GENRE_VIBE` was a static genre→typical-vibe map that drove the slider's chip strip. That was the stereotype lie ([[Vibe Philosophy]] idea 2). The chip strip is now feed-driven via `visibleGenres` — see [[VibeSlider]]. `GENRE_VIBE` is preserved as a fallback for routes without a feed (e.g. `/foro`) and for the foro thread filter.

The full genre taxonomy lives in [[genres]] — 18 root categories + ~175 leaf subgenres + ~47 legacy ids, with parent rollup for filtering.

## Invariants

- `vibeMin` and `vibeMax` are required on every `ContentItem` (no `| undefined`). Partners have vibe too — typically 5 (neutral).
- Both are integers. The slider stores continuous floats internally but snaps to integers for label/chip purposes; items always store integers. DB constraint enforces `0 ≤ vibe_min ≤ vibe_max ≤ 10`.

## Links

- [[Vibe Philosophy]] — the why
- [[Vibe Checks]] — the crowd-correction layer
- [[Vibe Gradient]]
- [[VibeSlider]]
- [[VibeFader]]
- [[VibeContext]]
- [[Content Types]]
- [[genres]]
- [[utils]]
