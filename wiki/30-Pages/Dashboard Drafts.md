---
type: page
status: current
tags: [dashboard, drafts, list, management]
updated: 2026-04-25
---

# Dashboard Drafts

> `/dashboard/drafts` — auth-gated table view of every session item the editor has touched. Manages drafts and published-in-session items: filter, edit, publish, delete.

## Source

- Page: [app/dashboard/drafts/page.tsx](../../app/dashboard/drafts/page.tsx)
- List component: [components/dashboard/DraftsList.tsx](../../components/dashboard/DraftsList.tsx)

## Why this exists

Drafts no longer surface in the public home feed (per the [[Publish Confirmation Flow]] tightening — drafts are private work-in-progress). Without this page they'd be stranded — saved but invisible. The drafts list is the only management surface for sessionStorage-backed items.

When [[Supabase Migration]] lands, this page swaps to a real query against the editor's saved/published rows but the UX stays the same.

## Layout

**Header strip**
- `UNIT·AUTHED · @<username>` chip (green pulse)
- Breadcrumb: `//DASHBOARD / DRAFTS·LIST`
- Right-side links: `← COMPONER NUEVO` and `← VOLVER AL FEED`

**Headline**
- H1 `DRAFTS & PUBLICACIONES`
- Live counts: `N ENTRADAS · N DRAFTS · N PUBLICADAS · SESIÓN LOCAL`

**Filter row 1 — Type**
- `//TODOS · N` plus one chip per type that has at least one item, with per-type count
- Active chip uses the type's `categoryColor`
- Click toggles type filter

**Filter row 2 — State**
- `TODOS / DRAFTS / PUBLICADAS`
- Composes with type filter

**Table**
- Header (desktop only): `TIPO / ESTADO / TÍTULO / ACTUALIZADO / ACCIONES`
- Each row:
  - Type chip in category color
  - State chip — orange pulsing `DRAFT` or green static `PUBLICADO`
  - Title (font-syne) + slug (font-mono, smaller)
  - Updated ago (`hace Xm` / `hace Xh` / `hace Xd`)
  - Actions: `[✎ EDITAR]`, `[▶ PUBLICAR]` (drafts only — uses the [[Publish Confirmation Flow]]), trash icon
- Sorted by `_updatedAt` newest first

**Empty states**
- "BANDEJA VACÍA" with link to compose new (when zero items)
- "SIN COINCIDENCIAS" (when filters return zero)

## Actions

| Action | What happens |
|---|---|
| EDITAR | Routes to `/dashboard?type=<type>&edit=<id>`. Form pre-populates via `useDraftWorkbench`'s edit hydration. Same flow as editing from an overlay's session strip. |
| PUBLICAR (drafts only) | Calls `setCategoryFilter(null)` + `router.push('/?pending=<id>')`. Triggers the full pending-confirmation flow. |
| ELIMINAR (trash) | Calls `removeItem(id)` directly. Single-click — see Open Questions for confirm-dialog discussion. |

## Discoverability

Linked from the dashboard status strip (`DRAFTS · N` next to the type-switching links). User noted this link is a bit subtle — slated for the dashboard chrome redesign.

Live count via `useDraftItems()` updates the link's badge as items are added/removed across the session.

## Out of scope

- No bulk operations (select + publish / delete multiple)
- No search within the list (just filters)
- No sorting other than newest-updated
- No inline edit (always routes to the form)
- No delete confirmation dialog (prototype tradeoff)

## Links

- [[Dashboard]] · [[Dashboard Forms]] · [[Publish Confirmation Flow]]
- [[drafts]] · [[useAuth]]
