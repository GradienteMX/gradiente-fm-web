---
type: roadmap
status: current
tags: [mobile, responsive, overlays, comments, mosaic, accessibility]
updated: 2026-06-28
---

# Mobile Readiness

> The mobile-first pass that took the desktop-built app to usable on phones. Shipped on branch `mobile/ux-pass`, merged to `main` 2026-06-28. Triggered by prod reports: users couldn't log in or enter their invite code on mobile.

## What

The app was built desktop-first; a dismissible "la versión móvil casi está lista" notice ([MobileNotice.tsx](../../components/MobileNotice.tsx)) had been steering phone users to desktop. This pass made the core flows actually work on phones, then retired the notice from the entry path. Scoped via two verified multi-agent audits (a whole-app sweep + a per-overlay-type sweep): the desktop chrome appeared too early, layouts didn't stack, comments were unreachable, and several layers overflowed horizontally.

## Why

Phone users literally could not complete the two most important tasks — entering an invite code and signing up / logging in — and couldn't reach comments at all. Mobile is where most beta invites get opened.

## How — what shipped (5 commits)

### 1. Entry & auth (`a02cb39`)
- **Código form tap-swallow (the reported blocker):** at phone heights the `/welcome` `fixed` cockpit clamped to the viewport and its `flex-1` body overflowed *under* the decorative `<footer>` (`pointer-events:auto`), so the footer ate every tap on the invite-code input. Fix: footer `pointer-events-none`, dropped `min-h-0` from the body + gated the space-fillers to `md:` so the cockpit scrolls; vinyl hidden on phones so the CTAs sit near the top. ([app/welcome/page.tsx](../../app/welcome/page.tsx))
- **iOS zoom-on-focus:** all auth inputs were <16px. One global rule floors form controls to 16px on phones ([app/globals.css](../../app/globals.css)); desktop keeps its smaller register.
- **3D signup form:** [[InviteExperience]]'s `.x-registro-overlay` was centered with no scroll → keyboard/landscape stranded the fields + CREAR IDENTIDAD. Now scrolls within its overlay; a `webglcontextlost` handler drops to the inline `RegistroCard` fallback.
- **Login discoverability:** [[AuthBadge]] is desktop-only, so INICIAR SESIÓN / REGISTRARSE (+ DASHBOARD/SALIR when authed) were added to [[Navigation]]'s mobile menu. NOTE: middleware forces anon → `/welcome`, so anon login is via the `/welcome` CTA; the mobile-menu login mainly serves authed users.
- BetaTermsModal `85vh→85dvh` + focus without scroll-jump; `body` → `100dvh`; [[MobileNotice]] suppressed on `/welcome`.

### 2. Responsive home mosaic (`bbe899e`)
The HP curation engine ([[curation]]) emits a FIXED 3-column layout (colSpan/colStart up to 3) but [[ContentGrid]] is width-fluid — at 1–2 columns a `colStart:3`/`colSpan:3` card overflowed into a squished implicit column (the "tiny cards on the right"). [[ContentGrid]] now measures its real column count (ResizeObserver) and clamps each cell to it; `repeat(cols, minmax(0,1fr))` instead of auto-fit; **floored at 2 columns** so phones keep a real mosaic (size hierarchy / HL signal intact) rather than collapsing to a single column. The mount-time column flip is non-animated (Framer `layout` gated until after first paint) so it snaps instead of leaving stuck transforms.

### 3. Partners swipe-in drawer (`9c247fa`)
The partners/marketplace right column showed from `md` (768px), squeezing the feed in the 768–1024 band. Moved to `lg:flex` (full-width feed below lg) and added [PartnersDrawer.tsx](../../components/PartnersDrawer.tsx) (`lg:hidden`): a right-edge always-visible PARTNERS tab + left-edge-swipe to open; right-swipe / backdrop / X / ESC to close. [[PartnersRail]] gained a `variant="drawer"`. Marketplace stays reachable via its nav link. Gives phones partner access for the first time.

