# PartnerApprovalsSection

> `components/dashboard/explorer/sections/PartnerApprovalsSection.tsx` — admin-only surface for toggling per-partner marketplace access.

## What it does

Lists all partners and lets an admin toggle `marketplace_enabled` on each one. When a partner is enabled:
- They appear on `/marketplace` and the home [[MarketplaceRail]]
- Their team members (users with a matching `partner_id`) gain access to the partner-only dashboard section ([[MiPartnerSection]]) to edit their marketplace card + listings

The list is searchable by partner title or slug. Each row shows the current state (MARKETPLACE ON / OFF chip), listing count if enabled, and a single toggle button that fires `PATCH /api/admin/partners/[id]` then refetches.

## Data pattern

Fetches `GET /api/admin/partners` on mount. Reloads after every toggle so rows reflect DB state. Same DB-backed pattern as [[AdminUsersEditor]] and [[MiPartnerSection]].

## Access

Admin-only. Lives inside [[Dashboard Explorer]] at `?section=approvals` (or equivalent routing).

## Related

- [[MiPartnerSection]] — partner team dashboard surface unlocked by this toggle
- [[MarketplaceOverlay]] — what the partner's enabled marketplace looks like
- [[Marketplace]] — the decision note
