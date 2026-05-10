import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // تعطيل توليد الـ Source Maps لتقليل حجم الرفع وتسريع العملية
  productionBrowserSourceMaps: false,
};

export default nextConfig;
