import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

let datasourceUrl = process.env.DATABASE_URL;

if (datasourceUrl) {
  try {
    const url = new URL(datasourceUrl);
    const isPooler = url.port === "6543" || url.hostname.includes("pooler.supabase.com");

    // في بيئة سيرفرلس (Vercel)، كل حاوية تتعامل مع طلب.
    // تحديد حد الاتصال بـ 1 يمنع نفاد اتصالات قاعدة البيانات (Connection Pool Exhaustion)
    url.searchParams.set("connection_limit", "1");
    // تقليل مهلة الانتظار إلى 10 ثوانٍ لمنع بقاء المتصفح معلقاً في التحميل
    url.searchParams.set("pool_timeout", "10");
    url.searchParams.set("connect_timeout", "10");

    // تفعيل وضع PgBouncer التلقائي عند استخدام وصلة Pooler بورت 6543
    if (isPooler) {
      url.searchParams.set("pgbouncer", "true");
    }

    datasourceUrl = url.toString();
  } catch (e) {
    console.error("[Prisma] Failed to parse DATABASE_URL query parameters", e);
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
} else {
  // الحفاظ على العميل في بيئة الإنتاج أيضاً لتجنب تكرار الاتصالات
  globalForPrisma.prisma = prisma;
}

