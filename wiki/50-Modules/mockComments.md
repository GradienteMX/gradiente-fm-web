---
type: module
status: current
tags: [mock, comments, reactions, seed]
updated: 2026-04-29
---

# mockComments

> 25 seed comments threaded across four real ContentItem ids. Designed to exercise every visible behavior of the comment system in one snapshot.

## Source

[lib/mockComments.ts](../../lib/mockComments.ts)

## What's covered

- Flat top-level comments + nested replies (depth ≥ 5 to trigger the linearize-past-MAX_VISUAL_DEPTH path in [[CommentList]]).
- Controversy hot-spot — `cm-006` mixes `!` and `?` reactions. Both register as productive engagement; neither suppresses the other. See [[No Algorithm]] / "controversy as discussion".
- Moderator tombstone with preserved replies — `cm-009` was deleted by `u-mod-rumor` for spam; `cm-010` (a reply to it) is preserved.
- Edited markers — `cm-011`, `cm-015` carry an `editedAt`.
- Plural reaction profiles per author — drives the [[Roles and Ranks]] derivation. `loma_grave` and `merimekko` both end up ESPECTRO from received !/?; thinner authors stay NORMIE.

## Reaction palette

Only `signal` (`!`) and `provocative` (`?`). The old `resonates` (`+`) and `disagree` (`−`) were dropped — see [[Roles and Ranks]] for the rationale and [[comments]] for the mutual-exclusivity rule.

Each (userId, commentId) pair has at most one reaction. The seed honors that — no user appears twice on the same comment with different kinds.

## Helpers

- `getCommentsForItem(itemId)` / `getCommentById(id)` — direct lookups.
- `engagementScore(comment)` — total reaction count irrespective of kind.
- `directReplyCount` / `descendantCount` — used by [[CommentList]] sorting.

## Backend migration

Swap the static array for a Supabase `comments` query. Consumers use `getCommentsForItem` / `getCommentById` and won't change.

## Links

- [[comments]] — the session store layered on top
- [[mockUsers]] — author ids referenced here
- [[Roles and Ranks]] — the !/? palette design
- [[CommentList]] — primary renderer
