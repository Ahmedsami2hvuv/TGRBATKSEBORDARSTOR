import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

let datasourceUrl = process.env.DATABASE_URL;

if (datasourceUrl) {
  try {
    const url = new URL(datasourceUrl);
    const isPooler = url.port === "6543" || url.hostname.includes("pooler.supabase.com");

    // إتاحة عدد اتصالات كافٍ لتشغيل استعلامات Promise.all المتزامنة في صفحات لوحة التحكم والمندوب والمتجر
    url.searchParams.set("connection_limit", "10");
    // مهلة انتظار مرنة تمنع أخطاء Timeout عند تزامن عدة استعلامات في نفس الصفحة
    url.searchParams.set("pool_timeout", "20");
    url.searchParams.set("connect_timeout", "15");

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

