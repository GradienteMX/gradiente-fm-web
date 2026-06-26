---
type: component
status: current
tags: [dashboard, forms, type-specific]
updated: 2026-05-07
---

# Dashboard Forms

> Eight per-type compose forms used by [[Dashboard]] (`/dashboard?type=…`). Each builds a `ContentItem` of its specific type, autosaves to sessionStorage, and feeds [[LivePreview]] in real time.

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
  - `TextArea` accepts optional `maxLength` — hard-caps input + shows live `len/max` counter (turns orange at ≥90%). Used on EXCERPT across all long-form forms (cap 280) so writers can't fill the body in the lead field.
- `VibeField` — custom pointer-driven two-thumb range over a colored gradient track + 11-bar fuel gauge picker. Single-point auto-switch (mirrors [[VibeFader]]) so leftward drags from a collapsed range work. Keyboard: Arrow ±1, Home/End for 0/10. Reads slot names from `VIBE_SLOT_NAMES` in [utils.ts](../../lib/utils.ts).
- `GenreMultiSelect` — searchable chip multi-select against `lib/genres`
- `StringListField` — flat list editor with `PEGAR LISTA` bulk paste; per-row paste also splits multi-line
- `EmbedList` — multi-source URL editor; live platform detection from URL; smart multi-URL paste
- `LinkListField` — outbound labeled-link editor (`EntityLink { label, url }[]`) with per-form preset chips (Bandcamp/Discogs/Spotify/Sitio/Fuente/RSVP/Referencia). Powers the **ENLACES** CONTEXTO field — "where to buy / listen / read more". Distinct from `EmbedList` (playable sources) and `EntityMultiSelect` (browsable scene rows). See the CONTEXTO section below.
- `ImageUrlField` — URL input + inline thumbnail preview
- `SubmitFooter` — sticky bottom bar with `⚠ FALTA: …` chip when `errors[]` is non-empty + RESETEAR + ▣ GUARDAR DRAFT + ▶ PUBLICAR (both disabled while errors present)

## Publish-gate validators (per-type)

Each form computes its own `errors[]` of missing-field labels, joined into the footer's `⚠ FALTA: …` chip:

| Form | Required for publish |
|---|---|
| **ArticuloForm** · **ListicleForm** | TÍTULO · SLUG · CUERPO (≥1 block in `articleBody`) |
| **EditorialForm** · **ReviewForm** · **OpinionForm** | TÍTULO · SLUG · CUERPO (`bodyPreview.trim() !== ''`) |
| **NoticiaForm** · **EventoForm** · **MixForm** | TÍTULO · SLUG (no body required — these legitimately ship without one) |

The CUERPO gate landed 2026-05-07 because writers were filling only EXCERPT and missing the rich block editor entirely. Articulo + Listicle also got a punched-up empty-state CTA (orange dashed border, `⚠ AÑADE EL CUERPO DEL ARTÍCULO AQUÍ`) inside `ArticleBlocksEditor` when `blocks.length === 0`, since the gate alone doesn't *teach* where the body lives.

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

## CONTEXTO — outbound links + scene entities (2026-06-26)

Every form now exposes a context-appropriate **CONTEXTO** block. Two mechanisms, deliberately kept separate:

- **Scene entities** (`EntityMultiSelect` → `entities[]` → `item_entities` join) — browsable, filterable rows (`/e/[slug]`): `artist` / `label` / `venue` / `promoter`.
- **Outbound links** (`LinkListField` → `links[]` → `items.links` jsonb, migration `0041`) — plain labeled URLs. Reuses the `EntityLink` shape.

| Form | CONTEXTO contents | ENLACES placement / presets |
|---|---|---|
| **review** | subject switch + artist/label (+ venue/promoter if happening) + format + embeds | existing CONTEXTO · Bandcamp·Discogs·Spotify·Sitio·Fuente |
| **listicle** | artist + label | existing CONTEXTO · Bandcamp·Spotify·Sitio·Fuente |
| **mix** | metadata (serie/grabado/formato/…) + **artist/label/venue** | existing CONTEXTO · Bandcamp·Discogs·Sitio |
| **evento** | venue/promoter (UBICACIÓN) + artist (LINE-UP) | MEDIA + BOLETOS · Sitio·RSVP·Fuente |
| **noticia** | **artist + label** | new CONTEXTO · Fuente·Sitio |
| **editorial** | **artist + label** | new CONTEXTO · Fuente·Sitio·Referencia |
| **opinion** | **artist + label** | new CONTEXTO · Fuente·Sitio |
| **articulo** | (links only) | new CONTEXTO · Fuente·Sitio·Referencia |

**Display side.** [[ReaderOverlay]] (review/editorial/opinion/noticia) renders entities via its `EntityRow` and links via an inline `LinkRow`. The other four overlays — [[MixOverlay]], [[ListicleOverlay]], [[EventoOverlay]], [[ArticuloOverlay]] — use two shared, self-contained blocks: `components/overlay/OverlayEntities.tsx` (subject entities → `EntityChipButton` chips) and `components/overlay/OverlayLinks.tsx` (external anchors). This closed a pre-existing gap where those overlays showed no entities at all (ListicleForm had collected artist/label that never displayed).

**Persistence.** Drafts carry `links` for free in the `item_payload` jsonb; published items use `items.links` (0041). `contentItemToRow` writes it whenever defined (emptying clears the column); `rowToContentItem` reads it.

**Deferred:** a `collective` `entity_kind` for crews/colectivos — needs a migration (enum value) + `KIND_LABEL`/placeholder. Distinct from the `colectivo` `partner_kind`.

## Out of scope

- **Articulo form** — needs the full `ArticleBlock` editor for all 10 block kinds. Listicle covers the subset.
- **Inline track embeds** — track blocks expose source as link-out buttons. Real iframe embedding deferred to the audio-context session.
- **Draft injection into the home feed** — drafts live in sessionStorage but aren't merged into the grid. See [[Open Questions]].

## Links

- [[Dashboard]] · [[LivePreview]] · [[useAuth]]
- [[Embed Primitive]] · [[Content Types]]
- [[Admin Dashboard]] — what this anticipates with a real backend
