---
type: component
status: current
tags: [dashboard, marketplace, partner, team]
updated: 2026-04-30
---

# MiPartnerSection

> Partner-team-only dashboard surface. Mounts when `currentUser.partnerId` is set; the [[ExplorerSidebar]] row is named after the partner's title rather than a generic label so the entry reads as "this is your team."

## Source

[components/dashboard/explorer/sections/MiPartnerSection.tsx](../../components/dashboard/explorer/sections/MiPartnerSection.tsx)

## Two tabs

**Marketplace (default)**

- Card meta editor — description / location / currency text inputs. Disabled for non-managers.
- Listings grid — compact summary rows; click `EDITAR` on any to expand the inline editor (title / category / condition / price / status / image / description).
- `+ AGREGAR LISTING` button creates a draft listing and auto-opens its inline editor.

**Equipo**

- Current team members list. Each row shows username, `ADMIN` chip when `partnerAdmin`, `TÚ` chip when own row.
- For partnerAdmins (or site admins): per-row promote/demote button (`↑ ADMIN` / `↓ ADMIN`) and `KICK` button.
- Below the list: `AGREGAR · MIEMBRO` search picker — type to find users not yet on the team; click adds them with `partnerId` set.
- For non-managers: read-only notice explaining the gate.

## Gating

- Outer mount — dashboard page renders the section only when `currentUser.partnerId` is set; non-team users URL-typing `?section=mi-partner` fall back to home.
- Tab-level — `canManagePartner(currentUser, partnerId)` gates the marketplace edit affordances; `canManagePartnerTeam(...)` gates team add/kick/promote.
- Marketplace-disabled banner — shown when `marketplaceEnabled === false`. Edits are still allowed (so the team can prep content), but the public surface won't show the partner until an admin approves.

## Live propagation

All writes flow through [[partnerOverrides]] (marketplace fields) or [[userOverrides]] (team membership). Both stores use synchronous-per-render hooks, so the UI updates without reload — the listing the partnerAdmin just kicked vanishes from the team list immediately, and the description the team just edited shows up in the [[MarketplaceOverlay]] without a refresh.

## Links

- [[Marketplace]] — design decision
- [[partnerOverrides]] · [[userOverrides]] — the writers
- [[permissions]] — `canManagePartner` / `canManagePartnerTeam`
- [[PartnerApprovalsSection]] — site-admin counterpart that toggles `marketplaceEnabled`
- [[MarketplaceOverlay]] — where the team's edits land for the public
