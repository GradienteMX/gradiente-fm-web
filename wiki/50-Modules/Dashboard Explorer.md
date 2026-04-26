---
type: module
status: current
tags: [dashboard, explorer, sidebar, drafts, guardados]
updated: 2026-04-25
---

# Dashboard Explorer

> The dashboard chrome — a retro file-explorer shell that wraps every dashboard surface (compose, drafts, publicados, perfil, guardados). Replaces the old flat `/dashboard` + `/dashboard/drafts` split with a single section-routed view inside an explorer window.

## Why a file-explorer metaphor

The dashboard is the editor's working surface. A file-explorer maps to the mental model better than a flat page: drafts are *files*, content types are *templates*, and the user navigates a tree of their own work. The metaphor also fits the `SUBSISTEMA·UNIT-XX` chrome the public site already uses.

Trimmed hard against decoration — see [[../../../.claude/projects/C--Users-Iker-Documents-Gradiente/memory/feedback_no_decorative_chrome|feedback: no decorative chrome]]. Every visible affordance either works today or has a named future purpose.

## Layout

```
┌─ breadcrumb (UNIT·AUTHED · @user > Dashboard > X) ─────────────────────┐
│                                                                        │
│  ┌─ EXPLORADOR ──────┐  ┌─ <section title> ──────────────────────────┐ │
│  │ Dashboard         │  │  toolbar [Nuevo Eliminar Renombrar Subir] │ │
│  │ Nuevo contenido   │  │  count · view-controls                    │ │
│  │ Drafts        04  │  │                                           │ │
│  │ Publicados    02  │  │  <section body>                           │ │
│  │ Perfil            │  │                                           │ │
│  │                   │  │                                           │ │
│  │ ▾ Guardados       │  │                                           │ │
│  │     Feed          │  │                                           │ │
│  │     Agenda        │  │                                           │ │
│  │     ...           │  │                                           │ │
│  └───────────────────┘  └───────────────────────────────────────────┘ │
│  ┌─ ESTADO DE LA UNIDAD ┐  ┌─ DETALLES ───────────────────────────┐  │
│  │ DRAFTS    04         │  │  <selection metadata + CTA>          │  │
│  │ PUBLICADOS 02        │  │                                      │  │
│  │ GUARDADOS 00         │  └──────────────────────────────────────┘  │
│  │ ÚLT. EDIT 3m         │                                           │
│  │ CUOTA 06/50          │                                           │
│  └──────────────────────┘                                           │
└─────────────────────────────────────────────────────────────────────┘
```

Three columns on desktop: sidebar (240px) + window (flex) + details panel (280px). Below the sidebar sits the **ESTADO DE LA UNIDAD** stats panel. The details panel is hidden for sections that don't have a per-item selection (Home, Perfil, Guardados placeholders).

## Viewport fill

The shell root has `min-h-[calc(100vh-200px)]` and the inner row uses `flex-1`, so the explorer always claims the full viewport (minus nav + footer + main padding). The center window uses `flex-1` inside its column, so short sections like Profile grow to fill the available height instead of leaving a gap above the footer. (Without this, `body { min-height: 100vh }` from globals.css pushes the footer down past short content, producing visible empty space.) [[VibeSlider]] is hidden on `/dashboard` so it doesn't take up the slot above the explorer.

## Section routing

Single page at [`app/dashboard/page.tsx`](../../app/dashboard/page.tsx) dispatches sections via the `?section=` search param. URL is the source of truth — back/forward and deep-links work.

| URL | Section | Body |
|---|---|---|
| `/dashboard` | `home` | [HomeSection](../../components/dashboard/explorer/sections/HomeSection.tsx) — landing tiles |
| `?section=nuevo` | `nuevo` | [NuevoSection](../../components/dashboard/explorer/sections/NuevoSection.tsx) — 8 templates as files |
| `?section=nuevo&type=mix` | compose mode | the existing [[Dashboard\|Form for type]] inside the same window |
| `?section=drafts` | `drafts` | [DraftsSection](../../components/dashboard/explorer/sections/DraftsSection.tsx) → [DraggableFileGrid](../../components/dashboard/explorer/sections/DraggableFileGrid.tsx) |
| `?section=publicados` | `publicados` | same grid, filtered by `_draftState === 'published'`, separate position namespace |
| `?section=profile` | `profile` | [ProfileSection](../../components/dashboard/explorer/sections/ProfileSection.tsx) — identity card + editable fields |
| `?section=guardados-{feed,agenda,noticias,reviews,mixes,editoriales,articulos}` | `guardados-*` | [GuardadosSection](../../components/dashboard/explorer/sections/GuardadosSection.tsx) — placeholder until save flow exists |

