import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
  // تم إزالة مفتاح eslint هنا لأنه أصبح غير مدعوم في النسخ الأحدث ويسبب تنبيهاً
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
