---
type: component
status: current
tags: [auth, hook, context, prototype]
updated: 2026-04-25
---

# useAuth

> Visual-prototype auth context — sessionStorage-backed `admin/admin` login. The single seam to swap when real auth lands.

## Source

[components/auth/useAuth.tsx](../../components/auth/useAuth.tsx)

## API

```ts
useAuth(): {
  role: 'admin' | 'insider' | null
  username: string | null
  isAuthed: boolean
  login: (u: string, p: string) => boolean   // synchronous; returns ok
  logout: () => void
  loginOpen: boolean                          // overlay visibility
  openLogin: () => void
  closeLogin: () => void
}
```

`<AuthProvider>` wraps the app inside [[layout]]. SessionStorage key: `gradiente:auth`.

## Hardcoded credentials (prototype only)

```ts
const VALID_USERNAME = 'admin'
const VALID_PASSWORD = 'admin'
```

## Hydration safety

Returns `role: null, isAuthed: false` on the server and during initial client render to avoid hydration mismatches on auth-dependent UI (like [[AuthBadge]] swap). Reads sessionStorage in a `useEffect` and re-renders.

## Migration path

When [[Supabase Migration]] lands:
1. Replace `login()` body with a real Supabase auth call
2. Replace sessionStorage with Supabase's session
3. Add password reset / magic link flows
4. Add `'editor'` role + per-type permission checks

Every consumer of `useAuth()` (the [[AuthBadge]], the [[LoginOverlay]], the [[Dashboard]] guard) is provider-agnostic — no consumer changes.

## Links

- [[LoginOverlay]] · [[AuthBadge]] · [[Dashboard]]
- [[Admin Dashboard]] · [[Supabase Migration]]
