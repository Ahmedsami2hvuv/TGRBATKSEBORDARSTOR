import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

let datasourceUrl = process.env.DATABASE_URL;

if (datasourceUrl && process.env.NODE_ENV === "production") {
  try {
    const url = new URL(datasourceUrl);
    // Limit connections per lambda to 2 to prevent pool exhaustion (ECHECKOUTTIMEOUT)
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", "2");
    }
    // Enable pgbouncer mode if using the Supabase transaction pooler (port 6543)
    if (url.port === "6543" && !url.searchParams.has("pgbouncer")) {
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
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// هجرة تلقائية صامتة لضمان وجود العمود في قاعدة البيانات الفعلية دون عرقلة النشر
prisma.$executeRawUnsafe(
  `ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "hideFromCreditBook" BOOLEAN DEFAULT false;`
).then(() => {
  console.log("[Prisma] Silently ensured hideFromCreditBook column exists in Shop table.");
}).catch((err) => {
  console.error("[Prisma] Failed to silently ensure hideFromCreditBook column:", err);
});
