import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
  // تم إزالة eslint و typescript لتجنب تحذيرات Vercel في النسخ الجديدة
};

export default nextConfig;
