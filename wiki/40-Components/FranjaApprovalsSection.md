# FranjaApprovalsSection

> `components/dashboard/explorer/sections/FranjaApprovalsSection.tsx` — admin-only surface for toggling per-franja marketplace access.

## What it does

Lists all franjas and lets an admin toggle `marketplace_enabled` on each one. When a franja is enabled:
- They appear on `/marketplace` and the home [[MarketplaceRail]]
- Their team members (users with a matching `franja_id`) gain access to the franja-only dashboard section ([[MiFranjaSection]]) to edit their marketplace card + listings

The list is searchable by franja title or slug. Each row shows the current state (MARKETPLACE ON / OFF chip), listing count if enabled, and a single toggle button that fires `PATCH /api/admin/franjas/[id]` then refetches.

## Data pattern

Fetches `GET /api/admin/franjas` on mount. Reloads after every toggle so rows reflect DB state. Same DB-backed pattern as [[AdminUsersEditor]] and [[MiFranjaSection]].

## Access

Admin-only. Lives inside [[Dashboard Explorer]] at `?section=approvals` (or equivalent routing).

## Related

- [[MiFranjaSection]] — franja team dashboard surface unlocked by this toggle
- [[MarketplaceOverlay]] — what the franja's enabled marketplace looks like
- [[Marketplace]] — the decision note
