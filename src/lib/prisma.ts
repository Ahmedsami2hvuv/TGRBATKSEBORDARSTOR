import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

let datasourceUrl = process.env.DATABASE_URL;

if (datasourceUrl && process.env.NODE_ENV === "production") {
  try {
    const url = new URL(datasourceUrl);
    // Limit connections per lambda to 5 to prevent pool exhaustion while allowing concurrent queries
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", "5");
    }
    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set("pool_timeout", "20");
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
    log: ["error"],
  });

globalForPrisma.prisma = prisma;
