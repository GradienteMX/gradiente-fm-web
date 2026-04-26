---
type: component
status: current
tags: [auth, overlay, modal]
updated: 2026-04-25
---

# LoginOverlay

> Terminal-aesthetic modal for authentication. Triggered from [[AuthBadge]] in the header. Mounted globally in [[layout]].

## Source

[components/auth/LoginOverlay.tsx](../../components/auth/LoginOverlay.tsx)

## What

Single-purpose modal with two inputs (`USERNAME`, `PASSWORD`) and an `▶ ENTRAR AL SUBSISTEMA` submit. On success: brief green `ACCESO CONCEDIDO · REDIRIGIENDO…` chip, then auto-closes after ~700ms. On failure: red `CREDENCIALES INVÁLIDAS · ACCESO DENEGADO` chip.

Visibility is controlled by [[useAuth]] — `openLogin()` / `closeLogin()` / `loginOpen`. Other components don't render it; they just open it.

## Chrome

Reuses [[OverlayShell]]'s panel idiom (`eva-box eva-scanlines`, header chip with `//AUTH` and `[ESC] CERRAR`) for visual coherence with the rest of the overlay system. Same enter animation (`overlay-panel-in`).

ESC closes. Click backdrop closes. First field auto-focuses on open. State resets between opens (so failed attempts don't leak between sessions).

## Body scroll lock

Locks `document.body.style.overflow` while open — same pattern as [[OverlayShell]]. Restored on close.

## Hint strip

A `[PROTOTIPO VISUAL] prueba con admin / admin` line at the bottom — explicit because this is a visual prototype. Removed when real auth lands.

## Links

- [[useAuth]] · [[AuthBadge]] · [[Dashboard]]
- [[OverlayShell]] — borrowed chrome
