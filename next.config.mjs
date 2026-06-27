// Output mode: server-rendered Next.js (Vercel-targeted, per Backend Plan).
// The static-export + GitHub-Pages config that lived here previously was
// removed when we added Supabase — server components read cookies for auth,
// which fundamentally requires a Node runtime at request time.

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Variant fan-out control. The largest image on screen is a ~720px
    // overlay/hero, so the 2048/3840 retina-huge default widths are dead weight —
    // each distinct candidate width is a separate optimizer origin fetch from
    // Supabase, so trimming the tail caps how many we generate. imageSizes keeps
    // the small widths the 48px rail logos / thumbnails actually request.
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [48, 96, 128, 256, 384],
    // The optimizer caches each generated variant for at least this long before
    // re-fetching the source. Next's default is 60s — far too short: it would
    // re-pull the Supabase original constantly and defeat the egress win. Upload
    // URLs are stable and their content is effectively immutable: routine uploads
    // write fresh paths, and although the one-time recompress backfill overwrites
    // objects in place, these public surfaces were raw <img> before this change,
    // so the optimizer cache starts empty (no stale large variants). A 1-year TTL
    // is therefore safe and keeps traffic off the Supabase quota.
    minimumCacheTTL: 31536000,
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'picsum.photos' },
      // Resident Advisor flyer CDN (Scraper Pipeline § "aggregator framing")
      { protocol: 'https', hostname: 'images.ra.co' },
      // Supabase Storage — covers any Supabase project domain. Migration
      // 0013 created the `uploads` public bucket; image-upload composer
      // writes here and references the public URL on items.image_url.
      { protocol: 'https', hostname: '*.supabase.co' },
      // Common third-party hosts that collaborators paste image URLs from.
      // Substack CDN wraps S3-backed post images; Apple Music + Discogs
      // appear in listicle track covers.
      { protocol: 'https', hostname: 'substackcdn.com' },
      { protocol: 'https', hostname: 'is1-ssl.mzstatic.com' },
      { protocol: 'https', hostname: 'i.discogs.com' },
    ],
  },
  // Guarantees per-icon tree-shaking for lucide-react (imported across ~58
  // source files) so only the icons actually used land in each bundle.
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
}

export default nextConfig
