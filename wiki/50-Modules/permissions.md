---
type: module
status: current
tags: [permissions, roles, ranks, identity]
updated: 2026-04-29
---

# permissions

> Pure-function role / flag / rank helpers. Every gate the UI consults — content creation, comment moderation, role assignment, rank derivation — lives here. No React, no I/O.

## Source

[lib/permissions.ts](../../lib/permissions.ts)

## Role hierarchy

```
user (0) < curator (1) < {guide, insider} (2) < admin (3)
```

`guide` and `insider` share rank 2 — siblings with equivalent publishing capability, different byline framing. See [[Roles and Ranks]] for the full design.

## API surface

### Role / flag checks

- `hasRole(user, atLeast)` — returns true if `user.role` is at least the given tier. Sibling tier check works (guide ↔ insider).
- `canModerate(user)` — `isMod || role === 'admin'`.
- `canAssignRoles(user)` / `canBanUser(user)` — admin-only.

### Comment gates

- `canComment` / `canReact` / `canSaveComment` — login-gated, no role requirement.
- `canEditComment` — author-only, even admins can't edit other users' words.
- `canDeleteOwnComment` — author-only.
- `canModerateComment` — wraps `canModerate`, fails on already-tombstoned comments.

### Content-creation gates (per content type)

- `canCreateList` / `canCreatePoll` / `canCreateMarketplaceCard` — curator+. Polls and marketplace surfaces don't exist yet; the gate exists so they slot in cleanly later.
- `canCreateOpinion` / `canCreateMix` — guide+ (insider qualifies via the sibling-tier check).
- `canCreateContent(user, type)` — single per-type gate consumed by the dashboard's [[NuevoSection]] template grid + the `?type=…` compose URL guard. `listicle` → curator+; `mix` / `opinion` / `editorial` / `review` / `articulo` / `noticia` / `evento` → guide+; `partner` → admin only. Polls and marketplace slot in here when those types are added.
- `canEditContent` / `canDeleteContent` — admin OR the content's author (matched by username today; switch to `authorId` post-Supabase).

### Rank derivation

- `RANK_THRESHOLD` — currently 5 received reactions before leaving NORMIE.
- `rankFromCounts(signal, provocative)` — pure derivation, easy to unit-test:
  - total < THRESHOLD → `normie`
  - signal/total ≥ 0.65 → `detonador`
  - signal/total ≤ 0.35 → `enigma`
  - between → `espectro`
- `getUserRank(userId, allComments)` — counts !/? on comments authored by `userId`, returns the rank. Pure — caller supplies the comment list. The live React-side hook is `useUserRank(userId)` in [[comments]], which feeds in `getAllCommentsMerged()`.

## Mutual-exclusivity helper

`isMutuallyExclusiveReaction(prev, next)` — guard for tests; the actual enforcement lives in `toggleReaction` in [[comments]] (replaces a user's prior reaction when they pick the other kind).

## Backend migration

When real auth + a real database land:

- `User.role` / `isMod` / `isOG` come from Supabase. Helper signatures don't change.
- `getUserRank` could be precomputed server-side and cached on the user row, or kept as a derived view. Either way the helper signature stays — consumers don't notice.

## Links

- [[Roles and Ranks]] — the design decision
- [[mockUsers]] — the 8-user roster the helpers run against
- [[comments]] — `useUserRank` hook + reaction store
- [[CommentList]] · [[PostHeader]] — primary consumers of the badge helpers
- [[useAuth]] — the User/null source
