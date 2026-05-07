// Output mode: server-rendered Next.js (Vercel-targeted, per Backend Plan).
// The static-export + GitHub-Pages config that lived here previously was
// removed when we added Supabase — server components read cookies for auth,
// which fundamentally requires a Node runtime at request time.

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
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
}

export default nextConfig
