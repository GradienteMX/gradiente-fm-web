---
type: page
status: current
tags: [dashboard, auth, forms, editor, drafts, publish]
updated: 2026-04-25
---

# Dashboard

> `/dashboard` — auth-gated insider surface for composing new content. Eight type-specific forms with live preview through the real overlay components. Two-state publishing model with confirmation gate. Drafts management at `/dashboard/drafts`. Visual prototype only — every action writes to sessionStorage; no backend.

## Route

[`app/dashboard/page.tsx`](../../app/dashboard/page.tsx) — single client route. URL-driven type selection (`/dashboard?type=mix`) so back/forward navigation works.

## Auth

Visual-prototype-only credential gate. **`admin / admin`** is the test login. See [[useAuth]] and [[LoginOverlay]].

- [[AuthBadge]] in [[Navigation]] is the entry point — `LOGIN` button next to MAGI cluster.
- Successful auth → badge swaps to `DASHBOARD` link + `⏻` logout. SessionStorage-backed (`gradiente:auth`).
- `/dashboard` itself is auth-guarded client-side: unauthed users get prompted to log in via the overlay.
- When real auth lands (Supabase per [[Admin Dashboard]]), `useAuth.login()` is the only swap point — every consumer of `useAuth()` is provider-agnostic.

## Type picker

`components/dashboard/TypePicker.tsx` — 6 tiles, one per supported type. Each tile:
- Top accent stripe in `categoryColor(type)`
- Eyebrow `//{LABEL}` in the type's color
- Type name in display-weight Syne
- Short blurb describing what fits that type
- Hover affordance "▶ COMPONER →"

Supported as of 2026-04-25: `mix`, `listicle`, `articulo`, `evento`, `review`, `editorial`, `opinion`, `noticia`. **8 of 9 ContentTypes.**

Excluded:
- `partner` — rail-only, separate flow per [[Partners Isolation]].

## Forms

One file per type under `components/dashboard/forms/`. Per-type rather than unified per the editorial preference for expressive latitude.

| Type | File | What's distinctive |
|---|---|---|
| **mix** | [MixForm.tsx](../../components/dashboard/forms/MixForm.tsx) | Embeds list, structured tracklist with bulk-paste parser, contexto metadata (series/recordedIn/format/BPM/key/status) |
| **listicle** | [ListicleForm.tsx](../../components/dashboard/forms/ListicleForm.tsx) | `articleBody` block editor (4 kinds), collapsible track blocks with auto-rank, insert-between |
| **articulo** | [ArticuloForm.tsx](../../components/dashboard/forms/ArticuloForm.tsx) | Full block editor (all 10 kinds — lede/p/h2/h3/quote/blockquote/image/divider/qa/list) + footnotes editor |
| **evento** | [EventoForm.tsx](../../components/dashboard/forms/EventoForm.tsx) | Date/end-date pickers (datetime-local), venue, line-up via [[StringListField]], tickets, price |
| **review** | [ReviewForm.tsx](../../components/dashboard/forms/ReviewForm.tsx) | Reader-family — author, readTime, body |
| **editorial** | [EditorialForm.tsx](../../components/dashboard/forms/EditorialForm.tsx) | Reader-family — defaults `editorial: true` |
| **opinion** | [OpinionForm.tsx](../../components/dashboard/forms/OpinionForm.tsx) | Reader-family columnist variant |
| **noticia** | [NoticiaForm.tsx](../../components/dashboard/forms/NoticiaForm.tsx) | Leaner reader-family — no author/readTime, default tag `noticia` |

Shared primitives in [shared/Fields.tsx](../../components/dashboard/forms/shared/Fields.tsx): `Section`, `TextField`, `TextArea`, `Toggle`, `VibeField`, `GenreMultiSelect`, `StringListField`, `EmbedList`, `ImageUrlField` (with drag-drop + file picker), `SubmitFooter` (with `errors` chip + `SaveIndicator`), `useDraftWorkbench` (autosave + edit hydration + `saveDraft` / `requestPublish`), plus `slugify` and `publishDraft` helpers.

