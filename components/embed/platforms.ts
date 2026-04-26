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
