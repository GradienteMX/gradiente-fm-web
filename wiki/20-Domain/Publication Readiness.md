---
type: domain
status: current
tags: [publishing, composer, validation, tags, franjas, affinity]
updated: 2026-09-10
---

# Publication Readiness

> One checklist, two levels. **Hard** rules are what a row cannot exist without; **soft** rules are editorial recommendations that never block. Lives in [lib/contentReadiness.ts](../../lib/contentReadiness.ts) and is the single source for the composer's review step AND `POST /api/items`.

## Why two levels

The 2026-09-10 drafting redesign shipped a server-side gate that applied every composer rule (audio link, track entry, meaningful body, end-after-start) to every publish, including edits of pieces published under older rules. Authors could not re-publish their own work and the composer offered no way out. Splitting the list keeps the editorial guidance without locking older content — see [[Guides Not Gatekeepers]].

## Hard (blocks the button, 422 on the API, applies to create AND edit)

| Field | Rule |
|---|---|
| Título | non-blank |
| Enlace de la publicación | slug non-blank |
| Ambiente | `vibeMin`/`vibeMax` finite, 0–10, min ≤ max |
| Al menos un género | `genres` non-empty — drives the dial's filter |
| Al menos una etiqueta | at least one **classifier** tag (see below) — feeds affinity |
| Fecha de inicio | `evento` only; must parse |

## Soft (listed under «Recomendado» with a jump link; never enforced)

- Body text / a meaningful article block / a `track` entry (listicle)
- Audio link for a `mix` unless status is `proximamente`, `archivo` or `exclusivo`
- Event end after start
- «Vincula artistas, sellos o franjas» — at least one entity or franja subject link

`completeness()` counts the hard set only.

## Tags

`ContentItem.tags` had a taxonomy (`TAGS` in `lib/genres.ts`) but no composer field. [TagMultiSelectL](../../components/dashboard/compose/kit/TagMultiSelectL.tsx) now sits under «Ambiente, géneros y etiquetas» in all eight composers. Catalogue = shipped `TAGS` ∪ the user-created registry the foro already grows (`/api/foro/tags`, table `foro_tags`), so threads and content share one vocabulary. Create-in-place works like the foro.

`isClassifierTag(id)` decides what counts: shipped non-legacy ids or well-formed custom slugs; **not** provenance markers (`ra`, `noticia`, `curaduria`, `scraper`, `instagram`, `seed`) nor bare years. Affinity's `curatedTags` uses the same predicate, so custom tags now carry signal.

## Franja subject links (migration 0051)

`items.franja_id` is **authorship** («Publicar con mi franja»). A piece being *about* a franja is a different relation: `item_franjas(item_id, franja_id)`, mirrored on `ContentItem.franjaRefs`. Picker: [FranjaMultiSelectL](../../components/dashboard/compose/kit/FranjaMultiSelectL.tsx) in every CONTEXTO section (searches `GET /api/franjas?q=`, published franja rows only; no create). Rendered as a FRANJAS row of chips → `/f/[slug]` in `OverlayEntities` and `ReaderOverlay`. Affinity adds `franjaRefEach: 4 / franjaRefCap: 8`.

Resolution is a separate two-query fetch (`lib/franjaRefs.ts`) on server and browser alike, so a pending migration degrades to "no chips" instead of breaking the items select.

0051 also re-points `item_entities_author_write` at `private.auth_can_link_item()`: staff, the item's author, or the item's franja team. Before, only guide/admin could write links, so a curator's artist/label links were silently dropped at publish.

## Publish path (no save dependency)

`ComposeLayout.reviewPublish` no longer requires the account draft save to succeed. It awaits only a save already on the wire (`workbench.settle()`), then opens confirmation; the confirmation posts the composer payload directly. A failed autosave is shown inline («No se pudo guardar en tu cuenta») and never blocks publishing. The 422 message now names the missing fields.

## Related

- [[Vibe Spectrum]] · [[HP Curation System]] · [[Franja Authoring]] · [[Dashboard Drafts]]
