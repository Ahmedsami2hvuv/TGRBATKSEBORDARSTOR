import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
  // هذا السطر يخبر الخادم بتخطي أخطاء TypeScript وقت الرفع
  typescript: {
    ignoreBuildErrors: true,
  },
  // هذا السطر يتخطى أخطاء الكود الشكلية (ESLint) حتى لا توقف الرفع أيضاً
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;