### 4. Content overlays (`5a762d6`)
Per-type analysis of all overlay variants. Two fixes:
- **Horizontal drift when reading:** [[OverlayShell]]'s scroll container was `overflow-y-auto` (CSS promotes overflow-x→auto), so any child wider than the panel let a diagonal drag drift sideways into empty space. The universal driver was [[VibeFader]] (~470px fixed/nowrap row, embedded in every overlay). Fixed the shell with `overflow-x-hidden` + `overscroll-contain`, and made [[VibeFader]] fluid below sm (flex-wrap, fluid track, shrinkable wrapping labels, wider thumb touch). Per-type wide content that was being clipped now fits: [[MixOverlay]] article `grid-cols-1` base + tracklist `minmax(0,…)`, AudioPlayer3D header stacks (`flex-col sm:flex-row`) with a smaller cover + particle field, [[ArticuloOverlay]] hero H1 breaks long words, the shared TrackBlock H3 `overflow-wrap:anywhere`, Articulo/Listicle VIBE blocks full-width below sm.
- **Comments unreachable on mobile:** the right-edge rail tab AND the comments column were both `hidden sm:flex`; only [[ReaderOverlay]] had an in-body entry. [[OverlayShell]] now renders a mobile COMENTARIOS button (bottom bar, live count, every type) + a full-screen `sm:hidden` comments **sheet** (`100dvh` + safe-area) that reuses the [[CommentsColumn]] body + shell state. Panel/column maxHeight `92vh→92dvh`.

### 5. Prominent OCULTAR (`87698ef`)
The mobile comments sheet is full-screen with no backdrop, so OCULTAR is the only way out — but it was dim `text-muted` 10px text. Now a bordered sys-orange button with an X icon on mobile; subtle inline link on desktop.

## Patterns established (reuse these)
- **Breakpoint convention:** `sm` (640) for in-content stacking; heavy desktop chrome (the partners column, and the nav once folded) belongs at `lg` (1024), not `md` — `md` is too early and overflows tablets.
- **`dvh` over `vh`** for any full-height surface (body, overlay panels, sheets) so content isn't hidden behind mobile browser bars.
- **`env(safe-area-inset-*)`** padding on bottom-anchored chrome.
- **Fluid, not fixed:** any inline widget embedded in an overlay (e.g. [[VibeFader]]) must `flex-wrap` + `min-w-0` below sm so it can't force the panel wide; restore the nowrap desktop look behind `sm:`.
- **16px input floor on mobile** ([app/globals.css](../../app/globals.css) media rule) — kills iOS zoom-on-focus site-wide.
- **Verify auth-gated pages via `/lab`:** middleware lets dev `/lab/*` through unauthenticated (`isDevLab` in [lib/supabase/middleware.ts](../../lib/supabase/middleware.ts)), so a throwaway `app/lab/<x>/page.tsx` harness can render gated UI (home grid, overlays) for preview at phone widths. Delete before commit.

## Deferred polish (NOT done — pick up here)
Surfaced by the audits, intentionally out of scope for the unblock pass. None are blockers; all are nice-to-have, recorded so they aren't lost:
- **Touch targets <44px (~34 sites):** genre / tag / entity chips, foro `>>id` quote links + CITAR + backlinks, footnote refs, [[ArticuloOverlay]] TOC §-buttons, AudioPlayer3D transport buttons, dashboard tile controls + REORGANIZAR, FeedHeader clear-filter, [[VibeFader]] thumbs (partially done — bumped to `w-8`). Approach: enlarge the *invisible* hit area (padding / `min-h-[44px]`) without changing the visible NGE grip; keep the compact look behind `sm:`.
- **Sub-11px legibility (~16 sites):** tracking-widest mono labels at 8–10px across feed / overlay / marketplace chrome. Establish an ~11px floor on mobile (candidate: floor the shared `.sys-label` utility behind a media query); keep desktop density at `sm:`.
- **Keyboard-aware composers:** the comments sheet composer (and foro reply / listing comment) sit at the bottom; on iOS the soft keyboard overlays them. Add `visualViewport`-aware `scrollIntoView({block:'end'})` on textarea focus.
- **[[PartnerOverlay]] mobile pass:** it's a STANDALONE full-screen dossier (NOT wrapped in [[OverlayShell]]), so it never got the shell's mobile treatment. Give it the same overflow-x clamp / stacking / `dvh` / safe-area pass. The `/p/[slug]` [[Partner Page]] route likewise wasn't audited for mobile.
- **Nav overflow in the 768–1050px band:** the desktop nav (`NAV_LINKS` + FEEDBACK + [[AuthBadge]]) renders at `md` but doesn't fit until ~1050px → it overflows. Fold the nav into the hamburger until `lg` (mirrors the partners-column `md→lg` move). Iker deferred this when choosing "build drawer only."
- **Secondary surfaces** ([[EventosRail]] 180px drag-rail, agenda archive grid, foro catalog, dashboard composer/explorer, admin tabs) got the global 16px-input + `dvh` benefits but no dedicated mobile-layout pass beyond that.

## Links
- [[Navigation]] · [[OverlayShell]] · [[CommentsColumn]] · [[VibeFader]] · [[ContentGrid]] · [[PartnersRail]] · [[InviteExperience]] · [[MixOverlay]] · [[ArticuloOverlay]] · [[ReaderOverlay]]
- [[Next Session]] · [[log]]
