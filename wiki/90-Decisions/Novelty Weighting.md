---
type: decision
status: current
tags: [hp, curation, gamification, personalization, decision]
updated: 2026-06-02
---

# Novelty Weighting

> Get users out of their genre/vibe box **under the hood** — never with a visible nudge, badge, or filter. The only user-facing control is ever the [[VibeFader]]/[[VibeSlider]].

## What

The item HP a user *grants* through interactions (the `hp_events` weights — click/open/save/comment, see [[HP Curation System]]) is scaled by how **novel** the content is to *that user*, across three axes: **genre, content-type, and vibe-band**.

```
effective_weight = KIND_WEIGHTS[kind] × novelty(user, item)
```

A house-head's repeated house interaction is discounted (~0.8×); their rare jazz interaction is amplified (up to ~1.5×). Emergent effect across the community: **content that draws interest from outside its usual audience rises more than echo-chamber content.** Nobody is told this; it falls out of the weighting.

## Why it's allowed under [[No Algorithm]]

**Reads stay global.** The feed is still ranked by one shared `items.hp` scalar, identical for every viewer. Only the **write weight** is personalized — never the view. There is no per-user feed, no per-user ranking, no re-ordering by taste. So "don't personalize the feed per user" is intact; we personalize the *vote weight*, not the *display*.

## The one rule it relaxes

`lib/curation.ts:5` states *"No per-user logs; HP lives on the item as an aggregate scalar."* This feature requires a **private per-user affinity profile** (`user_axis_affinity`): a decayed tally of what genres/types/vibes each user engages with. Mitigations that keep it consistent with the rest of the design:

- **Never exposed.** The table is RLS-locked with *no* client policies — reachable only by the `record_hp_event()` SECURITY DEFINER function. Consistent with [[Roles and Ranks]] / the "HP scalar is private" rule (only trophies/frames/firma are public progression).
- **The `hp_events` row stays anonymous** — it records `(item_id, kind, weight)`, never `user_id`. The affinity profile is the only new per-user state, and it is write-authoritative (server-only), so the novelty signal can't be gamed by editing your own profile.

## Mechanic

`novelty(user, item)`:
1. `φ_axis` (familiarity) per axis = share of the user's recent decayed attention on that axis that has gone to this item's value(s). Genre uses the mean over the item's genres; type/vibe are single-valued (vibe bucketed low 0-3 / mid 4-6 / high 7-10).
2. composite `φ = (Σ w_axis · φ_axis) / Σ w_axis` over axes that have history (weights renormalized so a cold axis doesn't drag the result). Axis weights: **genre 0.5 · type 0.2 · vibe 0.3** (genre is the strongest "box").
3. `m = clamp(M_MIN + (M_MAX − M_MIN)·(1 − φ)^GAMMA, M_MIN, M_MAX)`.

Blending *familiarities* into one bounded curve (rather than multiplying per-axis multipliers) keeps `m` inside `[M_MIN, M_MAX]` no matter how many axes — adding axes refines, never explodes. Because a *typical* interaction is mixed (familiar genre, maybe-new vibe), most land near 1.0×; only the genuine extremes are strongly weighted. The multi-axis design self-moderates.

## Calibration — "gentle" spread (shipped 2026-06-02)

`M_MIN 0.6 · M_MAX 1.5 · GAMMA 1.0 (linear) · half-life 45d · cold-start 15 interactions`

| interaction | multiplier |
|---|---|
| does exactly the usual (familiar on all 3 axes) | ~0.82× |
| familiar genre, new format + vibe | ~1.10× |
| novel on all 3 axes | ~1.47× |

→ a crossover interaction pushes ~1.8× as hard as an echo one, same raw count. Familiar interactions are *barely* discounted (taste isn't punished); novel ones are mildly rewarded. Tuned + validated in `scripts/noveltySim.mjs` — **keep that file in lockstep with `record_hp_event()`**.

**Cold start:** `m = 1.0` until a user has ~15 interactions, so newcomers don't over-boost everything they touch. **No "voting-budget" normalization yet** (would amplify the spread; add only if heavy users' total influence needs reining in). **Re-tune from production affinity data after a few weeks of beta** — the shipped numbers come from assumed profiles.

## Risks / notes

- **Niche tailwind (intentional):** niche content in a skewed scene (jazz in a house-heavy community) gets a systematic boost because almost everyone is an outsider to it. Aligns with [[Guides Not Gatekeepers]] / editorial diversity. `M_MAX` + the bounded curve keep a small clique from vaulting truly obscure content.
- **Genre-less content:** items with no genres simply drop the genre axis (type+vibe still weight). Foro is unaffected (no `hp_events`).
- Composes with the balanced `KIND_WEIGHTS` tuning and the `max → rolling p90` normalization roadmap item (see [[curation]]).

## Where it lands in the code

| Piece | Location |
|---|---|
| Affinity store | `user_axis_affinity` table — `supabase/migrations/0025_novelty_weighting.sql` |
| Weighting + insert + affinity update | `record_hp_event()` (SECURITY DEFINER, constants in body) — same migration |
| Call site | `app/api/hp-events/route.ts` (`.rpc('record_hp_event', …)`; multiplier not echoed) |
| Tuning bench | `scripts/noveltySim.mjs` |

## Links

- [[HP Curation System]] · [[curation]] · [[No Algorithm]] · [[Guides Not Gatekeepers]] · [[Roles and Ranks]] · [[Vibe Philosophy]]
