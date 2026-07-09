import type { ArticleBlock, ContentItem, EmbedPlatform, MixEmbed } from '@/lib/types'
import {
  PLAYABLE_PLATFORMS,
  detectPlatform,
  isPlayablePlatform,
  extractYouTubeId,
  extractSpotifyUri,
  extractMixcloudFeed,
} from '@/components/embed/platforms'

export interface PlayableSource {
  platform: EmbedPlatform
  url: string
}

// The minimal shape the global player needs to load + display a track. Every
// ContentItem satisfies it structurally, but so do synthesized refs — e.g. a
// listicle's `track` blocks or an inline prose link — which lets non-mix
// content feed the same player and queue without faking a full ContentItem.
// `slug` may be empty for synthetic refs (the HUD only opens an overlay when
// it's non-empty).
export interface PlayableRef {
  id: string
  slug: string
  title: string
  subtitle?: string
  author?: string
  imageUrl?: string
  mixSeries?: string
  duration?: string
  embeds?: MixEmbed[]
  mixUrl?: string
}

// A host-matched embed isn't automatically controllable: each platform's widget
// needs a native id/feed/uri that a bare hostname match doesn't guarantee
// exists (a YouTube channel/playlist link, a Mixcloud profile root, a non-track
// Spotify URL all match the host but yield no playable identifier). Gate
// "playable" on that identifier actually being extractable — otherwise the
// source falls through to the link-out instead of rendering a dead player.
export function canExtractSource(platform: EmbedPlatform, url: string): boolean {
  switch (platform) {
    case 'soundcloud':
      return true // SC's widget loads the canonical URL as-is — no extractor
    case 'youtube':
      return extractYouTubeId(url) !== null
    case 'mixcloud':
      return extractMixcloudFeed(url) !== null
    case 'spotify':
      return extractSpotifyUri(url) !== null
    default:
      return false
  }
}

// Pick the best CONTROLLABLE source for the global player. Walks the item's
// embeds in PLAYABLE_PLATFORMS priority order (soundcloud → youtube → mixcloud →
// spotify), falling back to the legacy single `mixUrl` when it points at a
// playable platform.
//
// Bandcamp embeds are skipped here (no control API) — they surface only as an
// "ABRIR FUENTE" link via pickOpenSourceUrl. Returns null when the item has no
// playable source at all.
export function pickPlayableSource(item: PlayableRef): PlayableSource | null {
  const embeds = item.embeds ?? []
  for (const platform of PLAYABLE_PLATFORMS) {
    const hit = embeds.find(
      (e) => e.platform === platform && e.url && canExtractSource(platform, e.url),
    )
    if (hit) return { platform, url: hit.url }
  }
  // Legacy fallback: a bare mixUrl with no structured embeds.
  if (item.mixUrl) {
    const p = detectPlatform(item.mixUrl)
    if (p && isPlayablePlatform(p) && canExtractSource(p, item.mixUrl)) {
      return { platform: p, url: item.mixUrl }
    }
  }
  return null
}

// The URL the "ABRIR FUENTE" button opens. Prefers the playable source, then
// ANY embed (incl. Bandcamp / unrecognised), then the legacy mixUrl — so even a
// Bandcamp-only mix still gets a working external link instead of a dead panel.
export function pickOpenSourceUrl(item: PlayableRef): string | null {
  const playable = pickPlayableSource(item)
  if (playable) return playable.url
  const firstEmbed = item.embeds?.find((e) => e.url)
  if (firstEmbed) return firstEmbed.url
  return item.mixUrl ?? null
}

// ── Track blocks → playable refs ────────────────────────────────────────────
// A listicle/articulo `track` block carries its own embeds; adapt it into a
// PlayableRef so the whole list becomes a player queue. Returns null when the
// block has no controllable source (Bandcamp-only tracks stay link-outs).
// The ref id is deterministic (`<parent>::track-<index>`) so player chrome can
// match "is this exact entry playing"; slug points at the PARENT item so the
// HUD's title click reopens the listicle.
export function trackBlockToPlayable(
  parent: Pick<ContentItem, 'id' | 'slug' | 'title'>,
  block: Extract<ArticleBlock, { kind: 'track' }>,
  blockIndex: number,
): PlayableRef | null {
  const ref: PlayableRef = {
    id: `${parent.id}::track-${blockIndex}`,
    slug: parent.slug,
    title: block.title,
    author: block.artist,
    imageUrl: block.imageUrl,
    mixSeries: parent.title,
    embeds: block.embeds,
  }
  return pickPlayableSource(ref) ? ref : null
}
