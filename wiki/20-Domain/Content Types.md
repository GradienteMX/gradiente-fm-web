---
type: domain
status: current
tags: [content, types, schema]
updated: 2026-04-24
---

# Content Types

> Nine types, one shape. `ContentItem` is a discriminated union by `type`.

## The nine types

| Type | Purpose | Key fields |
|---|---|---|
| **evento** | Live event in CDMX scene | `date`, `endDate`, `venue`, `venueCity`, `artists`, `ticketUrl`, `price` |
| **mix** | DJ mix / radio show | `embeds`, `duration`, `tracklist`, `author`, `mixSeries`, `recordedIn`, `mixFormat`, `bpmRange`, `musicalKey`, `mixStatus` |
| **noticia** | Short news item | `bodyPreview` (optional) |
| **review** | Record or event review | `author`, `readTime`, `bodyPreview` |
| **editorial** | Long-form editorial | `author`, `readTime`, `bodyPreview` |
| **opinion** | Opinion column | `author`, `readTime`, `bodyPreview` |
| **articulo** | Deep-dive longform feature | `author`, `readTime`, `articleBody`, `footnotes`, `heroCaption` |
| **listicle** | Ranked/structured list feature (e.g. "Top N tracks") | `author`, `articleBody` with `track` blocks, `heroCaption` |
| **partner** | Sponsor / label / venue in rail | `partnerKind`, `partnerUrl`, `partnerLastUpdated` |

See [lib/types.ts](../../lib/types.ts) for the canonical `ContentItem` interface.

## Why a single interface

Rather than one type per kind, `ContentItem` is one interface with all fields optional-by-type. Tradeoff:

- **Pro:** one list, one render pipeline, one filter set. Mixing types in the main mosaic is trivial.
- **Con:** you can set `mixUrl` on an `evento` and TypeScript won't complain. Discipline-based, not compiler-enforced.

The pragmatic win beats the structural purity here — the site's whole point is that all types live side by side in the feed.

## Required fields (every item)

```ts
id: string
slug: string
type: ContentType
title: string
vibe: VibeScore          // see [[Vibe Spectrum]]
genres: string[]         // genre ids, see [[genres]]
tags: string[]           // tag ids
publishedAt: string      // ISO
```

Everything else is optional and type-gated by convention.

## Type-specific conventions

### evento

- `date` is **required** in practice (no dateless event would make sense in the UI).
- `endDate` defaults to `date` if unset — treat single-day if omitted.
- `venueCity` is typically `'CDMX · Street Address, Neighborhood'` for local events.
- `artists` is an ordered list (headliner first, generally).
- [[ContentCard]] renders a date-block with month / day / day-name / time in the top-right.
- Event decay is modulated by imminence — see [[HP Curation System]].

### mix

As of 2026-04-24, mix has a rich metadata profile driven by [[MixOverlay]] and the [[Embed Primitive]]:

- `embeds: MixEmbed[]` — multi-platform sources (`soundcloud`, `youtube`, `spotify`, `bandcamp`, `mixcloud`). Drives the overlay source tabs.
- `mixUrl` — legacy/card-level primary link. Use `embeds[0]?.url` in new code; `mixUrl` still exists for backward-compat on existing entries.
- `duration` — `"H:MM:SS"` or `"MM:SS"`. Rendered as "1 h 04 min" in the left meta rail and as raw timestamp in the player.
- `tracklist: MixTrack[]` — structured rows `{ artist, title, bpm? }`. Now rendered as a numbered table in the `03 TRACKLIST / ETIQUETAS` panel.
- `mixSeries` — "Espectro Mix", "Guest Mix", etc.
- `recordedIn` — "CDMX", "Club Japan", etc.
- `mixFormat` — "DJ Set", "Live Session", "Radio Show".
- `bpmRange` — "132-140".
- `musicalKey` — "D#m".
- `mixStatus` — `'disponible' | 'exclusivo' | 'archivo' | 'proximamente'`.

