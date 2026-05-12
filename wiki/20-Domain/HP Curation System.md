---
type: domain
status: current
tags: [curation, hp, decay, ranking, core-concept]
updated: 2026-05-11
---

# HP Curation System

> Items have **HP** (hit points). HP decays exponentially over time. HP drives card **size** and **position**. No likes, no votes, no user logs.

## What

A deliberately lo-fi ranking model. Every item carries:

- `hp: number` — current health, 0–∞ (practically 0–100)
- `hpLastUpdatedAt: ISO` — when `hp` was last written
- `editorial: boolean` — editor-seeded flag that raises spawn HP
- `pinned: boolean` — locks item into the single [[Pinned Hero]] slot
- implicit: `type`, `publishedAt`, `date` (for events)

All curation math lives in [lib/curation.ts](../../lib/curation.ts).

## Why

Design constraints (explicit in the code comments):

- **Only size and position are visible ranking signals.** No stars, no counter badges, no "trending". See [[Size and Position as Only Signals]].
- **No per-user logs.** HP is an aggregate scalar on the item itself. Zero GDPR surface, zero analytics infra.
- **Editorial toggle is the only editor lever.** Keeps the curator honest — no endless knobs.

This produces a feed that looks organic but is entirely deterministic.

## How

### 1. Spawn HP

```
spawnHp(item) = editorial ? 50 : 20
```

Editorial items start with 2.5× the baseline. That's the whole boost mechanism.

### 2. Decay

HP halves every `ATTENTION_HALF_LIFE_HOURS[type]`:

| Type | Half-life |
|---|---|
| evento | 72h (3 days) |
| mix | 21 days |
| editorial | 7 days |
| review | 14 days |
| noticia | 48h (2 days) |
| opinion | 10 days |
| partner | 365 days (effectively static) |

Decay is **lazy** — we don't run a cron. `currentHp(item, now)` computes the decayed value on read from the stored snapshot:

```
hp(t) = hp₀ · e^(-λ · Δt)
```

See [curation.ts:81](../../lib/curation.ts).

### 3. Event-aware decay modulation

Events get special treatment in [`decayLambda`](../../lib/curation.ts):

- **Live window** (1h before doors → 1h after end): **λ = 0** (HP frozen).
- **Approaching** (within 7 days, before doors): λ scaled by `(days_until / 7)²` (slower decay, accelerates back to normal at 7 days out).
- **Stale** (> 30 days after end): λ × 2 (faster archival fade).

This keeps imminent events prominent and fades past events cleanly.

### 4. Normalization

HP values across types aren't directly comparable (a 30-day-old mix at 50 HP vs a 1-day-old event at 50 HP). [`score(item)`](../../lib/curation.ts) divides by the type's observed peak:

```
score = currentHp / peakHpForType × TYPE_SCORE_MULTIPLIER[type]
```

Multipliers correct cross-type dominance:

| Type | Multiplier |
|---|---|
| review | 1.3 |
| opinion | 1.2 |
| editorial | 1.1 |
| evento | 1.0 |
| mix | 1.0 |
| noticia | 0.8 |
| partner | 1.0 |

Noticias decay fast AND get downweighted — news shouldn't dominate a music site.

### 5. Freshness

Independent of HP, there's a pure time-decay signal:

```
freshness = e^(-λ_fresh · ageHours)
```

Different half-lives from attention decay — see `FRESHNESS_HALF_LIFE_HOURS` in [curation.ts:29](../../lib/curation.ts).

### 6. Imminence bonus (events only)

Flat additive bonus on top of score + freshness:

- Live window (1h pre → 1h post): `+1.0`
- Within 24h before doors: `+0.5`
- Otherwise: `+0`

### 7. Prominence (final sort key)

```
prominence = 0.5 · freshness + 0.5 · score + imminenceBonus
```

[[ContentGrid]] sorts ranked items by `prominence` descending.

### 8. Size tier from score

`cardLayout(item)` assigns a `{ tier, colSpan, rowSpan, intensity, colStart? }`. Four tiers, threshold-gated:

| Score | Tier | Span | Notes |
|---|---|---|---|
| ≥ 1.0 | lg | 2×2 | Top-1 lg-qualifying promoted to `xl` (see § 9). Other lg get anchor alternation. |
| ≥ 0.5 | md | **per-type** | Text-heavy types → `1×2` tall portrait; visual types → `2×1` wide landscape. |
| < 0.5 | sm | 1×1 | Squares. |

`intensity` is the intra-tier position (0–1), consumed by [[ContentCard]] as a CSS variable `--prominence` for subtle scale/padding effects.

#### Per-type `md` geometry

Without per-type spans, every `md` and `lg` card was `colSpan: 2` in a 3-col grid — the page collapsed into a wide-left / thin-right monotone. The split:

| Type | `md` geometry | Rationale |
|---|---|---|
| review · articulo · listicle · editorial · opinion · noticia | **1×2 tall** | Long-form prose reads better in a portrait card |
| evento · mix · partner | **2×1 wide** | Flyer / cover art reads better at width |

Tall `1×2` tiles slot into column 3 alongside wide `2×1` neighbors, so the right rail stops being a wall of 1×1 squares.

### 9. Rank-aware tier caps (xl + MAX_LG)

Threshold-only tiering produced 14+ lg cards on a typical feed (every fresh text-heavy item has `score ≥ 1.0` after the multiplier). After sorting by `prominence` descending, `rankItems` walks the array and applies caps:

- **Top-1 lg-qualifying → `xl 3×2`.** Single full-width feature slot at top of feed.
- **Next `MAX_LG = 3` → keep `lg 2×2`, alternating anchor.** Even index → `colStart: 1` (cols 1–2); odd → `colStart: 2` (cols 2–3). Emphasis distributes across the page instead of stacking left.
- **Further lg-qualifying → demoted to `md`** (per-type geometry from above). Lg becomes a true accent (~2–3 per page).

The `xl` cell is 3×2 but `ContentCard` receives `size='lg'` — the chrome stays the same, the cell just fills more space ([ContentGrid:314](../../components/ContentGrid.tsx:314)).

### 10. Gradient sm weave + run-breaker

Sort by prominence naturally clusters items of similar size (and similar type, since type multiplier feeds into score). Without a redistribute pass, the feed reads top-to-bottom as: features → tall portraits → wide landscapes → wall of squares. Two-step fix in `rankItems`:

1. **Gradient sm distribution.** After `TOP_KEEP = 4` (xl + lg cluster stays intact), the algorithm picks where to inject each sm via `target_sm_count(p) = ((p+1)/total)^K · sm.length` with `K = 1.5`. K > 1 biases sm toward the end; the curve still sprinkles sm through the middle so the page never ends in a wall of squares.
2. **Run-breaker pass.** Up to 4 sweeps of local swaps (forward search preferred, backward fallback) to flatten any leftover `mdT mdT mdT` runs inside the big-items zone. Shape key includes `colStart` so the lg-L / lg-R alternation isn't penalized as a run.

Empirical result on the current feed (33 items): longest same-shape run dropped from 11 to 2; the grid now ends with mdW landscape cards instead of a sm cluster.

## Open questions

- `computePeakByType` uses **current max observed HP** as the denominator — a prototype shortcut. The spec (per code comments) calls for a **rolling 90-day p90**. That needs a real backend. See [[Supabase Migration]].
- HP writer side (`hp_events` inserts) is deferred — see `project_hp_writer_deferred` memory. Migration 0008 shipped the rollup cron, but no surface currently writes events. Today's feed shape is driven by `editorial` flag + decay + per-type multipliers, not by interaction signal.
- Tunables (`SPAWN_HP_DEFAULT`, `TYPE_SCORE_MULTIPLIER`, `MD_GEOMETRY`, `MAX_LG`, `K`, `MAX_RUN`, `TOP_KEEP`) are magic numbers in one file. Fine for now; if they drift into the UI for admin tweaking, pull them to a config.

## Links

- [[Size and Position as Only Signals]]
- [[No Algorithm]]
- [[Editorial Flag]]
- [[Pinned Hero]]
- [[ContentGrid]]
- [[ContentCard]]
- [[curation]]
