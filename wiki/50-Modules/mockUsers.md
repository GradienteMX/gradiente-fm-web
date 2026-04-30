---
type: module
status: current
tags: [mock, users, identity]
updated: 2026-04-29
---

# mockUsers

> The 8-user prototype roster + the badge/label/color maps used to render identity chrome. Covers every role, both flags, and the rank derivation enough that any UI we build is exercised against realistic plurality.

## Source

[lib/mockUsers.ts](../../lib/mockUsers.ts)

## Roster

| id | username | role | flags |
|---|---|---|---|
| `u-datavismo` | datavismo-cmyk | admin | — |
| `u-hzamorate` | hzamorate | guide | — |
| `u-ikerio` | ikerio | guide | — |
| `u-mod-rumor` | rumor.static | user | isMod |
| `u-og-loma` | loma_grave | user | isOG |
| `u-insider-tlali` | tlali.fm | insider | — |
| `u-curator-radiolopez` | radiolopez | curator | — |
| `u-normal-meri` | merimekko | user | — |
| `u-normal-yag` | yagual | user | — |

The seed deliberately covers the design space:
- Four staff tiers (admin / guide×2 / insider / curator). The curator (`radiolopez`) exercises the [[NuevoSection]] gate's curator-only path — they see only `LISTA` in the template grid.
- A user-tier mod (`isMod` is orthogonal to role — see [[Roles and Ranks]]).
- A user-tier OG (`isOG` is a cosmetic flag).
- Two plain users with no flags — their badge is whatever rank the !/? reactions in [[mockComments]] derive.

## Helpers

- `getUserById(id)` / `getUserByUsername(username)` — Map lookups.
- `listUsers()` / `listUsersByRole(role)` — for picker UIs (e.g. [[LoginOverlay]] quick-switch).

## Display maps

- `ROLE_LABEL` / `ROLE_COLOR` — staff role chips (ADMIN / INSIDER / GUÍA / CURADOR / LECTOR).
- `RANK_LABEL` / `RANK_COLOR` — user-tier chips (NORMIE / DETONADOR / ENIGMA / ESPECTRO).
- `FLAG_LABEL` / `FLAG_COLOR` — sibling chips (MOD red / OG amber-gold).

`badgeFor(user, rank)` returns the *primary* chip:
- staff role → role label/color
- `user` role → rank label/color (caller passes in the derived rank)

`flagsFor(user)` returns the ordered flag list (mod first, then og) for sibling chips.

## When the real backend lands

Swap the static `MOCK_USERS` array for a Supabase `users` query. Consumers use `getUserById` / `listUsers` and won't change.

## Links

- [[Roles and Ranks]] — the role/flag/rank design
- [[permissions]] — the helpers that consume `User`
- [[CommentList]] · [[PostHeader]] · [[LoginOverlay]] — main consumers of `badgeFor` / `flagsFor`
- [[mockComments]] — the reaction data that derives ranks for this roster
