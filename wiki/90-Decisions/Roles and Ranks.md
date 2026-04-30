---
type: decision
status: current
tags: [decision, identity, permissions, comments, foro]
updated: 2026-04-29
---

# Decision — Roles, Flags, and Ranks

> The site has *three* identity axes — a hierarchical creation tier, two orthogonal flags, and an auto-derived posting-texture rank. None of them rank content; they rank *people who post*.

## Decision

Three independent identity axes per user.

### 1. Role — hierarchical creation tier (with one sibling pair)

```
user (0) < curator (1) < {guide, insider} (2) < admin (3)
```

- `user` — read, vote, post in foro/comments. The default tier.
- `curator` — adds list / poll / marketplace card creation rights.
- `guide` — staff editorial voice. Adds opinion + mix publishing on top of curator. Tier 2.
- `insider` — scene voice (DJs, promoters, venue folks). **Sibling of guide** at tier 2 — same publishing rights, different byline framing.
- `admin` — everything plus role assignment and feed-content deletion.

Higher ranks inherit lower-rank capabilities. `hasRole(insider, 'guide')` returns true (and vice versa) because they share rank 2; for *display*, branch on `user.role === 'guide'` directly.

### 2. Flags — orthogonal capability/cosmetic chips

- `isMod: boolean` — pruning capability. Delete comments, delete foro threads, leave tombstones with a stated reason. **Independent of role tier** — a `user`-tier mod is a regular reader the team trusts to prune. Admins get it implicitly via `canModerate`.
- `isOG: boolean` — cosmetic first-wave-registrant badge. Admin-granted, no capability attached. Recognition only.

### 3. Rank — derived posting texture (user tier only)

Computed on read from the !/? reactions a user has *received* on their comments. Not stored on the User type.

| Rank | Meaning | Trigger |
|---|---|---|
| `normie` | floor / unsorted | total received !/? < 5 |
| `detonador` | sparks heat, signal-flares | ≥65% of received reactions are ! |
| `enigma` | sows doubt, opens questions | ≥65% of received reactions are ? |
| `espectro` | balanced + active | between, past threshold |

A user moves between the three mature ranks as their reaction profile shifts. The rank is alive — it tracks who they've become this week, not who they were three months ago.

## Reaction palette — ! and ? only

Comments accept exactly two reaction kinds:

- `[!]` (signal) — excitement, controversy, signal-flare
- `[?]` (provocative) — doubt, questions, productive disturbance

`+`/`-` (resonates/disagree) were dropped. Up/down-voting reduces a comment to *I like / I don't like* — the antithesis of editorial discussion. Both ! and ? are productive: they signal a comment is alive, in different directions.

**Mutual exclusivity.** A user holds at most one reaction per (user, comment). Clicking the other kind replaces; clicking the same kind clears. The store enforces this in `toggleReaction` (see [[comments]]).

## Why ranks aren't an "algorithm"

This is a deliberate carve-out from [[No Algorithm]] / [[Size and Position as Only Signals]].

The rules forbid engagement-driven *content surfacing* — what gets shown in the feed and at what size. The rank system doesn't touch that:

- Rank is purely a label on a *user's identity chip*. It does not affect ContentItem ordering, comment ordering, foro bump-order, or visibility.
- It mirrors back the texture of reactions a user has *received* — the same signal that's already public on every comment. No new metric is introduced; we're just labelling an aggregate that's already legible.
- Ranks are *peer recognition* in the old-school forum tradition (NORMIE → REGULAR → VETERAN), not score-to-beat. The names lean ironic-occult to underline that the system is laughing at its own ladder.

The line is: **labels on people, not weights on content**. If we ever made high-rank comments float up, or hid normie posts, that would cross into the No Algorithm territory we're trying to avoid.

## Alternatives rejected

1. **Strict totem-pole hierarchy with mod above guide.** The original model. Rejected because moderation trust and publishing trust are unrelated — a mod doesn't automatically deserve a byline, and a writer doesn't automatically deserve to delete others' words. Splitting them into role + flag matches reality.
2. **`userCategory: og/insider/normal` as a sub-axis of `user` role.** The old model. Rejected because `og`, `insider`, and `normal` aren't the same kind of thing: og is a manually-granted badge (now a flag), insider is editorial trust (promoted to a role), normal is the absence of distinction (replaced by rank derivation).
3. **Engagement-driven ladder (post count, time on site).** The classic gamification path. Rejected — encourages farming, conflicts with [[No Algorithm]], and the metrics it measures (volume) aren't the texture we want to surface.
4. **Manually-assigned ranks.** Curator / admin presses a button to label a user. Rejected because it requires constant attention and turns the rank into editorial favoritism. Derivation from reactions keeps it democratic and unsurprising.

## Sign-up gating

Beta launches **invite-only**. There's no public sign-up flow yet — `useAuth.tsx` resolves logins against `MOCK_USERS`. When real auth lands (see [[Supabase Migration]]), the invite-token gate goes in front of registration. Invitations are admin-issued; this falls under `canAssignRoles`-equivalent capabilities.

## Marketplace + polls — deferred

`canCreatePoll` and `canCreateMarketplaceCard` are wired in [[permissions]] but no UI surface exists yet. The `curator` role is the only thing those gates currently guard, and curator has no consumers in the prototype. Both surfaces can ship later without disturbing the role model — the permission helpers are already in place.

## Consequences

- **Pro:** the same person can be a `user` + `isMod` (community pruner), a `guide` (staff writer with no mod tools), a `curator` (lists/polls but no opinion column) — all combos are cleanly expressible.
- **Pro:** ranks make the foro and comment columns more legible without ranking content. You can recognise the local DETONADOR and the resident ENIGMA without anyone gaming a leaderboard.
- **Pro:** the !/? palette forces commenters to decide *what kind of reaction*. The mutual-exclusivity makes a reaction a small editorial choice instead of a thumb-twitch.
- **Con:** more identity surface to design for in Spanish UI — five role labels, four rank labels, two flag chips. Mitigated by `badgeFor()` returning a single primary chip per user.
- **Con:** rank derivation is O(all-comments) per read. Cheap at prototype scale; a real backend would precompute and cache.
- **Con:** dropping `+`/`-` removes a familiar gesture. Acceptable — the project explicitly rejects social-media reflex behaviors.

## Links

- [[permissions]] — pure-function helpers, the `canX` set, `getUserRank`/`rankFromCounts`
- [[mockUsers]] — the 8-user roster covering every role/flag/rank combination
- [[comments]] — reaction-toggle store with mutual exclusivity + `useUserRank` hook
- [[userOverrides]] — sessionStorage patch layer powering admin role assignment
- [[PermisosSection]] — the admin surface that writes role/flag overrides
- [[CommentList]] · [[PostHeader]] — badge rendering surfaces
- [[No Algorithm]] · [[Size and Position as Only Signals]] — the rules ranks live alongside (and don't violate)
- [[Guides Not Gatekeepers]] — the editorial-philosophy thesis the role model serves
