import { prisma } from "@/lib/prisma";

let isHealed = false;

export async function ensureHidePricesColumns() {
  if (isHealed) return;
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "StoreCategory" ADD COLUMN IF NOT EXISTS "hidePrices" BOOLEAN NOT NULL DEFAULT true;`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "StoreBranch" ADD COLUMN IF NOT EXISTS "hidePrices" BOOLEAN NOT NULL DEFAULT true;`
    );
    isHealed = true;
  } catch (err) {
    console.error("Self-heal hidePrices columns error:", err);
  }
}
