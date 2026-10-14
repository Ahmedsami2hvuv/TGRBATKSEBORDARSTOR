import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

let datasourceUrl = process.env.DATABASE_URL;

if (datasourceUrl) {
  try {
    const url = new URL(datasourceUrl);
    const isPooler = url.port === "6543" || url.hostname.includes("pooler.supabase.com");

    // ضبط عدد الاتصالات بشكل متوازن لمنع استنفاذ الاتصالات
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", "10");
    }
    // مهلة انتظار مرنة تمنع فشل الطلبات في أوقات الذروة
    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set("pool_timeout", "30");
    }
    if (!url.searchParams.has("connect_timeout")) {
      url.searchParams.set("connect_timeout", "15");
    }

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

