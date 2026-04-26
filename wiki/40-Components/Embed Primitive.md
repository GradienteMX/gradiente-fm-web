---
type: component
status: current
tags: [embed, audio, platforms, shared]
updated: 2026-04-24
---

# Embed Primitive

> Shared platform-detection utilities for audio/video embeds. Consumed by [[MixOverlay]] (source tabs) and the `track` block in [[ListicleOverlay]] (per-track link-outs).

## What

Module: [components/embed/platforms.ts](../../components/embed/platforms.ts).

Exports:

- `PLATFORM_LABELS: Record<EmbedPlatform, string>` — uppercase tab/button labels (`SOUNDCLOUD`, `YOUTUBE`, `SPOTIFY`, `BANDCAMP`, `MIXCLOUD`).
- `PLATFORM_ORDER: EmbedPlatform[]` — canonical display order for tabs.
- `detectPlatform(url: string): EmbedPlatform | null` — hostname regex match.

Types (in [lib/types.ts](../../lib/types.ts)):

- `EmbedPlatform = 'soundcloud' | 'youtube' | 'spotify' | 'bandcamp' | 'mixcloud'`
- `MixEmbed = { platform, url }`

## Why

Keep platform awareness in one place so the mix overlay, the listicle `track` block, and any future type that wants embeds (articulos with inline tracks, editorials with referenced mixes) share:

- The same finite list of supported platforms
- The same labels and display order
- The same URL → platform detection logic
- The same data shape (`MixEmbed`) on `ContentItem`

## How

**Current scope (v1):** Just detection + labels. No iframe construction. Why: the mix overlay and listicle track blocks are visual prototypes — tabs render as switches that control which URL `ABRIR FUENTE` / the link-out button opens. No platform iframes are mounted yet.

**When the audio-context session lands,** this module will grow:

- `buildEmbedSrc(platform, url): string | null` — platform-specific iframe URL construction
- Possibly `extractEmbedId(platform, url)` — track IDs, video IDs
- An `<EmbedPlayer>` component rendering the actual iframe
- Click-to-embed facade pattern for per-track embeds in listicles

Until then, the module stays small and the consumers treat embeds as link-outs.

## Consumers

- [[MixOverlay]] — source tabs in the `01 AUDIO EMBED // REPRODUCTOR` panel, plus the `[ABRIR FUENTE]` link target
- [[ListicleOverlay]] via [[ArticuloOverlay]]'s `BodyBlocks` — the `track` block renders one `<a target="_blank">` per platform in `embed.embeds`

## Links

- [[MixOverlay]]
- [[ListicleOverlay]]
- [[Content Types]]
- [[Open Questions]] — audio-context session scope