Audio playback is currently a visual prototype only: transport controls are present but non-functional, ABRIR FUENTE / `O` hotkey opens the active source in a new tab. Real playback is deferred to the audio-context session — see [[Open Questions]].

[[MixCard]] (linear list) still uses a decorative fake waveform. [[ContentCard]] (mosaic) is unchanged.

### noticia / review / editorial / opinion

Loosely article-shaped. `author`, `readTime`, `bodyPreview` optional. `editorial: true` boosts spawn HP. `pinned: true` eligible for [[Pinned Hero]].

`noticia` has the fastest decay (2 days) and the lowest score multiplier (0.8) — news should cycle fast. See [[HP Curation System]].

### articulo

The longform dispatch tier — substack-style deep-dives (features, interviews, reported essays). Distinct from `editorial` (curatorial/positional) in that `articulo` is *reportage + form*: section headers, pull-quotes, footnotes, Q&A interview blocks.

Unique fields vs. the other reader types:

- `articleBody?: ArticleBlock[]` — structured body, a discriminated union of blocks (`lede`, `p`, `h2`, `h3`, `quote`, `blockquote`, `image`, `divider`, `qa`, `list`). Falls back to `bodyPreview.split('\n\n')` when absent.
- `footnotes?: Footnote[]` — numbered list rendered at the end of the article. Inline `[^id]` refs in block text render as superscript `[n]` anchors that scroll to `#fn-<id>`.
- `heroCaption?: string` — caption for the lead image (unlike [[ReaderOverlay]], `articulo` leads with the hero image rather than demoting it).

`articulo` is **not** in the [[Pinned Hero]] allowlist — it competes in the main feed but doesn't auto-promote to the portada slot. See [[ArticuloOverlay]] for the reader surface.

### listicle

Ranked/structured list features — "Top N tracks that defined X", countdowns, editorial recounts. Architecturally a sibling of `articulo`: same `ArticleBlock[]` body, same prose primitives, but the body almost always includes one or more `track` blocks (new `kind: 'track'` variant on [[ArticleBlock]]).

Unique fields vs. `articulo`:

- Uses the same `articleBody?: ArticleBlock[]` + `heroCaption?` fields as `articulo`.
- The new `track` block: `{ kind: 'track', rank?, artist, title, year?, bpm?, imageUrl?, embeds?: MixEmbed[], commentary? }`. Embeds reuse the Mix `MixEmbed` shape — shared infrastructure across mix + listicle (and any articulo that wants to include track references).

Rendered by [[ListicleOverlay]]: hero + lede, then rank-badged track cards interleaved with prose. Left rail shows a countdown/ascending/unranked list index; right rail carries the author and ETIQUETAS. Currently each track exposes its sources as **link-out buttons** (open in new tab) — inline iframe embedding is deferred to the audio-context session for the same reason as mix playback. See [[Open Questions]].

Listicle is **not** in the [[Pinned Hero]] allowlist.

### partner

**Quarantined** — partners never enter the main mosaic. See [[Partners Isolation]].

Unique fields:
- `partnerKind`: `'promo' | 'label' | 'promoter' | 'venue' | 'sponsored'`
- `partnerUrl`: outbound link to site, Instagram, Bandcamp, etc.
- `partnerLastUpdated`: ISO, overrides `publishedAt` for rail ordering.

## Editorial flags (cross-type)

- `editorial: boolean` — spawn HP 50 instead of 20. See [[Editorial Flag]].
- `pinned: boolean` — eligible for the single hero slot. See [[Pinned Hero]].
- `bodyPreview: string` — longer teaser text shown in [[HeroCard]] (multi-paragraph via `\n\n`).

## Links

- [[types]]
- [[mockData]]
- [[Vibe Spectrum]]
- [[HP Curation System]]
- [[Partners Isolation]]
- [[Editorial Flag]]
- [[Pinned Hero]]
