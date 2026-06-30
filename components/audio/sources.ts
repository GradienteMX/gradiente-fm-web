import type { ContentItem, EmbedPlatform } from '@/lib/types'
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

// A host-matched embed isn't automatically controllable: each platform's widget
// needs a native id/feed/uri that a bare hostname match doesn't guarantee
// exists (a YouTube channel/playlist link, a Mixcloud profile root, a non-track
// Spotify URL all match the host but yield no playable identifier). Gate
// "playable" on that identifier actually being extractable — otherwise the
// source falls through to the link-out instead of rendering a dead player.
function canExtractSource(platform: EmbedPlatform, url: string): boolean {
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
export function pickPlayableSource(item: ContentItem): PlayableSource | null {
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
export function pickOpenSourceUrl(item: ContentItem): string | null {
  const playable = pickPlayableSource(item)
  if (playable) return playable.url
  const firstEmbed = item.embeds?.find((e) => e.url)
  if (firstEmbed) return firstEmbed.url
  return item.mixUrl ?? null
}
