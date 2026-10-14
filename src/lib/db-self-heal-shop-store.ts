import { prisma } from "@/lib/prisma";

let hasCheckedShopStore = false;

/**
 * دالة آمنة ومحصنة لتنفيذ أمر SQL منفرد دون أن تؤثر على عمل السيرفر
 */
async function safeExecute(sql: string) {
  try {
    await prisma.$executeRawUnsafe(sql);
  } catch (err: any) {
    // تجاهل أخطاء وجود العمود أو الجدول مسبقاً
    console.warn("[DbSelfHealShopStore] Notice:", err?.message || err);
  }
}

/**
 * إنشاء الجداول والأعمدة الخاصة بمتجر المحلات تلقائياً في قاعدة البيانات
 * كل أمر ينفذ بشكل منفصل لتجنب أخطاء بريزما ومجمع سوبابيس (Supabase Pooler).
 */
export async function ensureShopStoreTablesIfMissing(): Promise<void> {
  if (hasCheckedShopStore) return;

  try {
    // 1. إضافة أعمدة متجر المحل في جدول Shop
    await safeExecute(`ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "storeEnabled" BOOLEAN NOT NULL DEFAULT false;`);
    await safeExecute(`ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "storeBannerUrl" TEXT NOT NULL DEFAULT '';`);
    await safeExecute(`ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "storeBio" TEXT NOT NULL DEFAULT '';`);
    await safeExecute(`ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "storeToken" TEXT NOT NULL DEFAULT '';`);

    // توليد توكن مشفر لكل محل ليس لديه توكن
    await safeExecute(`
      UPDATE "Shop" 
      SET "storeToken" = 'store' || md5(id || 'kse_secret_salt') 
      WHERE "storeToken" IS NULL OR "storeToken" = '';
    `);

    // 2. إنشاء جدول أقسام متجر المحل ShopStoreCategory
    await safeExecute(`
      CREATE TABLE IF NOT EXISTS "ShopStoreCategory" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "shopId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "photoUrl" TEXT NOT NULL DEFAULT '',
        "sequence" INTEGER NOT NULL DEFAULT 0,
        "active" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await safeExecute(`CREATE INDEX IF NOT EXISTS "ShopStoreCategory_shopId_active_sequence_idx" ON "ShopStoreCategory"("shopId", "active", "sequence");`);

    // 3. إنشاء جدول فروع أقسام متجر المحل ShopStoreBranch
    await safeExecute(`
      CREATE TABLE IF NOT EXISTS "ShopStoreBranch" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "shopId" TEXT NOT NULL,
        "categoryId" TEXT NOT NULL,
        "parentBranchId" TEXT,
        "name" TEXT NOT NULL,
        "photoUrl" TEXT NOT NULL DEFAULT '',
        "sequence" INTEGER NOT NULL DEFAULT 0,
        "active" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await safeExecute(`CREATE INDEX IF NOT EXISTS "ShopStoreBranch_shopId_idx" ON "ShopStoreBranch"("shopId");`);
    await safeExecute(`CREATE INDEX IF NOT EXISTS "ShopStoreBranch_categoryId_idx" ON "ShopStoreBranch"("categoryId");`);

    // 4. إنشاء جدول منتجات متجر المحل ShopStoreProduct
    await safeExecute(`
      CREATE TABLE IF NOT EXISTS "ShopStoreProduct" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "shopId" TEXT NOT NULL,
        "categoryId" TEXT NOT NULL,
        "branchId" TEXT,
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
    `);
    await safeExecute(`CREATE INDEX IF NOT EXISTS "ShopStoreProduct_shopId_active_sequence_idx" ON "ShopStoreProduct"("shopId", "active", "sequence");`);

    // 5. إنشاء جدول إعلانات بانر متجر المحل ShopStoreSlide
    await safeExecute(`
      CREATE TABLE IF NOT EXISTS "ShopStoreSlide" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "shopId" TEXT NOT NULL,
        "title" TEXT NOT NULL DEFAULT '',
        "imageUrl" TEXT NOT NULL,
        "linkUrl" TEXT NOT NULL DEFAULT '',
        "active" BOOLEAN NOT NULL DEFAULT true,
        "sequence" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await safeExecute(`CREATE INDEX IF NOT EXISTS "ShopStoreSlide_shopId_active_sequence_idx" ON "ShopStoreSlide"("shopId", "active", "sequence");`);

    // 6. إنشاء جدول طلبات متجر المحل ShopStoreOrder
    await safeExecute(`
      CREATE TABLE IF NOT EXISTS "ShopStoreOrder" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "orderNumber" TEXT NOT NULL UNIQUE,
        "shopId" TEXT NOT NULL,
        "shopName" TEXT NOT NULL,
        "customerPhone" TEXT NOT NULL,
        "regionName" TEXT NOT NULL,
        "receiptTime" TEXT NOT NULL,
        "totalPrice" DECIMAL(10, 2) NOT NULL,
        "items" JSONB NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await safeExecute(`CREATE INDEX IF NOT EXISTS "ShopStoreOrder_shopId_idx" ON "ShopStoreOrder"("shopId");`);
    await safeExecute(`CREATE INDEX IF NOT EXISTS "ShopStoreOrder_createdAt_idx" ON "ShopStoreOrder"("createdAt");`);

    hasCheckedShopStore = true;
  } catch (error) {
    console.error("[DbSelfHealShopStore] Error creating shop store tables:", error);
  }
}
