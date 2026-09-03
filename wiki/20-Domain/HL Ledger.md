---
type: domain
status: current
tags: [hp, hl, ledger, hp-events, rollup, decay, migration, privacy, recepcion]
updated: 2026-09-02
---

# HL Ledger

> `hp_events` used to be a five-minute buffer that deleted everything it processed. Migration 0049 turns it into an append-only ledger. **History starts the day that migration is applied and not one second earlier.**

## What

`hp_events` is the item-side interaction table: one row per reader gesture that grants HL to a piece of content. Four kinds (`click`, `open`, `save`, `comment`), written by `record_hp_event()` (migration 0025) from `POST /api/hp-events`. `apply_hp_rollup()` runs every five minutes on pg_cron and folds pending rows into `items.hp` with decay-aware re-anchoring.

Until [0049 §1–§4](../../supabase/migrations/0049_admin_central.sql) the rollup **hard-deleted** every row it folded. The table was empty by definition between ticks. The `kind` column — the only place an item's click/open/save/comment breakdown ever existed — was discarded at rollup time and persisted nowhere.

After 0049 the rollup **marks** rows instead: `processed_at = now()`. Rows survive, and the panel can ask what an item's attention was actually made of.

The one vocabulary for all of this lives in [kinds.ts](../../lib/hp/kinds.ts) — weights, labels, two-letter codes, swatch hues, the two system kinds, and `LEDGER_EPOCH`. Read from there; do not re-declare.

## What was destroyed

**Roughly 2,110 events, and they are unrecoverable.** There is no backfill: the rows were deleted, `items.hp` carries only their summed effect, and nothing else in the schema retained the `kind`. No amount of reconstruction produces a breakdown for a single day before the migration.

This mirrors exactly what migration 0020 did on the **user** side — which is why `user_hp_events` has retained rows back to May while the item side has none at all. The asymmetry is not a bug in 0049; it is the gap 0049 closes, four months late.

The practical consequence, and the reason this note exists: **a 30-day window opened the week 0049 lands is mostly pre-history.** Rendering that window as a flat line at zero would read as "nobody interacted", which is the opposite of the truth.

## LEDGER_EPOCH

```ts
export const LEDGER_EPOCH = '2026-09-02'   // lib/hp/kinds.ts
```

The date the item-side ledger began — set to the day the migration is applied in production.

**Every admin surface that charts item HL over time MUST clamp its window to this date and say so.** The contract is carried in two places:

- `getAdminOverview()` returns `ledger: { epoch, coveredFrom, blindDays }` — `coveredFrom` is the first day of the requested window the ledger actually covers, `blindDays` is how much of it cannot contain data. The RESUMEN tab prints that as a `MarginNote` rather than drawing empty chart.
- `getAdminItemDetail()` returns `ledgerStartsAt` for the same purpose on one item's dossier.
- `isBeforeLedger(iso)` is the predicate for anything else that needs the test.

Until the migration is applied, the whole ledger is pre-history and the UI prints its «SIN HISTORIAL» state. Nothing HL-related in the new panel shows data before then — see [[Next Session]].

## base_weight vs weight — and why weight is not a count

`hp_events.weight` has **always** been the product of a nominal weight and a per-caller novelty multiplier `m ∈ [0.6, 1.5]` ([[Novelty Weighting]], migration 0025). Without the base stored, a 0.5-weight click and a 0.75-weight click are indistinguishable rows.

0049 §1 adds `base_weight`: the nominal `KIND_WEIGHTS` value *before* the multiplier.

```
weight = base_weight × m        m ∈ [0.6, 1.5], never stored, never returned
```

The rule, and it holds everywhere in the panel:

> **Count reader events with `base_weight`. Sum HL with `weight`. `sum(weight) / KIND_WEIGHTS[kind]` is NOT an event count** — it can be wrong by up to ±50% in either direction.

Storing the base exposes the two endpoints of the multiplication and nothing more. `m` itself stays under the hood by decision — it is the mechanism that gets people out of their genre box without ever telling them so, and echoing it to a client would make it gameable.

**`base_weight` is NULL** on rows written before 0049 and on **both** system kinds. Where a count cannot be known, the UI prints an em dash — never `0`, never a figure derived from `weight`.

## The two system kinds

Neither can be produced by a reader. Both are stamped `processed_at` at insert, so the rollup never folds them a second time.

| Kind | Written by | `weight` | `base_weight` | Meaning |
|---|---|---|---|---|
| `admin_adjust` | `admin_adjust_item_hp()` (§5) | signed, = applied delta | NULL | An audited HL injection. See [[Admin Instrument Exemption]]. |
| `decay` | `apply_hp_rollup()` (§3) | **negative** | NULL | What that tick's decay removed from one item. |

