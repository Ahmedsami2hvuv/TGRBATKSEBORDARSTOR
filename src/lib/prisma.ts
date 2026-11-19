import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

/**
 * ضبط رابط قاعدة البيانات لمنع خطأ "Timed out fetching a new connection from the connection pool".
 * - عند استخدام Supabase Pooler (Supavisor) نستخدم وضع المعاملات (بورت 6543) مع pgbouncer=true
 *   ونرفع حد الاتصالات المحلي لأن الـ Pooler يوزع الاتصالات على قاعدة البيانات.
 * - نفرض الحد الأدنى للاتصالات حتى لو كان الرابط في البيئة يحتوي connection_limit أقل (مثل 3).
 * - يمكن التحكم بالقيم من المتغيرات PRISMA_CONNECTION_LIMIT و PRISMA_POOL_TIMEOUT.
 */
function buildDatasourceUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    const isSupavisorHost = url.hostname.includes("pooler.supabase.com");

    // وضع الجلسة (5432) على الـ Pooler يحجز اتصالاً لكل عميل؛ نحوله لوضع المعاملات (6543)
    if (isSupavisorHost && (url.port === "" || url.port === "5432")) {
      url.port = "6543";
    }

    const isTransactionPooler = url.port === "6543";

    const envLimit = Number(process.env.PRISMA_CONNECTION_LIMIT);
    const minLimit = Number.isFinite(envLimit) && envLimit > 0 ? envLimit : isTransactionPooler ? 10 : 5;
    const currentLimit = Number(url.searchParams.get("connection_limit"));
    if (!Number.isFinite(currentLimit) || currentLimit < minLimit) {
      url.searchParams.set("connection_limit", String(minLimit));
    }

    const envPoolTimeout = Number(process.env.PRISMA_POOL_TIMEOUT);
    url.searchParams.set(
      "pool_timeout",
      String(Number.isFinite(envPoolTimeout) && envPoolTimeout > 0 ? envPoolTimeout : 20),
    );

    if (!url.searchParams.has("connect_timeout")) {
      url.searchParams.set("connect_timeout", "15");
    }

    // وضع المعاملات لا يدعم الـ prepared statements، لذلك pgbouncer=true إلزامي
    if (isTransactionPooler) {
      url.searchParams.set("pgbouncer", "true");
    }

    return url.toString();
  } catch (e) {
    console.error("[Prisma] Failed to parse DATABASE_URL query parameters", e);
    return raw;
  }
}

const datasourceUrl = buildDatasourceUrl(process.env.DATABASE_URL);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// الحفاظ على عميل واحد لكل نسخة تشغيل لتجنب تكرار الاتصالات
globalForPrisma.prisma = prisma;
