---
type: component
status: current
tags: [dashboard, forms, type-specific]
updated: 2026-04-25
---

# Dashboard Forms

> Six per-type compose forms used by [[Dashboard]] (`/dashboard?type=…`). Each builds a `ContentItem` of its specific type, autosaves to sessionStorage, and feeds [[LivePreview]] in real time.

## Per-type files

| Form | File | Notable behavior |
|---|---|---|
| **MixForm** | [forms/MixForm.tsx](../../components/dashboard/forms/MixForm.tsx) | Embeds list (multi-source), tracklist with `PEGAR LISTA` parser, contexto metadata (series/recordedIn/format/BPM/key/status) |
| **ListicleForm** | [forms/ListicleForm.tsx](../../components/dashboard/forms/ListicleForm.tsx) | `articleBody` block editor — 4 block kinds (`lede`, `p`, `divider`, `track`), collapsible track blocks with auto-rank, insert-between rows |
| **EventoForm** | [forms/EventoForm.tsx](../../components/dashboard/forms/EventoForm.tsx) | datetime-local pickers, line-up via [[StringListField]], tickets, price |
| **ReviewForm** | [forms/ReviewForm.tsx](../../components/dashboard/forms/ReviewForm.tsx) | Reader-family — author, readTime, body |
| **EditorialForm** | [forms/EditorialForm.tsx](../../components/dashboard/forms/EditorialForm.tsx) | Reader-family — defaults `editorial: true` |
| **NoticiaForm** | [forms/NoticiaForm.tsx](../../components/dashboard/forms/NoticiaForm.tsx) | Leaner — no author/readTime, default tag `noticia` |

## Shared primitives

[forms/shared/Fields.tsx](../../components/dashboard/forms/shared/Fields.tsx) — every primitive every form uses:

- `Section({ label, title, children })` — numbered card with header + dashed underline + green pulse dot
- `TextField`, `TextArea`, `Toggle`
- `VibeField` — interactive slider + 11-bar fuel gauge in vibe colors
- `GenreMultiSelect` — searchable chip multi-select against `lib/genres`
- `StringListField` — flat list editor with `PEGAR LISTA` bulk paste; per-row paste also splits multi-line
- `EmbedList` — multi-source URL editor; live platform detection from URL; smart multi-URL paste
- `ImageUrlField` — URL input + inline thumbnail preview
- `SubmitFooter` — sticky bottom bar with success badge + RESETEAR + PUBLICAR DRAFT

Plus helpers: `slugify(title)` and `publishDraft(item)`.

## Per-form lifecycle

1. **Hydrate** on mount from sessionStorage (`gradiente:dashboard:{type}-draft`)
2. **Autosave** on every state change to the same key
3. **Slug auto-generation** from title via `slugify`; manual edits flip a flag and stop the auto-sync for that field
4. **Submit** via `publishDraft()` → console-logs the `ContentItem` and pushes to `gradiente:dashboard:published` (capped 20)
5. **Reset** clears the draft state + sessionStorage

## Listicle block editor — detail

`ListicleForm` is the only form with a complex sub-editor. See the dedicated section in [[Dashboard]] for the streamlining decisions:

- Collapsible track blocks (1-row summary when collapsed)
- Primary `AÑADIR TRACK` CTA + secondary `LEDE`/`PÁRRAFO`/`DIVISOR` chips
- Auto-rank on new tracks (detects countdown / ascending pattern)
- Insert-between hairline rows with mini picker
- Inline cover thumbnail in expanded track view
- Auto-focus on first editable field of newly-added blocks
- Up/down/delete + collapse toggle in each block header

## Type-contextual paste handlers

Three places use bulk paste, each tuned to its content shape:

- **MixForm tracklist** — recognizes 4 line formats (numbered, em-dash, parenthesized BPM, bracketed BPM, trailing BPM, plain "Artist - Title"). Skips `#` comments. Live "N pistas detectadas" counter.
- **EmbedList** — multi-URL paste splits across rows with per-platform detection.
- **StringListField** — generic line-per-entry paste.

## Out of scope

- **Articulo form** — needs the full `ArticleBlock` editor for all 10 block kinds. Listicle covers the subset.
- **Inline track embeds** — track blocks expose source as link-out buttons. Real iframe embedding deferred to the audio-context session.
- **Draft injection into the home feed** — drafts live in sessionStorage but aren't merged into the grid. See [[Open Questions]].

## Links

- [[Dashboard]] · [[LivePreview]] · [[useAuth]]
- [[Embed Primitive]] · [[Content Types]]
- [[Admin Dashboard]] — what this anticipates with a real backend