They exist as ledger kinds precisely so injected HL shows as its own band instead of blending into organic reach — and so `decay` can be drawn as a real loss series rather than inferred.

They are deliberately **excluded from the reader-kind legend**. `isReaderKind()` is the filter; the breakdown table shows only the four gestures. `decay` is chart-only, `admin_adjust` is a separate stated line under the item's breakdown. A fifth swatch beside the four gestures would let an injection be read as a flavour of engagement.

## The decay scope limitation

`apply_hp_rollup()` writes a `decay` row **only for items it re-anchors in that tick — that is, only items that received an event in the same five minutes.**

That is exactly the right complement to the gains: **gains + this decay = the real net change in `items.hp`**, which is what the FLUJO DE VIDA net line means. It is *not* corpus-wide decay. The other ~590 items are also decaying, continuously and lazily, and none of that appears here.

**Never label it corpus-wide.** A panel that did would be lying, and the number is off by orders of magnitude at current traffic.

Why the scope is not widened: decay is computed, never stored, and the anchors it was computed against are overwritten by the same `UPDATE` that applies it. It cannot be reconstructed after the fact. Recording it forward, for the rows the rollup already touches, is the only honest line available without a second cron pass over all 601 items every five minutes.

## The 180-day sweep

`sweep_old_hp_events()` (§4) runs daily on pg_cron (`hp-events-sweep`, `20 4 * * *`) and deletes rows **processed** more than 180 days ago.

- At ~17 events/day the ledger grows ~6k rows/year — free at this scale. The sweep exists so it stays free after the beta.
- 180 days is six times the longest window the admin UI offers (30 days) and leaves room for a quarter-over-quarter read. It is also the ceiling `clampDays()` and the stats route clamp to: asking for more can only add empty space and imply data was lost rather than never kept.
- **Pending rows are never touched.** `processed_at IS NULL` is unapplied HL; deleting it would silently drop engagement.

## Traps

**The unfiltered cursor (the highest-risk line in 0049).** The live `apply_hp_rollup()` body opened with a completely unfiltered `select array_agg(id) into rolled_ids from hp_events;`. That was harmless only because the last statement deleted every row it read. Once rows are retained, the same select re-reads the **entire ledger every five minutes and re-folds all of it** into `items.hp`. HP compounds without bound, feed ordering corrupts within hours, and **nothing errors** — no exception, no log line, no failed cron run. The two edits are a pair and must ship together:

1. the opening cursor gains `where processed_at is null`
2. the closing `delete from hp_events` becomes `update … set processed_at = now()`

**Indexes must land in the same migration as the retention change, never after it.** Production had only `hp_events_pkey(id)` and `hp_events_window_idx(created_at)` — no index on `item_id` at all. The rollup's own `join hp_events e on e.item_id = i.id` was cheap only because the table was near-empty between ticks. §1 adds `hp_events_unprocessed_idx (created_at) where processed_at is null` (the rollup's hot path, partial so it stays one tick wide) and `hp_events_item_kind_idx (item_id, kind, created_at desc)` (every breakdown query).

**Branch function bodies from the live database, not from the files on disk.** 0049 §2/§3 were branched from `pg_get_functiondef` read on 2026-09-02. The migration files lie: 0008's body is stale V1, and `apply_hp_rollup` has been re-created four times (0008 → 0022 → 0024 → 0048). Branching from an earlier file silently reinstates `when 'partner' then 8760.0`, which no longer casts to `content_type` since the [[Franjas Ecosystem|partner → franja]] rename — and the cron then fails into the cron log with no visible symptom. See the migration-history-drift note.

## The creator-facing read

`/admin` was the ledger's only reader for its first day. Migration 0050 adds the second, and it is a fundamentally different kind of reader: **a creator asking about their own work**, not an operator reading an instrument. The whole surface is [[Recepcion]] (`/dashboard?espacio=recepcion`), and the shape of the read is what keeps it inside the laws.

`creator_reception(p_days int)` ([0050 §2](../../supabase/migrations/0050_reception.sql)) is `security definer`, scoped to `items.created_by = auth.uid()`, and returns `{days, since, items[], totals[]}`. Per item and per reader kind it returns an event **count** and that kind's **share** of that item's earned HL. It never returns a raw `hp_events` row, and it never returns a weight.

Both omissions are load-bearing and neither is defensive coding:

