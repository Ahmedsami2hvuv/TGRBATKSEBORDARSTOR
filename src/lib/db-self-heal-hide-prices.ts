import { prisma } from "@/lib/prisma";

let isHealed = false;

export async function ensureHidePricesColumns() {
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "StoreCategory" ADD COLUMN IF NOT EXISTS "hidePrices" BOOLEAN NOT NULL DEFAULT true;`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "StoreBranch" ADD COLUMN IF NOT EXISTS "hidePrices" BOOLEAN NOT NULL DEFAULT true;`
    );
    
    if (!isHealed) {
      await prisma.storeCategory.updateMany({
        data: { hidePrices: true }
      });
      await prisma.storeBranch.updateMany({
        data: { hidePrices: true }
      });
      isHealed = true;
    }
  } catch (err) {
    console.error("Self-heal hidePrices columns error:", err);
  }
}

