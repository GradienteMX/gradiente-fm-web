---
type: component
status: current
tags: [dashboard, marketplace, franja, team]
updated: 2026-05-05
---

# MiFranjaSection

> Franja-team-only dashboard surface. Mounts when `currentUser.franjaId` is set; the [[ExplorerSidebar]] row is named after the franja's title rather than a generic label so the entry reads as "this is your team."

## Source

[components/dashboard/explorer/sections/MiFranjaSection.tsx](../../components/dashboard/explorer/sections/MiFranjaSection.tsx)

## Two tabs

**Marketplace (default)**

- Card meta editor — description / location / currency text inputs. Disabled for non-managers.
- Listings grid — compact summary rows; click `EDITAR` on any to expand the inline editor (title / category / condition / price / status / image / description).
- `+ AGREGAR LISTING` button creates a draft listing and auto-opens its inline editor.

**Equipo**

- Current team members list. Each row shows username, `ADMIN` chip when `franjaAdmin`, `TÚ` chip when own row.
- For franjaAdmins (or site admins): per-row promote/demote button (`↑ ADMIN` / `↓ ADMIN`) and `KICK` button.
- Below the list: `AGREGAR · MIEMBRO` search picker — type to find users not yet on the team; click adds them with `franjaId` set.
- For non-managers: read-only notice explaining the gate.

## Gating

- Outer mount — dashboard page renders the section only when `currentUser.franjaId` is set; non-team users URL-typing `?section=mi-franja` fall back to home.
- Tab-level — `canManageFranja(currentUser, franjaId)` gates the marketplace edit affordances; `canManageFranjaTeam(...)` gates team add/kick/promote.
- Marketplace-disabled banner — shown when `marketplaceEnabled === false`. Edits are still allowed (so the team can prep content), but the public surface won't show the franja until an admin approves.

## Live propagation

Marketplace card edits → PATCH `/api/franjas/[id]`. Listings → POST/PATCH/DELETE `/api/franjas/[id]/listings/[lid]`. Team membership → POST/PATCH/DELETE `/api/franjas/[id]/team`. After each mutation the section refetches franja + team via the GET endpoints and re-renders. No sessionStorage layer — the [[MarketplaceOverlay]] sees changes on the next server-component render of `/marketplace`.

## Links

- [[Marketplace]] — design decision
- [[permissions]] — `canManageFranja` / `canManageFranjaTeam`
- [[FranjaApprovalsSection]] — site-admin counterpart that toggles `marketplaceEnabled`
- [[MarketplaceOverlay]] — where the team's edits land for the public
