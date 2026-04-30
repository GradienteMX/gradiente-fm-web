---
type: module
status: current
tags: [admin, identity, sessionstorage, overrides]
updated: 2026-04-29
---

# userOverrides

> Frontend-only patch layer over MOCK_USERS. Lets the admin role-assignment surface ([[PermisosSection]]) edit any user's role / isMod / isOG and have the change reflect across every badge consumer in real time, without touching the static seed.

## Source

[lib/userOverrides.ts](../../lib/userOverrides.ts)

## Storage shape

`gradiente:user-overrides` sessionStorage:

```ts
type OverrideMap = Record<string, UserOverride>

interface UserOverride {
  role?: Role
  isMod?: boolean
  isOG?: boolean
}
```

Identity fields (`id`, `username`, `displayName`, `joinedAt`) are intentionally absent — the admin can change *what someone is* but not *who they are*.

The store is **noop-collapsing**: if a patch leaves a user matching their seed values exactly, the entry is dropped from the map rather than persisted as `{}`. Keeps storage tidy and the `EDITADO` chip in [[PermisosSection]] honest.

## Listener pattern

In-module `Set<() => void>` of refresh callbacks. Every `setUserOverride` / `clearUserOverride` / `clearAllOverrides` calls `notify()`. Hooks (`useResolvedUser` / `useResolvedUsers` / `useHasOverride`) subscribe on mount, unsubscribe on unmount — same idiom as [[comments]] and [[saves]].

## Read API

- `getUserOverride(id)` — raw override (no seed merge). Used by the admin list to show the EDITADO chip.
- `getResolvedUserById(id)` — `User | undefined`, with override applied. Server-safe (returns seed when window absent).
- `listResolvedUsers()` — full roster with overrides applied. Drives the [[PermisosSection]] left pane.

## Write API

- `setUserOverride(id, patch)` — patch-merges over any prior override. Pass `{ role: 'guide' }` to set just the role; pass `{ isMod: false }` to explicitly clear a flag (vs. leaving it alone with `undefined`).
- `clearUserOverride(id)` — drops one user back to seed.
- `clearAllOverrides()` — wipes the whole map. Useful for a "reset session" action (not currently exposed).

## Hooks

- `useResolvedUser(id)` — live `User | undefined`. Re-renders on any override change. Replaces `getUserById` in every badge-rendering component ([[CommentList]], [[PostHeader]], [[SavedCommentsSection]]) so admin edits propagate without a page reload.
- `useResolvedUsers()` — full roster, live. [[PermisosSection]] reads this for the left list.
- `useHasOverride(id)` — boolean, live. [[PermisosSection]] uses it to render the per-row `EDITADO` chip.

## Backend migration

When real auth + database land:

- Replace `setUserOverride` / `clearUserOverride` with Supabase update RPCs against the `users` row (admin-gated by RLS policy).
- Drop the listener registry in favor of Supabase Realtime subscriptions on the `users` table.
- `useResolvedUser` keeps its signature; consumers don't change.

## Known limitations

- Overrides are session-scoped, not user-keyed — switching admins in the same tab carries the previous admin's pending edits over. Acceptable for the prototype; a real backend persists per-user.
- The auth context (`useAuth.currentUser`) returns the **seed** user, not the override-resolved one. If admin changes their own non-blocked field (isMod / isOG, or role *up* to admin) the auth-bound chrome (AuthBadge, dashboard breadcrumb) won't reflect it until reload. Acceptable — rare edge and the rest of the app DOES update live.
- Self-demote is blocked at the UI layer ([[PermisosSection]] disables non-admin role buttons when editing yourself) but **not at the storage layer** — a deliberate caller could still write an admin → user override directly. Real backend would enforce this in RLS.

## Links

- [[Roles and Ranks]] — the design this implements
- [[mockUsers]] — the seed roster overrides patch over
- [[permissions]] — `canAssignRoles` is the gate consumers check
- [[PermisosSection]] — the only writer
- [[CommentList]] · [[PostHeader]] · [[SavedCommentsSection]] — readers via `useResolvedUser`
