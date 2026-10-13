import { prisma } from "@/lib/prisma";

let isHealed = false;

export async function ensureHidePricesColumns() {
  if (isHealed) return;
  try {
    // فحص آمن وسريع عبر information_schema دون قفل الجدول
    const existing = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_name IN ('StoreCategory', 'StoreBranch') 
         AND column_name = 'hidePrices' LIMIT 2;`
    );

    if (existing && existing.length >= 2) {
      isHealed = true;
      return;
    }

    // إذا لم تكن موجودة فقط، يتم إضافتها بحذر
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "StoreCategory" ADD COLUMN IF NOT EXISTS "hidePrices" BOOLEAN NOT NULL DEFAULT true;`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "StoreBranch" ADD COLUMN IF NOT EXISTS "hidePrices" BOOLEAN NOT NULL DEFAULT true;`
    );
    isHealed = true;
  } catch (err) {
    console.error("Self-heal hidePrices columns error:", err);
    // نعتبره مكتملاً حتى لو فشل لتجنب تكرار الخطأ وتجميد الموقع
    isHealed = true;
  }
}


