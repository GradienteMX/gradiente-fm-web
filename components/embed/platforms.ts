import type { EmbedPlatform } from '@/lib/types'

export const PLATFORM_LABELS: Record<EmbedPlatform, string> = {
  soundcloud: 'SOUNDCLOUD',
  youtube: 'YOUTUBE',
  spotify: 'SPOTIFY',
  bandcamp: 'BANDCAMP',
  mixcloud: 'MIXCLOUD',
}

export const PLATFORM_ORDER: EmbedPlatform[] = [
  'soundcloud',
  'youtube',
  'spotify',
  'bandcamp',
  'mixcloud',
]

export function detectPlatform(url: string): EmbedPlatform | null {
  try {
    const { hostname } = new URL(url)
    if (hostname.includes('soundcloud.com')) return 'soundcloud'
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) return 'youtube'
    if (hostname.includes('spotify.com')) return 'spotify'
    if (hostname.includes('bandcamp.com')) return 'bandcamp'
    if (hostname.includes('mixcloud.com')) return 'mixcloud'
    return null
  } catch {
    return null
  }
}

// ── Playable platforms ──────────────────────────────────────────────────────
// Platforms with a real JS transport API we can drive from our own player
// chrome (a hidden, audio-only iframe). Order is PRIORITY: when a mix carries
// several sources, the first match here is the one the global player loads.
//
// Bandcamp is intentionally ABSENT — it ships no public player-control API, and
// its embed iframe needs an internal album/track id that a plain URL doesn't
// expose. So Bandcamp can only ever be a link-out ("ABRIR FUENTE"), never a
// controllable source.
export const PLAYABLE_PLATFORMS: EmbedPlatform[] = [
  'soundcloud',
  'youtube',
  'mixcloud',
  'spotify',
]

export function isPlayablePlatform(p: EmbedPlatform): boolean {
  return PLAYABLE_PLATFORMS.includes(p)
}

// ── URL → platform-native identifier extraction ─────────────────────────────
// Each controllable platform's widget API keys off a different identifier:
// YouTube an 11-char video id, Spotify a `spotify:` URI, Mixcloud the cloudcast
// path. SoundCloud's widget loads the full canonical URL as-is (no extractor).

export function extractYouTubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([\w-]{11})/,
  )
  if (m) return m[1]
  // music.youtube.com / bare ?v= fallbacks via URLSearchParams.
  try {
    const v = new URL(url).searchParams.get('v')
    if (v && /^[\w-]{11}$/.test(v)) return v
  } catch {
    /* not a parseable URL */
  }
  return null
}

export function extractSpotifyUri(url: string): string | null {
  // open.spotify.com/<type>/<id> (optionally /intl-xx/) → spotify:<type>:<id>.
  const m = url.match(
    /open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]+)/,
  )
  if (m) return `spotify:${m[1]}:${m[2]}`
  // Already a spotify: URI.
  if (/^spotify:(track|album|playlist|episode|show|artist):[A-Za-z0-9]+$/.test(url)) {
    return url
  }
  return null
}

// First path segments that are Mixcloud routes, not user profiles — so a URL
// like /widget/iframe/ or /discover/… is never mistaken for a cloudcast.
const MIXCLOUD_RESERVED = new Set([
  'widget',
  'discover',
  'search',
  'upload',
  'dashboard',
  'settings',
  'notifications',
  'live',
  'select',
  'pro',
  'categories',
  'tag',
])

export function extractMixcloudFeed(url: string): string | null {
  // Mixcloud's widget keys off the cloudcast PATH, e.g.
  // https://www.mixcloud.com/<user>/<show>/ → "/<user>/<show>/".
  try {
    const u = new URL(url)
    if (!u.hostname.includes('mixcloud.com')) return null
    // Mixcloud's own Share→Embed surfaces /widget/iframe/?feed=<encoded path>;
    // the real cloudcast key lives in the (already-decoded) feed param, not the
    // pathname. Prefer it when present.
    const feedParam = u.searchParams.get('feed')
    let path = feedParam ?? u.pathname
    if (!path.startsWith('/')) path = '/' + path
    if (!path.endsWith('/')) path += '/'
    const segs = path.split('/').filter(Boolean)
    // Need user + show, and the first segment must be a real profile — not a
    // reserved Mixcloud route (widget/discover/search/…).
    if (segs.length < 2) return null
    if (MIXCLOUD_RESERVED.has(segs[0].toLowerCase())) return null
    return path
  } catch {
    return null
  }
}
