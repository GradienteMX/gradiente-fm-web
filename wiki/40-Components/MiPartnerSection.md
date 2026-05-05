---
type: component
status: current
tags: [dashboard, marketplace, partner, team]
updated: 2026-05-05
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

Marketplace card edits → PATCH `/api/partners/[id]`. Listings → POST/PATCH/DELETE `/api/partners/[id]/listings/[lid]`. Team membership → POST/PATCH/DELETE `/api/partners/[id]/team`. After each mutation the section refetches partner + team via the GET endpoints and re-renders. No sessionStorage layer — the [[MarketplaceOverlay]] sees changes on the next server-component render of `/marketplace`.

## Links

- [[Marketplace]] — design decision
- [[permissions]] — `canManagePartner` / `canManagePartnerTeam`
- [[PartnerApprovalsSection]] — site-admin counterpart that toggles `marketplaceEnabled`
- [[MarketplaceOverlay]] — where the team's edits land for the public
