/**
 * SOURCES — where a piece's sound lives, and what we can honestly do with it.
 *
 * A host match is not enough to call a source playable: each bridge needs a
 * native identifier (a YouTube video id, a `spotify:` URI; SoundCloud's widget
 * takes the canonical URL as-is). Anything we can't drive — Bandcamp (no
 * control API), Mixcloud (its widget can't be driven reliably from a hidden
 * iframe), placeholders like `#` — is a link-out, never a dead play button.
 *
 * Also: the few numbers the deck is allowed to show (clock, catalog length,
 * tempo) are parsed here from catalog data, never invented.
 */

import type { ArticleBlock, ContentItem, EmbedPlatform, MixEmbed } from '@/lib/types'
import type { Track } from '@/lib/store/player'
import { effectiveBand } from '@/lib/vibe'

/** Platforms with a transport we can drive, in priority order. */
export const DRIVABLE: EmbedPlatform[] = ['soundcloud', 'youtube', 'spotify']

export function isHttp(url: string | undefined | null): url is string {
  return typeof url === 'string' && /^https?:\/\/[^\s]+\.[^\s]+/i.test(url)
}

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

export function extractYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([\w-]{11})(?![\w-])/)
  if (m) return m[1]
  try {
    const v = new URL(url).searchParams.get('v')
    if (v && /^[\w-]{11}$/.test(v)) return v
  } catch {
    /* not a URL */
  }
  return null
}

export function extractSpotifyUri(url: string): string | null {
  const m = url.match(/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]{22})(?![A-Za-z0-9])/)
  if (m) return `spotify:${m[1]}:${m[2]}`
  if (/^spotify:(track|album|playlist|episode|show|artist):[A-Za-z0-9]{22}$/.test(url)) return url
  return null
}

/** True when a bridge can actually load this embed. */
export function isPlayableEmbed(e: MixEmbed): boolean {
  if (!isHttp(e.url)) return false
  switch (e.platform) {
    case 'soundcloud':
      return /soundcloud\.com\/[^/?#]+\/[^/?#]+/.test(e.url)
    case 'youtube':
      return extractYouTubeId(e.url) !== null
    case 'spotify':
      return extractSpotifyUri(e.url) !== null
    default:
      return false
  }
}

export interface SourceRow {
  platform: EmbedPlatform
  url: string
  playable: boolean
}

/**
 * Every real source a piece carries (embeds + legacy `mixUrl`), deduped:
 * drivable ones first in priority order, then the link-outs.
 */
export function sourcesOf(item: Pick<ContentItem, 'embeds' | 'mixUrl'>): SourceRow[] {
  const rows: SourceRow[] = []
  const seen = new Set<string>()
  const push = (platform: EmbedPlatform, url: string) => {
    if (!isHttp(url) || seen.has(url)) return
    seen.add(url)
    rows.push({ platform, url, playable: isPlayableEmbed({ platform, url }) })
  }
  for (const e of item.embeds ?? []) push(e.platform, e.url)
  if (item.mixUrl && isHttp(item.mixUrl)) {
    const p = detectPlatform(item.mixUrl)
    if (p) push(p, item.mixUrl)
  }
  const rank = (r: SourceRow) => (r.playable ? DRIVABLE.indexOf(r.platform) : 10 + ['bandcamp', 'mixcloud', 'youtube', 'spotify', 'soundcloud'].indexOf(r.platform))
  return rows.sort((a, b) => rank(a) - rank(b))
}

export function preferredSource(item: Pick<ContentItem, 'embeds' | 'mixUrl'>): MixEmbed | null {
  const r = sourcesOf(item).find((s) => s.playable)
  return r ? { platform: r.platform, url: r.url } : null
}

/** The Track a mix plays as (optionally from a specific source). */
export function mixTrack(item: ContentItem, source?: MixEmbed | null): Track | null {
  const src = source ?? preferredSource(item)
  if (!src) return null
  const b = effectiveBand(item)
  return {
    itemId: item.id,
    slug: item.slug,
    title: item.title,
    artist: item.author ?? item.subtitle,
    imageUrl: item.imageUrl,
    energy: (b.min + b.max) / 2,
    source: { platform: src.platform, url: src.url },
  }
}

// ── tempo ──────────────────────────────────────────────────────────────────

export function parseBpmRange(s: string | undefined | null): { min: number; max: number; mid: number } | null {
  if (!s) return null
  const nums = (s.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => parseFloat(n.replace(',', '.'))).filter((n) => n >= 40 && n <= 260)
  if (!nums.length) return null
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  return { min, max, mid: (min + max) / 2 }
}

/**
 * The tempo a piece of audio honestly carries, from catalog data only:
 * a mix's BPM range, else the mean of its tracklist, a list entry's own BPM.
 */
export function tempoOf(item: ContentItem | null | undefined, entry?: number): number | null {
  if (!item) return null
  if (entry !== undefined) {
    const b = item.articleBody?.[entry] as ArticleBlock | undefined
    return b && b.kind === 'track' && b.bpm ? b.bpm : null
  }
  const r = parseBpmRange(item.bpmRange)
  if (r) return r.mid
  const bpms = (item.tracklist ?? []).map((t) => t.bpm).filter((b): b is number => typeof b === 'number' && b > 40)
  return bpms.length ? bpms.reduce((a, b) => a + b, 0) / bpms.length : null
}

/**
 * Beat frequency for the field pulse, folded to half-time until it is at or
 * under 3 Hz — nothing in the interface changes brightness faster than that.
 */
export function pulseHz(bpm: number): number {
  let hz = bpm / 60
  while (hz > 3) hz /= 2
  return hz
}

// ── clocks ─────────────────────────────────────────────────────────────────

/** "1:04:12" / "44:17" → seconds. */
export function parseClock(s: string | undefined | null): number | null {
  if (!s) return null
  const parts = s.trim().split(':').map((p) => Number(p))
  if (!parts.length || parts.some((n) => !Number.isFinite(n))) return null
  return parts.reduce((acc, n) => acc * 60 + n, 0)
}

/** Seconds → "4:05" / "1:04:12". */
export function clock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0
  const s = Math.floor(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`
}

/** Seconds → "1 h 04 min" / "44 min" (catalog length, human). */
export function span(sec: number | null | undefined): string | null {
  if (!sec || sec <= 0) return null
  const m = Math.round(sec / 60)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`
}

/** Seconds → words for screen readers ("12 min 3 s"). */
export function spoken(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  return [h ? `${h} h` : '', m ? `${m} min` : '', `${r} s`].filter(Boolean).join(' ')
}

export const SOURCE_NOTE: Partial<Record<EmbedPlatform, string>> = {
  spotify: 'Spotify solo entrega 30 s sin una cuenta Premium abierta en este navegador.',
  mixcloud: 'Mixcloud no se puede tocar dentro de Gradiente: se abre en su sitio.',
  bandcamp: 'Bandcamp no permite controlarlo desde aquí: se abre en su sitio.',
}