- **No raw rows.** `hp_events` has no `user_id`, so a row cannot name anyone directly — but per-event timestamps at 61 users are close enough. "Someone saved this at 14:32" is a person. Aggregation happens **in the function**, so the UI is never the privacy boundary.
- **No per-kind weight.** `weight = base_weight × m`, `m ∈ [0.6, 1.5]` ([[Novelty Weighting]]). Returning both `events` and a per-kind weight lets anyone divide one by the other and recover `m` — the multiplier the product deliberately keeps under the hood. A **share** closes that: the item's total earned HL is never returned, so `share × (unknown total)` does not solve for a weight.

**The residual, disclosed in the 0050 header and repeated here so nobody trusts the guard further than it goes.** Shares plus counts do leak the **relative nominal ladder** to anyone willing to regress them. An item with one click and one open reports 25% / 75%, and 75/25 is 1.5/0.5. What that recovers is the *ratio between nominal weights* — not `m`, which varies per reader and averages away, and not any absolute value. The guard is against a price list printed on the screen, not against a determined analyst with a spreadsheet. If the ladder itself must stay secret, the feature cannot ship in any form; that trade was made knowingly. See [[Admin Instrument Exemption]] for the line being drawn.

The creator-side half of the same surface reads `user_hp_events` directly, and **there the leak is wider**: the daily series sums to the window total, share × total recovers per-kind weight sums to rounding, and creator-side weights are flat constants with no multiplier to blur them (0018). Same trade, stated in the route header rather than hidden.

### §1 — the attribution_key leak this migration closed

Found while building the read, and worth applying **even if RECEPCIÓN never ships**:

- `user_hp_events_self_read` admits a user to their own rows (`user_id = auth.uid()`).
- A row's `user_id` is the **recipient** — the creator who earned the HP.
- `attribution_key` on those rows is `item_saved:<item_id>:<SAVER_ID>` and `reaction_received:<comment_id>:<REACTOR_ID>`.
- `authenticated` held a blanket table-level `SELECT` with no column restriction.

So any logged-in creator could `GET /rest/v1/user_hp_events?select=attribution_key` and recover the user id of every person who saved their content or reacted to their comments. **Saves are anonymous by design** — the product shows a save count to nobody and a saver to nobody — and this handed the creator the full list.

0050 §1 fixes it with the same revoke-then-regrant-by-column ritual 0049 §6 used on `items.hp`, because a column-level `REVOKE` cannot narrow a table-level grant. Admins lose the column too, deliberately: an admin is `authenticated` at the Postgres level and no admin surface needs saver identities. The dedup that genuinely depends on the column (`on conflict (attribution_key)`, all eight writers) runs inside `security definer` functions as the table owner and is unaffected.

## Where it lands

| Piece | Location |
|---|---|
| Schema, indexes, retention, both system kinds | [0049_admin_central.sql](../../supabase/migrations/0049_admin_central.sql) §1–§5 |
| Kinds, weights, codes, hues, `LEDGER_EPOCH`, `isReaderKind` | [kinds.ts](../../lib/hp/kinds.ts) |
| Aggregate reads (RESUMEN) | [adminStats.ts](../../lib/data/adminStats.ts) |
| Per-item reads (CONTENIDO dossier) | [adminItems.ts](../../lib/data/adminItems.ts) |
| Creator-facing read + `attribution_key` revoke | [0050_reception.sql](../../supabase/migrations/0050_reception.sql) → [reception/route.ts](../../app/api/users/me/reception/route.ts) → [[Recepcion]] |
| Writer | `record_hp_event()` via [hp-events/route.ts](../../app/api/hp-events/route.ts) |
| Rollup / sweep | pg_cron — rollup every 5 min, sweep daily 04:20 |

## Open questions

- `LEDGER_EPOCH` is a hand-set constant. If the migration is applied on a different day than 2026-09-02, **edit it to match** — a wrong epoch either hides real data or claims coverage that does not exist.
- No `decay` row is written when the change is below `0.0001` HL. Harmless at current magnitudes; worth remembering if half-lives are ever lengthened enough to make per-tick decay routinely smaller than that.
- The sweep bounds the ledger but nothing rolls it up first. When 180 days of raw rows stops being cheap, the answer is a daily per-item-per-kind aggregate table, not a shorter retention — shortening it is how the first 2,110 events were lost.

## Links

- [[HP Curation System]] — what the ledger feeds
- [[Admin]] — the operator surface that reads it
- [[Recepcion]] — the creator surface that reads it, and the aggregate it is allowed
- [[Admin Instrument Exemption]] — why those numbers are visible at all, and where the creator-facing line is drawn
- [[Novelty Weighting]] — the multiplier that makes `weight` unusable as a count
- [[curation]] · [[Backend Plan]]
