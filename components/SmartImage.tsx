import Image from 'next/image'

// ── SmartImage — fill image that optimizes what it safely can ──────────────────
//
// Drop-in for the `<img className="... object-cover/contain ...">` we used to put
// inside `position:relative|absolute` containers across the public surfaces
// (cards, hero, rails, overlays). It always renders a *fill* image, so the
// parent must be positioned and sized (an `aspect-*` box or `absolute inset-0`).
//
// Why a wrapper instead of using next/image directly everywhere:
//   - The Vercel image optimizer only fetches hosts allow-listed in
//     next.config.mjs `remotePatterns`. Collaborators paste image URLs from
//     arbitrary hosts (bandcamp, pinterest, …) — feeding those to <Image> 500s
//     the optimizer. Those hosts aren't on OUR Supabase egress anyway, so we
//     lose nothing by serving them as a plain <img>.
//   - The optimizer flattens animated GIFs. We detect and pass those through raw.
//
// So: optimizable (our Storage + the allow-listed CDNs, non-GIF) → <Image fill>,
// which is what actually cuts Supabase cached-egress (resized WebP variants,
// served + cached by Vercel). Everything else → raw <img> with identical fill
// layout, no behavior change.
//
// Keep OPTIMIZABLE_HOSTS in sync with next.config.mjs `remotePatterns`.

const OPTIMIZABLE_HOSTS = [
  'supabase.co', // our Storage bucket — the egress driver (matches *.supabase.co)
  'images.ra.co',
  'images.unsplash.com',
  'picsum.photos',
  'substackcdn.com',
  'is1-ssl.mzstatic.com',
  'i.discogs.com',
]

function isOptimizable(src: string): boolean {
  // GIFs: the optimizer drops animation — serve raw regardless of host.
  const path = (src.split('?')[0] ?? '').toLowerCase()
  if (path.endsWith('.gif')) return false
  // Same-origin /public assets are always optimizable.
  if (src.startsWith('/')) return true
  try {
    const { hostname } = new URL(src)
    return OPTIMIZABLE_HOSTS.some((h) => hostname === h || hostname.endsWith(`.${h}`))
  } catch {
    return false
  }
}

interface SmartImageProps {
  src: string
  alt: string
  /** Tailwind classes — object-cover/contain, object-position, transitions, etc. */
  className?: string
  /** Responsive hint for the optimizer; required for a sensible variant pick. */
  sizes?: string
  /** Eager-load above-the-fold images (e.g. the hero). */
  priority?: boolean
}

export function SmartImage({ src, alt, className, sizes, priority }: SmartImageProps) {
  if (isOptimizable(src)) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes ?? '100vw'}
        priority={priority}
        className={className}
      />
    )
  }
  // Non-optimizable host or GIF — plain <img>, same fill layout next/image gives.
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt={alt}
      loading={priority ? undefined : 'lazy'}
      className={`absolute inset-0 h-full w-full ${className ?? ''}`}
    />
  )
}
