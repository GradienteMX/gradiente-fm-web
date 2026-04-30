---
type: component
status: current
tags: [dashboard, admin, identity, roles]
updated: 2026-04-29
---

# PermisosSection

> Admin-only role-assignment surface inside the dashboard. Two-pane layout — searchable user list on the left, editor on the right. Edits land in [[userOverrides]] and propagate live to every badge consumer.

## Source

[components/dashboard/explorer/sections/PermisosSection.tsx](../../components/dashboard/explorer/sections/PermisosSection.tsx)

## Where it lives

- **Sidebar:** [[ExplorerSidebar]] adds a `Permisos` row (Lock icon) only when `canAssignRoles(currentUser)` returns true. Non-admins never see it.
- **URL guard:** the dashboard page validates `?section=permisos` against the same gate. A non-admin URL-typing the path falls back to `home` (`section === 'permisos' && !isAdmin → 'home'`).
- **Empty pane:** `hideDetails` is set on the section so the right details panel doesn't render — Permisos owns its full center column.

## Left pane — user list

`useResolvedUsers()` from [[userOverrides]] supplies the live roster. Each row shows:

- Primary chip: role label for staff, derived rank for `user`-tier (via `useUserRank` from [[comments]]).
- Sibling flags: MOD / OG chips when set.
- `@username` text.
- `EDITADO` orange chip on the right when `useHasOverride(id)` is true — surfaces which users have a session override active.

A live search input narrows by `username` or `displayName` (case-insensitive substring).

## Right pane — editor

Mounts when a user is selected. Three editable axes:

1. **Role grid** — five buttons (`LECTOR / CURADOR / GUÍA / INSIDER / ADMIN`) with the role color when active. Click writes `{ role }` via `setUserOverride`. Self-demote guard: when editing yourself, every non-`admin` button is disabled with the title `"No puedes degradarte a ti mismo"`. Prevents the obvious foot-gun where an admin locks themselves out of this surface.
2. **Bandera MOD** — switch-style button toggling `isMod`. Description copy explains the orthogonality to role.
3. **Bandera OG** — switch-style button toggling `isOG`. Description marks it as cosmetic-only.

Header carries a `RESTAURAR` button (RotateCcw icon) when `useHasOverride(id)` is true — clears the override entirely via `clearUserOverride`.

The editor also surfaces a self-edit banner when the selected user is the current viewer, explaining the demote block.

## Identity block

Read-only `display / username / id / joined` rows pinned above the role grid. Reminds the admin which user they're editing and signals which fields are *not* mutable.

## Why writes don't show a "save" button

Every change is committed-on-click. There's no draft/save dance — for the prototype this is faster, and undoing a misclick is one click on the next role/flag/RESTAURAR. A real backend with a confirmation flow could batch the patch behind a single PATCH request; the helper signatures in [[userOverrides]] don't change.

## Backend migration

The component itself doesn't touch storage directly — it calls `setUserOverride` / `clearUserOverride` from [[userOverrides]]. When that module swaps to Supabase RPCs, this component continues working unchanged.

## Links

- [[userOverrides]] — the storage layer
- [[Roles and Ranks]] — the role/flag/rank design this surface edits
- [[permissions]] — `canAssignRoles` (the gate) and the rest of the helper set
- [[ExplorerSidebar]] · [[ExplorerShell]] — the dashboard chrome the section lives in
- [[CommentList]] · [[PostHeader]] · [[SavedCommentsSection]] — downstream consumers that pick up the override via `useResolvedUser`
