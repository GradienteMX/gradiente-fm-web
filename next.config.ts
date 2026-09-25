import type { NextConfig } from 'next'

// Server-rendered Next.js on Vercel. Supabase reads cookies for auth, so this
// needs a Node runtime at request time (no static export).
const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    formats: ['image/avif', 'image/webp'],
    // Production's egress rules (the Supabase quota incident, 2026-08/09): few
    // candidate widths, and each optimized variant cached for a year so the
    // optimizer doesn't keep re-pulling originals from Supabase Storage.
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [48, 96, 128, 256, 384],
    minimumCacheTTL: 31536000,
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'images.ra.co' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'substackcdn.com' },
      { protocol: 'https', hostname: 'is1-ssl.mzstatic.com' },
      { protocol: 'https', hostname: 'i.discogs.com' },
      // Archivo Vivo: only Wayback snapshots, as production had it.
      { protocol: 'https', hostname: 'web.archive.org', pathname: '/web/**' },
    ],
  },
  transpilePackages: ['three'],
}

export default nextConfig
