---
type: component
status: current
tags: [auth, hook, context, prototype, roles, overrides]
updated: 2026-04-30
---

# useAuth

> Visual-prototype auth context. Stores only the user id in sessionStorage; the exposed `currentUser` is resolved live through [[userOverrides]] so admin self-edits in [[PermisosSection]] (role / isMod / isOG) propagate to every consumer without a page reload.

## Source

[components/auth/useAuth.tsx](../../components/auth/useAuth.tsx)

## API

```ts
useAuth(): {
  currentUser: User | null   // resolved through override layer
  username: string | null    // back-compat — equals currentUser.username
  isAuthed: boolean
  login: (username, password) => boolean    // username/password rule below
  loginAs: (userId) => boolean              // no-password switcher (used by LoginOverlay quick-switch)
  logout: () => void
  loginOpen: boolean
  openLogin: () => void
  closeLogin: () => void
}
```

`<AuthProvider>` wraps the app inside [[layout]] (between `AuthProvider` and `PromptProvider`, above `PublishConfirmProvider` so `PublishConfirmProvider` sees the auth context). SessionStorage key: `gradiente:auth` storing `{ userId: string }`.

## Credential rules (prototype only)

- Legacy shortcut: `admin / admin` resolves to the canonical admin user (`u-datavismo`).
- Per-user: any `@username` with `password === username` (case-insensitive). Lets every mock user in [[mockUsers]] be exercised without remembering credentials.
- The `LoginOverlay` quick-switch list bypasses passwords by calling `loginAs(userId)` directly.

## Override resolution

Source of truth in state is just `userId: string | null`. The exposed `currentUser` flows through `useResolvedUser(userId)` from [[userOverrides]], which:

- Computes `getResolvedUserById(userId)` synchronously each render (so a `userId` change doesn't lag a frame and flicker the LoginOverlay open).
- Subscribes to the override-store listener; any `setUserOverride` / `clearUserOverride` call triggers a re-render with the new resolved value.

Net effect: an admin editing their own `isMod` / `isOG` (or any user editing a self-targeted override) sees their auth-derived chrome — the sidebar `Permisos` row, `canModerate` gates, the `AuthBadge` — update immediately.

## Hydration safety

Returns `currentUser: null` on the server and during the very first client render to avoid hydration mismatches on auth-dependent UI. The stored `userId` is read in a `useEffect` and the component re-renders with the resolved user.

## Migration path

When [[Supabase Migration]] lands:

1. Replace `resolveCredentials` body with a real Supabase auth call.
2. Replace sessionStorage with Supabase's session.
3. Add password reset / magic link flows.
4. Replace [[userOverrides]] with direct Supabase `users` updates (RLS-gated to admins). `useResolvedUser` becomes a Supabase select on the user row.

Every consumer of `useAuth()` reads `currentUser` / `isAuthed` and won't change.

## Links

- [[LoginOverlay]] · [[AuthBadge]] · [[Dashboard]]
- [[mockUsers]] — credential resolution still hits the seed (overrides can't change identity fields)
- [[userOverrides]] — the live-resolution layer
- [[PermisosSection]] · [[Roles and Ranks]]
- [[Admin Dashboard]] · [[Supabase Migration]]
