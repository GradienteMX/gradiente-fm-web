---
type: component
status: current
tags: [auth, navigation, header]
updated: 2026-04-25
---

# AuthBadge

> Header slot that swaps between LOGIN button and DASHBOARD link + SALIR based on auth state. Slots into [[Navigation]] next to the MAGI cluster. Treated as a primary action region — louder than the surrounding header chrome on purpose.

## Source

[components/auth/AuthBadge.tsx](../../components/auth/AuthBadge.tsx) · slotted in [Navigation.tsx](../../components/Navigation.tsx)

## States

**Unauthed** (default):
- `[● LOGIN ⏎]` — blinking orange dot + 13px Syne Black `LOGIN` in `#FF8C00` with EVA glow + dim `⏎` hint
- Click opens [[LoginOverlay]]
- Hover: `#1A0900` background tint

**Authed**:
- `[● DASHBOARD / @username] [⌫ SALIR]`
  - Pulsing green dot + 13px Syne Black `DASHBOARD` in `#4ADE80` with green EVA glow
  - Username inline below the label at 9px `#888` (readable, not buried)
  - Logout button to the right: `LogOut` icon + 10px `SALIR` label in `#999`, hover→`sys-red`
- Dashboard chip links to `/dashboard`

## Why it stands out

The rest of the header (UNIT chrome, MAGI panel labels, nav captions) sits at 6–8px in near-black colors like `#2A1800`, `#3A2A00`, `#1A1000` — deliberately dim, terminal-esque background ambiance. The auth badge breaks that convention because **login/logout/dashboard are primary actions, not chrome**. Same EVA palette, but bumped:

| | Before | After |
|---|---|---|
| Main label size | 8px | 13px |
| Label weight | font-mono bold | font-syne black |
| Label color | `#FF6600` | `#FF8C00` (login) / `#4ADE80` (dashboard) with text-shadow glow |
| Sub-captions | `UNIT·ACCESS`, `ID·NULL`, `@user` at `#1A1000` (~invisible) | dropped — only the username remains, at `#888` |
| Logout | lone `⏻` glyph at `#555` | `LogOut` icon + `SALIR` label, hover sys-red |

See [[../../../C--Users-Iker-Documents-Gradiente/memory/feedback_no_decorative_chrome|memory: no decorative chrome]] — same principle that guided the dashboard trim.

## Visibility

Hidden on mobile (`hidden md:flex`) — the existing `≡` toggle and the mobile menu don't yet know about auth state. See [[Open Questions]] for the mobile auth follow-up.

## State source

Reads from [[useAuth]] — `isAuthed`, `username`, plus the `openLogin` and `logout` actions.

## Links

- [[useAuth]] · [[LoginOverlay]] · [[Navigation]] · [[Dashboard]] · [[Dashboard Explorer]]
