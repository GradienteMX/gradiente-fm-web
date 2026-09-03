---
type: page
status: current
tags: [dashboard, recepcion, hp, hl, privacy, creator, espacios]
updated: 2026-09-02
---

# Recepción — `/dashboard?espacio=recepcion`

> The fifth space in «EL PLIEGO»: a creator seeing how their **own** work was received. Read-only, self-only, and deliberately built without a lever — there is nothing here to pull, only something to read.

## What it is

RECEPCIÓN answers one question a creator has never been able to ask on this product: *did anyone receive this?* Until now the only honest answers were the mosaic itself (size and position, per [[Size and Position as Only Signals]]) and the private HL scalar in the identity spine's PRIVADO block — one number, no shape.

The space adds **shape**: which gestures the attention was made of, in what proportion, over how many events. It adds no new number to any shared screen, no comparison against anyone else, and no control that changes anything.

It is a **sheet**, not a widget grid. Only PANEL is a grid — see [[Dashboard]] — so mounting RECEPCIÓN cost the layout system nothing: `DashboardLayoutMeta` stays at `v: 4`, the packer is untouched, and edit mode still operates on the one and only grid.

## Where it mounts

| Piece | Location |
|---|---|
| Space id, label, tab order, gate | [espacios.ts](../../lib/dashboard/espacios.ts) — `'recepcion'`, label `RECEPCIÓN`, appended after `mercado` |
| Mount point | [page.tsx](../../app/dashboard/page.tsx) — the tail of the space dispatch |
| Sheet | [ReceptionSpace.tsx](../../components/dashboard/espacios/ReceptionSpace.tsx) |
| Read | [GET /api/users/me/reception](../../app/api/users/me/reception/route.ts) |
| Backend | [0050_reception.sql](../../supabase/migrations/0050_reception.sql) — `creator_reception(p_days int)` |
| Tests | [espacios.test.ts](../../tests/dashboard/espacios.test.ts) |

**It is universal — no grant.** FRANJA and MERCADO are gated on `flags.isFranjaTeam` and listed in `FRANJA_ONLY_ESPACIOS`; RECEPCIÓN is not in that list, because *every* account accrues HP. An account that has never published still earns `vibe_check_cast`, so there is no viewer for whom the sheet is empty by construction — and the fase-D rule «no grant, no tab» is about not rendering a tab whose body would be dead, which is not this case. The gate list is now data rather than a boolean chain precisely so a new space inherits the ungated default deliberately.

`resolveEspacio` still falls back to PANEL for anything unknown or ungranted, so a hand-typed `?espacio=recepción` (with the accent the *label* carries and the *id* does not) lands on the panel rather than on a broken page.

## The two sub-tabs

The split is not cosmetic. The two halves read **different ledgers with different amounts of history**, and the order they appear in is the honest response to that gap.

### PRESENCIA — leads, because it has history

Reads `user_hp_events`, the **creator-side** ledger, running since May 2026 ([[HL Ledger]] explains why this side survived and the item side did not). Four months of real rows.

Per creator-side kind: an event **count** and that kind's **share** of the window's HP, plus a daily total series for the sparkline. Nine buckets: `item_saved`, `comment_received`, `reaction_received`, `comment_saved`, `harvest`, `vibe_check_cast`, `vibe_check_accurate`, and a synthetic `publish` that folds the eight `publish_<type>` writer variants into one — splitting a creator's own publishing across eight rows is noise in a surface about how *others* received them.

**Why this one leads.** Opening on the item side would greet every creator with an empty chart and read as "nobody received you", which is the opposite of the truth. Leading with presence is a correctness decision, not a layout preference.

### OBRA — the per-item shape, hours old

Reads `hp_events` through `creator_reception(p_days)`, the **item-side** ledger, which began at `LEDGER_EPOCH = 2026-09-02`.

Per item the creator owns (`items.created_by = auth.uid()`, franjas excluded — a franja row is rail furniture with a 365-day half-life, not a piece someone wrote): the four reader kinds (`click` · `open` · `save` · `comment`), each with an event count and its **share** of that item's earned HL, plus a `totals[]` roll-up across the window.

