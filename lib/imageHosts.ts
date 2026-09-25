/**
 * Which image addresses Next's optimizer will serve — the allow-list in
 * next.config.ts `remotePatterns`, kept in step by hand (change both).
 *
 * Pieces, franjas and listings carry art from anywhere people pasted it
 * (bandcamp, wp.com, pinterest…). The optimizer refuses any other host (and
 * next/image throws on one), and a GIF loses its animation in it, so those
 * are served as they are (components/kit/Imagen) or left out where art must
 * be same-origin (the /mapa texture atlas).
 */

const OPTIMIZABLE: Array<{ host: string; path?: string }> = [
  // Our Storage — the Supabase egress driver the optimizer exists to cut.
  { host: 'supabase.co' },
  { host: 'images.ra.co' },
  { host: 'i.ytimg.com' },
  { host: 'images.unsplash.com' },
  { host: 'picsum.photos' },
  { host: 'substackcdn.com' },
  { host: 'is1-ssl.mzstatic.com' },
  { host: 'i.discogs.com' },
  // Wayback snapshots only (production restricts the optimizer to /web/**).
  { host: 'web.archive.org', path: '/web/' },
]

/** True when the optimizer can serve this address (same-origin paths, allow-listed https hosts, never GIFs). */
export function isOptimizable(src: string): boolean {
  if (src.split('?')[0].toLowerCase().endsWith('.gif')) return false
  if (src.startsWith('/') && !src.startsWith('//')) return true
  try {
    const { protocol, hostname, pathname } = new URL(src)
    if (protocol !== 'https:') return false
    return OPTIMIZABLE.some((o) => (hostname === o.host || hostname.endsWith(`.${o.host}`)) && (!o.path || pathname.startsWith(o.path)))
  } catch {
    return false
  }
}
