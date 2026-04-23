---
type: module
status: current
tags: [module, curation, math, ranking]
updated: 2026-04-22
---

# curation

> All HP decay / prominence / sizing math. Pure functions. No state.

## Source

[lib/curation.ts](../../lib/curation.ts)

## Public exports

| Function | Signature | Purpose |
|---|---|---|
| `spawnHp` | `(item) => number` | 20 default, 50 if `editorial` |
| `currentHp` | `(item, now?) => number` | decayed HP at `now` |
| `computePeakByType` | `(items, now?) => PeakByType` | observed max HP per type (normalization denominator) |
| `score` | `(item, peaks, now?) => number` | normalized HP × type multiplier |
| `freshness` | `(item, now?) => number` | 0–1, time-decay from `publishedAt` |
| `prominence` | `(item, peaks, now?) => number` | final sort key: 0.5·freshness + 0.5·score + imminenceBonus |
| `cardLayout` | `(item, peaks, now?) => CardLayout` | { tier: sm/md/lg, colSpan, rowSpan, intensity } |
| `sizeForScore` | `(s) => CardTier` | score → tier |
| `rankItems` | `(items, now?) => RankedItem[]` | sorted + enriched |

## Design constraints (from the module header)

> - Only size and position are visible ranking signals.
> - No per-user logs; HP lives on the item as an aggregate scalar.
> - Editorial toggle is the only editor lever (raises spawn HP).

See [[Size and Position as Only Signals]], [[No Algorithm]], [[Editorial Flag]].

## Tunables (constants)

```
SPAWN_HP_DEFAULT      = 20
SPAWN_HP_EDITORIAL    = 50

ATTENTION_HALF_LIFE_HOURS = {
  evento: 72, mix: 504, editorial: 168, review: 336,
  noticia: 48, opinion: 240, partner: 8760
}

FRESHNESS_HALF_LIFE_HOURS = {
  evento: 336, mix: 720, editorial: 240, review: 504,
  noticia: 72, opinion: 336, partner: 8760
}

TYPE_SCORE_MULTIPLIER = {
  review: 1.3, opinion: 1.2, editorial: 1.1, noticia: 0.8
}   // evento, mix, partner default to 1.0
```

See [[HP Curation System]] for why these specific values.

## Event-aware decay

[`decayLambda(item, now)`](../../lib/curation.ts) modulates λ for events:

- Live window (1h pre → 1h post): `λ = 0`
- Within 7 days pre-doors: `λ × (days/7)²` (ramps down toward event)
- > 30 days past end: `λ × 2` (archival acceleration)

## Imminence bonus

Flat additive on top of score+freshness for events:

- Live window: `+1.0`
- Within 24h pre-doors: `+0.5`
- Otherwise: `+0`

## The `intensity` field on CardLayout

Intra-tier position 0–1. Consumed by [[ContentGrid]] as CSS var `--prominence`:

```
lg:  intensity = min(1, s - 1.0)      // s ∈ [1, ∞)
md:  intensity = (s - 0.5) / 0.5      // s ∈ [0.5, 1)
sm:  intensity = s / 0.5              // s ∈ [0, 0.5)
```

## Known TODOs (from comments in the file)

- `computePeakByType` uses observed max — spec calls for rolling 90-day p90. Needs backend. See [[Supabase Migration]].
- Score multipliers are constants; could become admin-configurable.

## Links

- [[HP Curation System]]
- [[Size and Position as Only Signals]]
- [[ContentGrid]]
- [[Supabase Migration]]
