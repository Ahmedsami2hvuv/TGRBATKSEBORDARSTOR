import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const results: Record<string, string> = {};

  const execute = async (key: string, sql: string) => {
    try {
      await prisma.$executeRawUnsafe(sql);
      results[key] = "OK";
    } catch (e: any) {
      results[key] = e?.message || "ERROR";
    }
  };

  // 1. إضافة الأعمدة لجدول Shop
  await execute("col_storeEnabled", `ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "storeEnabled" BOOLEAN NOT NULL DEFAULT false;`);
  await execute("col_storeLogoUrl", `ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "storeLogoUrl" TEXT NOT NULL DEFAULT '';`);
  await execute("col_storeBannerUrl", `ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "storeBannerUrl" TEXT NOT NULL DEFAULT '';`);
  await execute("col_storeBio", `ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "storeBio" TEXT NOT NULL DEFAULT '';`);
  await execute("col_storeToken", `ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "storeToken" TEXT NOT NULL DEFAULT '';`);

  // تعبئة storeToken للمحلات
  await execute("populate_storeToken", `
    UPDATE "Shop" 
    SET "storeToken" = 'store_' || substr(md5("id" || 'kse_salt_2026'), 1, 16)
    WHERE "storeToken" IS NULL OR "storeToken" = '';
  `);

  // 2. إنشاء الجداول
  await execute("table_ShopStoreCategory", `
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

  await execute("table_ShopStoreBranch", `
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

  await execute("table_ShopStoreProduct", `
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

  await execute("table_ShopStoreSlide", `
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

  await execute("table_ShopStoreOrder", `
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

  return NextResponse.json({ success: true, results });
}