Old `/dashboard/drafts` route is now a client redirect to `/dashboard?section=drafts`.

## Shell components

Under `components/dashboard/explorer/`:

- [ExplorerShell](../../components/dashboard/explorer/ExplorerShell.tsx) — three-column layout, takes children for the section body
- [ExplorerSidebar](../../components/dashboard/explorer/ExplorerSidebar.tsx) — flat top-level items + Guardados folder
- [ExplorerWindow](../../components/dashboard/explorer/ExplorerWindow.tsx) — title bar + toolbar slot + count/view-controls strip + body
- [ExplorerToolbar](../../components/dashboard/explorer/ExplorerToolbar.tsx) — `[Nuevo, Eliminar, Renombrar, Subir, Más]` (Cortar/Copiar/Pegar dropped — clipboard semantics don't map to editorial content)
- [ExplorerBreadcrumb](../../components/dashboard/explorer/ExplorerBreadcrumb.tsx) — top trail with the `UNIT·AUTHED` green badge as first crumb
- [ExplorerDetails](../../components/dashboard/explorer/ExplorerDetails.tsx) — right-side selection panel with file-icon preview + property table + CTA
- [ExplorerStorage](../../components/dashboard/explorer/ExplorerStorage.tsx) — ESTADO DE LA UNIDAD: real counts (drafts/publicados/guardados/last-edit) + soft 50-item cuota
- [FileIcon](../../components/dashboard/explorer/FileIcon.tsx) — folded-corner SVG file icon, color + content-type glyph
- [ViewControls](../../components/dashboard/explorer/ViewControls.tsx) — sort dropdown + grid/list toggle (visual only for now)

## Draggable file grid

[DraggableFileGrid](../../components/dashboard/explorer/sections/DraggableFileGrid.tsx) renders drafts as freely-positioned tiles on a dotted-grid canvas. Free-form positions, not snap-to-grid — fits the user-as-curator framing.

- **Persistence:** positions are stored per-namespace in `sessionStorage` under `gradiente:dashboard:positions:<namespace>`. Drafts and Publicados use separate namespaces so reorganizing one doesn't disturb the other.
- **Default placement:** items without a stored position get auto-placed left-to-right in `clientWidth`-derived columns; `ResizeObserver` recomputes columns as the window resizes.
- **Pointer events:** `pointerdown` selects + starts drag, `pointermove` updates a state-mirrored ref (avoids closure staleness for `pointerup`), `pointerup` commits to storage. `setPointerCapture` is wrapped in try/catch — fall back to bubble-based listeners.
- **Reorganizar:** button at the top-right of the canvas resets the namespace's positions to default.
- **Open:** double-click or `Enter` opens the draft in compose mode (`?section=nuevo&type=<type>&edit=<id>`).

## Guardados — reserved for the future save flow

Guardados is the dashboard's user-as-member surface, **not** a mirror of the public site's content categories. The sidebar reserves seven slots (Feed/Agenda/Noticias/Reviews/Mixes/Editoriales/Artículos) but the entries are disabled stubs. Direct URL navigation lands on a placeholder explaining the future save flow → event-attendance markers → verifiable club perks roadmap (see [[../../../.claude/projects/C--Users-Iker-Documents-Gradiente/memory/project_guardados_perks_vision|memory: Guardados → club perks roadmap]]).

The save gesture itself doesn't exist on the public side yet — when it lands, this folder is the destination.

## What was deliberately cut

In an earlier iteration the explorer mirrored a Windows-style file manager more literally — Cut/Copy/Paste toolbar buttons, a fake `48.7 GB / 120 GB` storage gauge, a Media folder (Imágenes/Audio/Vídeos/Documentos), an Archivo folder with Eliminados, and orphan content-type entries in the sidebar. All cut. The patterns matched a familiar UI but didn't earn their place in this domain — every cut surface either had no real meaning for editorial content or duplicated something else (the bottom INFORMACIÓN bar showed the same data as the right-side DETALLES panel, for instance). Bias: fewer surfaces wired to real behavior over richer-looking but mostly inert chrome.

## Links

- [[Dashboard]] — route-level overview, auth, forms, live preview
- [[Dashboard Drafts]] — drafts data model (now reachable as `?section=drafts`)
- [[drafts]] — sessionStorage-backed store
- [[useAuth]] — auth gate
- [[Admin Dashboard]] — what this prototype anticipates when Supabase lands
- [[Supabase Migration]] — backend swap that turns Guardados into real saves
