---
type: decision
status: current
tags: [decision, overlay, editorial, design]
updated: 2026-04-23
---

# Decision — Reader Terminal Layout

> When a card opens, the user is no longer browsing — they are reading. Long-form overlays must treat themselves as a dedicated reading subsystem, not an enlarged card. Flyer demotes to archival evidence; body text is the protagonist.

## The rule

Long-form overlays (`editorial` / `review` / `opinion` / `noticia`) render as a **two-column terminal reader**:

- **Left column (8/12): the article itself.** Badge → title → dek → metadata → body. Title and opening paragraph land above the fold with zero scrolling.
- **Right column (4/12): sticky archival rail** with numbered metadata blocks (`01 ARCHIVO VISUAL`, `02 CONTEXTO`, `03 ETIQUETAS`).
- **No full-width hero image.** The flyer lives in the archival rail as a framed artifact, never as a banner.
- **Sticky footer** with scroll progress + reading-mode indicator + `[F] VER FLYER` hotkey.

See [[ReaderOverlay]] for the implementation.

## Why

Project lead's brief (2026-04-23):

> "When expanded, the image is too big and we have to scroll down for text. How would you redesign this expanded card in order to make it follow more a terminal look where the protagonism comes with the actual contents of the expanded card and not the flyer?"

Once the user clicks, they've left the mosaic and entered a reading session. The first-viewport should be the **content**, not a poster. The flyer is still important — but as **evidence the article references**, not as a headline banner.

This reframes the overlay from "bigger card" to "dedicated subsystem reader." It matches the EVA-terminal language of the rest of the site — editors and users operating a live editorial console, not browsing a magazine.

## Concrete rules

1. **Title + dek + first paragraph above the fold** on desktop. No scroll needed to start reading.
2. **Flyer never appears full-width** in long-form overlays. Always rail-sized, always labeled as archival.
3. **Metadata as terminal modules**, not a generic byline. `[AUTOR]`, `[PUBLICADO]`, `[LECTURA]`, `[VIBE]` in the article, plus the numbered rail blocks.
4. **Body column width** constrained around 62–78ch. Calm reading, not dashboard-dense.
5. **Only one chrome bar** at the top ([[OverlayShell]]'s session strip). Footer is a status strip, not a second navigation.
6. **Flyer inspect mode** via the `F` key — opens a lightbox for full-res viewing, closes back into the article.

## Per-type philosophy

Every content type gets its own overlay rather than a single shell branching on type. The per-type decision lets each type's overlay have a distinct shape that matches what the content *is*:

| Type | Overlay | Stance on flyer |
|---|---|---|
| `editorial` / `review` / `opinion` / `noticia` | [[ReaderOverlay]] | Archival rail; never hero |
| `evento` | [[EventoOverlay]] | Flyer **is** the artifact — large, prominent |
| `mix` | (MixOverlay — not built) | Embedded player + tracklist primary; cover art supporting |
| fallback | [[GenericOverlay]] | Generic until replaced |

For an editorial **about** a venue, the venue flyer is referenced in the text — so it belongs in the rail as "material de archivo."

For an event listing, the flyer **is** the article — what it communicates visually (typography, era, design language) is the content. Demoting it would remove meaning.

That opposite stance between [[ReaderOverlay]] and [[EventoOverlay]] is intentional. It's why they're separate components.

## Alternatives rejected

| Option | Why rejected |
|---|---|
| One unified overlay with `switch(type)` branches | Loses expressive latitude. The correct stance on "how important is the flyer" differs fundamentally between types. |
| Full-width hero flyer at the top, article below | Wastes the most valuable screen real estate. User has to scroll to read. Original problem statement. |
| Big cinematic title with small body | Feels like a magazine cover. Editorial authority comes from the content reading calm and long, not from Title Slab Bigger. |
| Article in a narrow center column, flyer + metadata in both rails | Over-designed. One rail is enough; the second rail fights with reading comfort. |
| Putting chrome controls (close, share, etc.) everywhere | Creates a dashboard, not a reader. Close lives once, in the session bar. |

## Specific things NOT to do

- No hero image at the top of a `ReaderOverlay`.
- No fullscreen flyer as the first visible element (except in [[EventoOverlay]]).
- No forcing the user to scroll before reading the article's opening.
- No generic author-row byline styling — metadata should look like terminal readouts, not a blog header.

## Future enhancements (deferred)

- Text-size toggle (`T` key)
- Reading mode "minimap" showing scroll position + section headings
- Copy-link button with feedback
- `C` hotkey for copy link, `R` for reading mode variants
- Article `body` field (full markdown) rendered in-overlay. Currently we render `bodyPreview`. See [[Admin Dashboard]] and [[Supabase Migration]].

## Links

- [[Contained Single Surface]]
- [[Overlay System]]
- [[ReaderOverlay]]
- [[EventoOverlay]]
- [[GenericOverlay]]
- [[OverlayShell]]
- [[NGE Aesthetic]]
- [[Typography]]
- [[Admin Dashboard]]
