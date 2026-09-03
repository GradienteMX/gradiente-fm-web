---
type: decision
status: current
tags: [decision, admin, hp, hl, metrics, privacy, calibration, recepcion]
updated: 2026-09-02
---

# Admin Instrument Exemption

> `/admin` may show raw HL numbers. Nothing else may. The exemption is scoped to one server-gated surface, and the public laws it bends are untouched everywhere they were written for.
>
> **Amended the same day:** [[Recepcion]] lets a creator see the SHAPE of their own reception — proportions and counts, never the weight ladder, never anyone else's numbers, never who did what. That is a separate and narrower allowance, not this exemption widened. See «The creator-facing edge».

## What was bent

Three written rules say the product does not show engagement numbers:

| Rule | Where it is written |
|---|---|
| «Don't introduce visible engagement metrics (likes, play counts, trending badges)» | `CLAUDE.md` / `AGENTS.md`, *Things to avoid* |
| «Only size and position are visible ranking signals» | [[Size and Position as Only Signals]], and the `lib/curation.ts` module header it quotes |
| «Brackets are the only HL representation ever visible on shared screens: words, never the raw scalar (the identity spine's PRIVADO block is the sole numeric exception)» | [hl.ts:9](../../lib/dashboard/hl.ts) |

«CENTRAL DE ADMINISTRACIÓN» ([[Admin]]) breaks all three deliberately. It renders decayed HL as a number, a per-kind interaction breakdown with real event counts, a daily net-flow chart, and a per-item dossier carrying save / comment / vibe-check counts. The `hl.ts` header names exactly one numeric exception and it is not this one; that sentence is now one exception short, and this note is the second.

## Decision

**The exemption applies to `/admin` and to the `/api/admin/*` routes that feed it. Nowhere else.** Every clause below is load-bearing:

*(Amended 2026-09-02. [[Recepcion]] is not covered by this exemption and does not extend it — it is a narrower, separately reasoned allowance for a creator reading **their own** work. The section «The creator-facing edge» below draws the line and does not pretend it is a comfortable one.)*

- **Server-gated, not client-hidden.** [page.tsx](../../app/admin/page.tsx) resolves the session server-side, reads `users.role`, and `redirect('/')`s anything that is not `admin` — before rendering, so no HL number ever reaches a response body a non-admin could receive. Every route behind it goes through `requireAdmin()` ([requireAdmin.ts](../../lib/api/requireAdmin.ts)), which uses the caller's own session client so RLS stays the enforcing layer and the route is a second lock rather than the only one.
- **Eight accounts.** That is the entire audience of the exemption today, against 61 users.
- **The public surfaces did not change.** `/u/[username]` still shows zero HL numbers, the identity spine still shows the scalar only inside its own PRIVADO block, cards still encode prominence as size and position, and the feed still ranks on one global scalar. No number crossed over.

## Why

The team is calibrating a decay-based curation model at 61 users, and **you cannot tune what you cannot see.**

Before this surface existed, `/admin` could read exactly one content type (`eventos`, 450 of 601 items) and had no HP/HL surface at all — no tile, no column, no lever. The only way to ask "is the half-life for `mix` too long?" or "does the imminence bonus actually beat weight for tonight's event?" was to look at the mosaic and guess. Half-lives, `TYPE_SCORE_MULTIPLIER`, the novelty band `m ∈ [0.6, 1.5]`, the tier thresholds and `MAX_LG` are all magic numbers tuned against simulated profiles (`scripts/hpSim.mjs`, `scripts/noveltySim.mjs`) and never checked against production behaviour.

The alternative was to keep guessing until organic traffic grew large enough to make the shape obvious from the feed alone. At current volume — roughly 17 item-side interactions a day — that is a wait of months, during which every constant stays unverified and [[Novelty Weighting]]'s own standing instruction ("re-tune from production affinity data after a few weeks of beta") is simply unexecutable.

**The laws were written to protect readers and creators, and both protections survive.** [[Size and Position as Only Signals]] exists so browsing does not become popularity hunting; nobody browses `/admin`. [[No Algorithm]] exists so the feed is not personalized; `/admin` reads the same global scalar everyone else is ranked by, and changes nothing about how it is read. What the laws forbid is a *number placed in front of an audience*. Eight operators reading their own instrument is not an audience.

## What stays forbidden — here too

The exemption covers **visibility of aggregates** and grants nothing else. Three limits hold inside `/admin` exactly as they hold outside it.

### 1. No per-user attribution of item interactions — ever

`hp_events` records `(item_id, kind, weight, base_weight, created_at)` and **has no `user_id` column, by design** ([[Novelty Weighting]]; `record_hp_event()` in migration 0025). The admin panel therefore cannot show who clicked what, and adding that column to make it possible is **not a future enhancement — it is the thing this shape exists to prevent.** Anyone reaching for it should read this paragraph first.

The consequence is real and accepted: the per-kind breakdown can say "this item drew 14 aperturas" and can never say by whom. A moderation case that needs an actor has `reports.reporter_id` and `audit_log.actor_id`; item engagement does not get one.

### 2. User HL stays private and un-injectable

`users.engagement_hp` is not rendered on `/admin`, and the HL lever cannot write it (below). [[Roles and Ranks]] — trophies, frames, firma, composer emoji — remains the only public progression, and it stays earned.

### 3. Nothing here leaks outward

No admin-only figure may be plumbed into a public component on the grounds that it is already computed. The reads live in `lib/data/adminStats.ts` and `lib/data/adminItems.ts`; both open with `import 'server-only'` and both are consumed only by `/admin` and `/api/admin/*`.

## The creator-facing edge — RECEPCIÓN

*Added 2026-09-02, when the second reader of the ledger shipped.*

This note was written on the premise that the public laws exist **so a creator is never handed a number to chase**. [[Recepcion]] — the fifth space in `/dashboard` — hands a creator numbers about their own work. That is close enough to the line that pretending there is no tension would be dishonest, so here is the distinction actually drawn.

### What a creator may see

**The SHAPE of their own reception.** Proportions and event counts: which gestures the attention was made of, in what mix, over what window. «La mayoría de tu HL vino de guardados», with a bar and an honest count under it.

### What a creator may never see

Three refusals, and each one is the difference between a mirror and a scoreboard:

1. **Never the weight ladder.** No weight, no multiplier, no `× 4.0`. `KIND_WEIGHTS` is not imported into the surface, and `creator_reception()` returns a **share** rather than a weight precisely so the ladder cannot be divided out ([[HL Ledger]] has the arithmetic). The reason is the whole reason this section is short: *a creator handed a price list optimises for the price list instead of the work.* A number you cannot price is a description; a number you can price is a target.
2. **Never anyone else's numbers.** Self-only, permanently — `GET /api/users/me/reception` gates on the session and there is no `/api/users/<id>/reception`. Nothing is ranked, nothing is compared, no median or percentile is shown. A number that cannot be compared cannot be competed over, and that is what keeps [[Size and Position as Only Signals]] intact: browsing is still not popularity hunting, because none of this is visible while browsing.
3. **Never who did what.** No `attribution_key`, no per-event timestamps, no raw rows. `hp_events` has no `user_id` by design, and 0050 §1 revoked `user_hp_events.attribution_key` from `authenticated` after finding that a creator could read the id of everyone who saved their work. «No per-user attribution of item interactions — ever» (limit 1 above) applies here **more** strictly than on `/admin`, not less.

### Why this is not the same exemption

- **It is not an instrument.** `/admin`'s exemption is justified by calibration — you cannot tune what you cannot see — and it comes with a lever. RECEPCIÓN has no lever at all. It is read-only by construction: there is nothing on the surface that changes anything, so there is no mechanism through which optimising could pay.
- **It is not an audience.** The clause the `/admin` exemption turns on is that the laws forbid *a number placed in front of an audience*. A creator looking at the reception of their own work is not an audience either — there is exactly one viewer, and the subject is themselves.
- **It shows a different kind of number.** `/admin` shows a decayed HL scalar. RECEPCIÓN shows brackets (`hlBracket()`), proportions and counts. The scalar stays inside the identity spine's PRIVADO block, which `hl.ts` already names as the numeric exception.

### The tension, stated plainly

An event count *is* an engagement metric. «14 aperturas» is a number a creator can watch go up, and the honest reading of the *Things to avoid* line in `CLAUDE.md` is that this bends it — a third bend, on a surface that is not server-gated to eight accounts but visible to every logged-in account.

What holds the bend inside the intent rather than outside it: the counts are **yours only**, **uncomparable**, **unpriced**, and **attached to no control**. Remove any one of those four and this stops being defensible. Specifically:

- Add a comparison (a median, a rank, a "top 10% de creadores") and it is a leaderboard — reject it.
- Add a weight, a per-kind HL figure, or anything a ratio can be taken of, and it is a price list — reject it.
- Add a lever (boost, promote, re-share, "mejora tu alcance") and the read becomes a loop — reject it.
- Expose any of it on `/u/[username]` and it is a public metric — that is a different decision needing a different note, not an extension of this one.

**And the disclosed residual.** Shares plus counts leak the *relative* nominal ladder to a determined analyst willing to regress them (the creator-side half leaks it more cleanly, since those weights carry no novelty multiplier). That was accepted knowingly and is written into the 0050 header and [[HL Ledger]]. The guard is against a price list on the screen, not against arithmetic. If the ladder itself must stay secret, RECEPCIÓN cannot ship in any form — and that, not a UI tweak, is the decision to revisit if anyone ever concludes it must.

## The HL lever

The same exemption covers `admin_adjust_item_hp()` ([0049 §5](../../supabase/migrations/0049_admin_central.sql)), reached through `POST /api/admin/items/[id]/hp`.

**What it is for.** Producing feed states that organic traffic will not produce for months: what the mosaic looks like when a mix outranks tonight's event, how the tier ladder behaves at a bracket boundary, whether the creator-side HP loop responds the way the model claims. It is an instrument.

**What it is not.** It is not a curation thumb. `editorial`, `elevated` and `pinned` are the honest levers for "this piece should matter more" — declarative, visible in the item's own record, and they do not pretend engagement happened. Reaching for the lever to promote content is using the wrong tool, and the audit trail will say so.

**It is built to be impossible to hide.**

- Every call writes an `audit_log` row: actor, item, before, after, `applied` (which differs from the requested delta when the zero-floor clamps), and reason. The lever is that table's **first writer in four months** — the `0002_rls.sql` comment claiming inserts arrive from triggers was never true.
- Every call writes an `hp_events` row of kind `admin_adjust`, so injected HL renders as its own band and no chart in the product can mistake an injection for organic reach. `base_weight` stays `NULL`: an adjustment is not a counted reader event, so it never inflates an "N interacciones" figure.
- That ledger row is stamped `processed_at = now()` **at insert**, because the adjustment is applied inside the function. An unprocessed row would be folded into `items.hp` again on the next tick and apply twice.
- Reversal needs no extra machinery: `audit_log` carries before/after, so the UI reverts by applying the inverse delta — which is itself audited. There is no un-audited undo.
- `MAX_DELTA = 1000` is a fat-finger guard, not a policy ceiling. The highest HP any production item has ever reached is ~71.

**It touches items and stops there.** `users.engagement_hp` is off limits: user HL is earned and gates trophies, so injecting it would manufacture unearned status — precisely the corruption the [[Gamification]] risk list and the user-HL visibility rules were written against. Item HL decays and belongs to the feed; that is the difference, and it is the reason the lever's signature takes an item id and nothing else.

**An audited lever standing next to an unaudited back door is decorative**, which is why [0049 §6](../../supabase/migrations/0049_admin_central.sql) closes the raw path in the same migration. Before it, `authenticated` held a blanket table-level `UPDATE` on `items`, and all 39 elevated accounts could run `supabase.from('items').update({ hp: 999 })` from a logged-in browser session — no route, no audit, no trace. §6 revokes the table grant and re-grants it column by column, excluding the five HP columns, through `regrant_items_update()`.

**Side effect the operator must know**, and the UI states it at the point of commit: `score()` normalizes by the maximum `currentHp` observed per type in the rendered set ([curation.ts](../../lib/curation.ts)). Raising one item's HL raises its type's peak and therefore **demotes every other item of that type on the same page**. That is inherent to the curation model, not a defect of the lever.

## Consequences

- **Pro:** the constants become tunable against evidence instead of simulation, which is what the whole HL arc was for.
- **Pro:** injections are structurally distinguishable from reach, in the database, permanently — a stricter guarantee than a promise not to.
- **Con:** the codebase now holds one surface whose screenshots contradict its own design laws. That is what this note is for; a reviewer who finds the numbers before finding the reasoning is entitled to call it a regression.
- **Con:** the lever is a real temptation. The mitigation is the audit trail and the naming, not access control among eight people who all hold the role.
- **Con:** the "sole numeric exception" sentence in `hl.ts` is now inaccurate read alone. Correct it there if that file is ever edited; do not correct it by deleting this exemption.
- **Con (2026-09-02):** the count of surfaces showing engagement figures went from one to two, and the second is visible to every logged-in account rather than to eight. The four constraints in «The creator-facing edge» are what keep it a mirror rather than a scoreboard, and they are constraints on a UI — enforced by review and by the shape of `creator_reception()`, not by a role check. This is the weakest guarantee in the note; treat any proposal that erodes one of the four as the regression it is.
- **Pro (2026-09-02):** building the creator-facing read is what surfaced the `attribution_key` leak — a live path by which any creator could recover the identity of everyone who saved their content. That fix ([0050 §1](../../supabase/migrations/0050_reception.sql)) is worth applying whether or not RECEPCIÓN ever ships.

## Links

- [[Admin]] — the surface itself
- [[Recepcion]] — the creator-facing edge this note was amended for
- [[HL Ledger]] — the data both surfaces read, and what that data cannot say
- [[Size and Position as Only Signals]] · [[No Algorithm]] · [[Novelty Weighting]] · [[Roles and Ranks]]
- [[HP Curation System]] · [[curation]] · [[Gamification]]
