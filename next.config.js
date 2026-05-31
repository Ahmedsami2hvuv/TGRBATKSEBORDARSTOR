/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' }, // السماح بكل الروابط الخارجية لصور السلايدر والمنتجات
    ],
  },
};

module.exports = nextConfig;
