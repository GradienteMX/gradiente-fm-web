---
type: module
status: current
tags: [module, curation, math, ranking]
updated: 2026-05-11
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
| `cardLayout` | `(item, peaks, now?) => CardLayout` | per-item tier from score thresholds; per-type md geometry baked in. Does NOT apply rank caps (those live in `rankItems`). |
| `sizeForScore` | `(s) => CardTier` | score → tier (legacy helper; doesn't account for caps) |
| `rankItems` | `(items, now?) => RankedItem[]` | sorted + enriched + rank-capped + gradient-weaved (see § Ranking pipeline) |

### CardLayout shape

```
type CardTier = 'sm' | 'md' | 'lg' | 'xl'
interface CardLayout {
  tier:      CardTier
  colSpan:   1 | 2 | 3
  rowSpan:   1 | 2
  colStart?: 1 | 2 | 3   // explicit anchor; undefined → dense-flow places
  intensity: number      // 0–1, intra-tier position
}
```

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
  noticia: 48, opinion: 240, articulo: 336, listicle: 336, partner: 8760
}

FRESHNESS_HALF_LIFE_HOURS = {
  evento: 336, mix: 720, editorial: 240, review: 504,
  noticia: 72, opinion: 336, articulo: 504, listicle: 504, partner: 8760
}

TYPE_SCORE_MULTIPLIER = {
  review: 1.3, articulo: 1.3, listicle: 1.3,
  opinion: 1.2, editorial: 1.1, noticia: 0.8
}   // evento, mix, partner default to 1.0

// Tier thresholds (score-gated)
LG_THRESHOLD = 1.0
MD_THRESHOLD = 0.5

// Per-type md geometry (Lever 1 — see § Ranking pipeline)
MD_GEOMETRY = {
  review/articulo/listicle/editorial/opinion/noticia: { colSpan: 1, rowSpan: 2 },  // tall
  evento/mix/partner:                                  { colSpan: 2, rowSpan: 1 },  // wide
}

// Rank-aware caps + weave (Levers 2 + 3)
MAX_LG     = 3   // lg cards retained after the xl promotion
TOP_KEEP   = 4   // xl + lg cluster preserved before sm weave begins
K          = 1.5 // gradient exponent for sm distribution
MAX_RUN    = 2   // run-breaker tolerance (3+ same-shape neighbors trigger swap)
MAX_PASSES = 4   // run-breaker iteration cap
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

Items promoted to `xl` or demoted from `lg` to `md` by `rankItems` are stamped with `intensity: 1` regardless of their raw score.

## Ranking pipeline (`rankItems`)

The five-stage post-sort pipeline that turns raw `cardLayout` outputs into the final mosaic order. See [[HP Curation System]] §§ 9–10 for the why.

1. **Score + prominence per item** — pure `cardLayout` based on score thresholds.
2. **Sort by `prominence` descending.**
3. **Rank caps**: walk the sorted array; top-1 `lg`-qualifying → `xl 3×2`; next `MAX_LG` keep `lg 2×2` with `colStart` alternating between 1 and 2; further lg-qualifying demote to `md` (per-type geometry).
4. **Gradient sm weave**: preserve first `TOP_KEEP` positions intact, then redistribute remaining items so sm count at position `p` follows `((p+1)/total)^K · sm.length`. K=1.5 ends-loaded.
5. **Run-breaker**: up to `MAX_PASSES` sweeps of local swaps (forward-preferred, backward fallback) to flatten residual same-shape runs.

The shape key for run detection includes `colStart`, so lg-L / lg-R alternation isn't penalized as a same-shape run.

## Known TODOs (from comments in the file)

- `computePeakByType` uses observed max — spec calls for rolling 90-day p90. Needs backend. See [[Supabase Migration]].
- Score multipliers + tier constants are hardcoded; could become admin-configurable.
- HP writer side (`hp_events` inserts) is deferred — rollup cron exists but starves. See `project_hp_writer_deferred` memory.

## Links

- [[HP Curation System]]
- [[Size and Position as Only Signals]]
- [[ContentGrid]]
- [[Supabase Migration]]