`items.hp` arrives as a **stale anchor** and is decayed to now with `currentHp()` ([curation.ts](../../lib/curation.ts)) before anything is displayed. HL itself is shown as words via `hlBracket()` ([hl.ts](../../lib/dashboard/hl.ts)), not as a scalar.

When migration 0050 has not been applied, PostgREST returns `PGRST202` — the call never reaches Postgres, it is resolved against PostgREST's own schema cache, so `42883` is only seen in the narrow window where a cached function has been dropped; the route accepts both — and degrades to `obra: null, obraEstado: 'migracion_pendiente'` — rendered as a `MarginNote` naming the real limit, never as an `ErrorLine` and never as an empty item list, which would read as "nobody received your work".

## The honesty rules it holds

1. **Proportions and counts, never weights.** The surface says «la mayoría de tu HL vino de guardados» with a bar and an honest event count. It never prints a weight, a multiplier or a `× 4.0` ladder. `KIND_WEIGHTS` is not imported into this surface at all. The reason is one sentence long: *a creator handed a price list optimises for the price list instead of the work.*
2. **HP leads, HL follows** — see the sub-tab order above.
3. **Nothing identifies who did what.** No `attribution_key`, no per-event timestamps, no raw ledger rows. Saves are anonymous and that is a product promise, not a default. Migration 0050 §1 revoked the column from `authenticated`, and the route does not try to route around it.
4. **Honest emptiness.** `EmptyLine` for absent, `ErrorLine` for failed, `ShimmerLine` for loading, `MarginNote` for a real system limit. No fake rows, no spinners, no invented numbers — the [kit](../../components/dashboard/espacios/kit.tsx) register PUBLICAR and MERCADO already hold.
5. **Self-only, permanently.** There is no `/api/users/<id>/reception` and there must not be. The moment reception can be pointed at someone else it is a leaderboard, which is the thing the private HP scalar exists to prevent ([[Roles and Ranks]]).

## Known limits

State these out loud in the surface rather than smoothing them over.

- **The item-side window is mostly pre-history.** `hp_events` retained nothing before 2026-09-02; roughly 2,110 events were hard-deleted by the old rollup and cannot be reconstructed. A 30-day OBRA window opened today covers hours, not thirty days. [[HL Ledger]] has the full account.
- **PRESENCIA has real history since May, and only because the user side was fixed first** (migration 0020). The asymmetry between the two halves is the whole reason this space has two tabs.
- **`vibe_check_accurate` has never fired in production and will keep reading zero.** Migration 0021 credits that bonus only once an item reaches `check_count >= 5`; the busiest item in prod has 3. The row is shown anyway at zero — a gesture that exists and has never paid out is a true thing to show, and hiding it would make the zero look like missing data rather than an absent event.
- **Counts come from `base_weight`, which is NULL on pre-0049 rows.** Where a count cannot be known it is an em dash, never `0`, and never a figure divided out of `weight`.
- **Shares plus counts leak the relative nominal ladder** to anyone willing to regress them. Disclosed in the 0050 §2 header and recorded in [[HL Ledger]] and [[Admin Instrument Exemption]] — the guard is against a price list on the screen, not against a determined analyst with a spreadsheet.
- **Migration 0050 is not applied yet.** Until it is, OBRA renders `migracion_pendiente` and PRESENCIA carries the space on its own. See [[Next Session]].

## Links

- [[Dashboard]] — the surface this is the fifth space of
- [[HL Ledger]] — both ledgers, the epoch, and what the data cannot say
- [[Admin Instrument Exemption]] — the line this space sits closest to, and the distinction actually drawn
- [[Novelty Weighting]] — the multiplier that stays under the hood, and why shares rather than weights
- [[HP Curation System]] · [[Size and Position as Only Signals]] · [[No Algorithm]] · [[Roles and Ranks]]

## Open questions

- The window is fixed at the route's clamp (1–180 days, default 30). Whether the space should offer a picker at all is undecided: a range control is one more thing to fiddle with on a surface whose whole point is that there is nothing to pull.
- OBRA has no per-item history chart and should not get one until the ledger is old enough for a line to mean something. Revisit after ~60 days of retained `hp_events`.
- Nothing here is exposed on `/u/[username]` and nothing should be. If a public «recepción» is ever wanted, it is a different decision with a different note, not an extension of this one.
