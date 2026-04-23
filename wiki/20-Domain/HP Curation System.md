---
type: domain
status: current
tags: [curation, hp, decay, ranking, core-concept]
updated: 2026-04-22
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

`cardLayout(item)` assigns a `{ tier, colSpan, rowSpan, intensity }`:

| Score | Tier | Span |
|---|---|---|
| ≥ 1.0 | lg | 2×2 |
| ≥ 0.5 | md | 2×1 |
| < 0.5 | sm | 1×1 |

`intensity` is the intra-tier position (0–1), consumed by [[ContentCard]] as a CSS variable `--prominence` for subtle scale/padding effects.

## Open questions

- `computePeakByType` uses **current max observed HP** as the denominator — a prototype shortcut. The spec (per code comments) calls for a **rolling 90-day p90**. That needs a real backend. See [[Supabase Migration]].
- No "HP boost on interaction" exists because interactions aren't tracked. If we ever add "cited by an editorial" or "linked in an event" as a signal, it should raise `hp` and reset `hpLastUpdatedAt`.
- Tunables (`SPAWN_HP_DEFAULT`, `TYPE_SCORE_MULTIPLIER`, half-lives) are magic numbers in one file. Fine for now; if they drift into the UI for admin tweaking, pull them to a config.

## Links

- [[Size and Position as Only Signals]]
- [[No Algorithm]]
- [[Editorial Flag]]
- [[Pinned Hero]]
- [[ContentGrid]]
- [[ContentCard]]
- [[curation]]
