import { prisma } from "@/lib/prisma";

let hasCheckedShopStore = false;

/**
 * إنشاء الجداول والأعمدة الخاصة بمتجر المحلات تلقائياً في قاعدة البيانات
 * دون الحاجة لأي أوامر يدوية من المستخدم أو إيقاف السيرفر.
 */
export async function ensureShopStoreTablesIfMissing(): Promise<void> {
  if (hasCheckedShopStore) return;

  try {
    // 1. إضافة أعمدة متجر المحل في جدول Shop
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "storeEnabled" BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "storeBannerUrl" TEXT NOT NULL DEFAULT '';
      ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "storeBio" TEXT NOT NULL DEFAULT '';
    `);

    // 2. إنشاء جدول أقسام متجر المحل ShopStoreCategory
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ShopStoreCategory" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "shopId" TEXT NOT NULL REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        "name" TEXT NOT NULL,
        "photoUrl" TEXT NOT NULL DEFAULT '',
        "sequence" INTEGER NOT NULL DEFAULT 0,
        "active" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS "ShopStoreCategory_shopId_active_sequence_idx" ON "ShopStoreCategory"("shopId", "active", "sequence");
    `);

    // 3. إنشاء جدول فروع أقسام متجر المحل ShopStoreBranch
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ShopStoreBranch" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "shopId" TEXT NOT NULL REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        "categoryId" TEXT NOT NULL REFERENCES "ShopStoreCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        "parentBranchId" TEXT REFERENCES "ShopStoreBranch"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        "name" TEXT NOT NULL,
        "photoUrl" TEXT NOT NULL DEFAULT '',
        "sequence" INTEGER NOT NULL DEFAULT 0,
        "active" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS "ShopStoreBranch_shopId_idx" ON "ShopStoreBranch"("shopId");
      CREATE INDEX IF NOT EXISTS "ShopStoreBranch_categoryId_idx" ON "ShopStoreBranch"("categoryId");
      CREATE INDEX IF NOT EXISTS "ShopStoreBranch_parentBranchId_idx" ON "ShopStoreBranch"("parentBranchId");
      CREATE INDEX IF NOT EXISTS "ShopStoreBranch_active_sequence_idx" ON "ShopStoreBranch"("active", "sequence");
    `);

    // 4. إنشاء جدول منتجات متجر المحل ShopStoreProduct
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ShopStoreProduct" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "shopId" TEXT NOT NULL REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        "categoryId" TEXT NOT NULL REFERENCES "ShopStoreCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        "branchId" TEXT REFERENCES "ShopStoreBranch"("id") ON DELETE SET NULL ON UPDATE CASCADE,
        "name" TEXT NOT NULL,
        "description" TEXT NOT NULL DEFAULT '',
        "price" DECIMAL(10, 2) NOT NULL,
        "photoUrl" TEXT NOT NULL DEFAULT '',
        "photoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
        "active" BOOLEAN NOT NULL DEFAULT true,
        "sequence" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS "ShopStoreProduct_shopId_active_sequence_idx" ON "ShopStoreProduct"("shopId", "active", "sequence");
      CREATE INDEX IF NOT EXISTS "ShopStoreProduct_categoryId_idx" ON "ShopStoreProduct"("categoryId");
      CREATE INDEX IF NOT EXISTS "ShopStoreProduct_branchId_idx" ON "ShopStoreProduct"("branchId");
    `);

    // 5. إنشاء جدول إعلانات بانر متجر المحل ShopStoreSlide
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ShopStoreSlide" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "shopId" TEXT NOT NULL REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        "title" TEXT NOT NULL DEFAULT '',
        "imageUrl" TEXT NOT NULL,
        "linkUrl" TEXT NOT NULL DEFAULT '',
        "active" BOOLEAN NOT NULL DEFAULT true,
        "sequence" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS "ShopStoreSlide_shopId_active_sequence_idx" ON "ShopStoreSlide"("shopId", "active", "sequence");
    `);

    // 6. إنشاء جدول طلبات متجر المحل ShopStoreOrder
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ShopStoreOrder" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "orderNumber" TEXT NOT NULL UNIQUE,
        "shopId" TEXT NOT NULL REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        "shopName" TEXT NOT NULL,
        "customerPhone" TEXT NOT NULL,
        "regionName" TEXT NOT NULL,
        "receiptTime" TEXT NOT NULL,
        "totalPrice" DECIMAL(10, 2) NOT NULL,
        "items" JSONB NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS "ShopStoreOrder_shopId_idx" ON "ShopStoreOrder"("shopId");
      CREATE INDEX IF NOT EXISTS "ShopStoreOrder_createdAt_idx" ON "ShopStoreOrder"("createdAt");
    `);

    hasCheckedShopStore = true;
  } catch (error) {
    console.error("[DbSelfHealShopStore] Error creating shop store tables:", error);
  }
}
