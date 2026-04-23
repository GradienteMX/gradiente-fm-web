/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/espectro-fm-web',
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'picsum.photos' },
    ],
  },
}

export default nextConfig
