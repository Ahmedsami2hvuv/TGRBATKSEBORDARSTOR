import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

let datasourceUrl = process.env.DATABASE_URL;

if (datasourceUrl) {
  try {
    const url = new URL(datasourceUrl);
    // رفع حد الاتصالات وتفادي التعليق في بيئة سيرفرلس
    url.searchParams.set("connection_limit", "10");
    url.searchParams.set("pool_timeout", "15");
    
    // تفعيل pgbouncer عند استخدام بورت 6543 الخاص بـ Supabase Pooler
    if (url.port === "6543" || url.hostname.includes("pooler.supabase.com")) {
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
    log: ["error"],
  });

globalForPrisma.prisma = prisma;