**Per-form behavior:**
- Hydrate via `useDraftWorkbench` — prefers `?edit=<id>` from URL (look up via [[drafts]]) over the per-form local-draft key.
- Autosave on every change with `lastSavedAt` timestamp surfaced in `SaveIndicator`.
- Slug auto-generated from title via `slugify`; user can override (manual edits stop the auto-sync for that field).
- `▣ GUARDAR DRAFT` → `commit('draft')` writes to [[drafts]] store. Brief orange `◉ DRAFT GUARDADO` chip.
- `▶ PUBLICAR` → `requestPublish()` saves as draft + navigates to `/?pending=<id>`. Triggers the [[Publish Confirmation Flow]]. State only flips to `'published'` after the editor confirms via [[PublishConfirmOverlay]].
- Required-field validation: red `*` markers + red borders + `⚠ FALTA: <fields>` chip in the footer when invalid.

## Live preview

[[LivePreview]] — right pane in the split view. Renders the current draft through its real overlay component (`MixOverlay`, `ListicleOverlay`, `EventoOverlay`, `ReaderOverlay`) inside a scaled-down panel that mimics [[OverlayShell]] without taking over the screen.

Means a single source of visual truth: the dashboard previews and the production overlays use the same renderer. Edit the form, the preview updates synchronously.

## Type-contextual paste handlers

Polish that recognizes how editors actually work for each kind of content:

- **Mix tracklist** has a `PEGAR LISTA` toggle revealing a textarea + parser that recognizes 4 line formats (`01. Artist - Title (134)`, `Artist — Title [134 BPM]`, `Artist - Title 134`, `Artist - Title`). Skips `#` comment lines. Live "N pistas detectadas" count. Enter in the last row's BPM cell adds + auto-focuses ARTIST.
- **EmbedList** (mix + listicle track blocks): URL input live-syncs the platform dropdown as you type/paste. Multi-URL paste splits into rows with per-platform detection.
- **StringListField** (evento line-up etc): `PEGAR LISTA` for bulk add. Per-row paste also splits multi-line.

See [[Embed Primitive]] for the platform-detection layer that powers the embed UX.

## Explorer shell (current)

The dashboard chrome is now a file-explorer wrapper — see [[Dashboard Explorer]]. Single page at [`app/dashboard/page.tsx`](../../app/dashboard/page.tsx) dispatches sections via `?section=`:

- `home` (default) — landing tiles
- `nuevo` — type templates as files; double-click opens the form
- `drafts` — draggable color-coded file workspace, positions persist in sessionStorage
- `publicados` — same grid filtered to `_draftState === 'published'`
- `profile` — identity card + editable bio/firma
- `guardados-*` — reserved slots for the future save-from-feed surface (disabled stubs for now)

`?section=nuevo&type=mix&edit=<id>` is compose mode — the type-specific form renders inside the same explorer window.

## Drafts (legacy route)

`/dashboard/drafts` is now a client redirect to `/dashboard?section=drafts`. The drafts data model itself is unchanged — see [[Dashboard Drafts]] and [[drafts]].

## Image upload (drag-drop + file picker)

`ImageUrlField` (in [shared/Fields.tsx](../../components/dashboard/forms/shared/Fields.tsx)) supports three input modes: paste a URL, click `[⎘ ELEGIR ARCHIVO]` for a file picker, or drag an image onto the field. Picker / drop reads the file as a data URL and stores it in `imageUrl`. The URL field shows a truncated display when storing a data URL. When [[Supabase Migration]] lands, picker/drop swap to upload-and-return-URL; the form contract doesn't change.

## Out of scope (for now)

- **Mobile layout for the auth badge** — hidden on small screens; the existing mobile menu doesn't know about auth state.
- **Inline track embeds in listicles** — still link-outs. Deferred to the audio-context session.
- **Dashboard chrome redesign** — user noted DRAFTS link is too subtle; deferred to a focused dashboard pass.
- **Drafts list delete confirmation** — currently single-click delete. Fine for prototype; production should add a confirm dialog or soft-delete with undo.

## Links

- [[useAuth]] · [[LoginOverlay]] · [[AuthBadge]]
- [[LivePreview]] · [[Dashboard Forms]] · [[Dashboard Drafts]]
- [[Publish Confirmation Flow]] · [[PublishConfirmOverlay]] · [[drafts]]
- [[Admin Dashboard]] — the real-backend version this prototype anticipates
- [[Content Types]] — the data contract every form populates
- [[Embed Primitive]] — shared platform detection
- [[Supabase Migration]] — what unlocks "real" submit + persistence
