import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { revalidateTag } from "next/cache";

/**
 * جلب هامش الربح المعتمد لفرع معين بناءً على التسلسل الهرمي:
 * الفرع -> القسم -> الإعدادات العامة
 */
export async function getEffectiveProfitMargin(branchId: string) {
  const branch = await prisma.storeBranch.findUnique({
    where: { id: branchId },
    select: {
      profitMargin: true,
      category: { select: { profitMargin: true } }
    }
  });

  const globalSettings = await prisma.globalSettings.findUnique({
    where: { id: "system" },
    select: { profitMargin: true }
  });

  const branchMargin = Number(branch?.profitMargin || 0);
  const categoryMargin = Number(branch?.category?.profitMargin || 0);
  const globalMargin = Number(globalSettings?.profitMargin || 0);

  return branchMargin > 0 ? branchMargin : (categoryMargin > 0 ? categoryMargin : globalMargin);
}

/**
 * تحديث أسعار البيع لجميع منتجات فرع معين بناءً على هامش الربح الحالي
 */
export async function syncBranchProductsPrice(branchId: string) {
  const margin = await getEffectiveProfitMargin(branchId);

  // تحديث المنتجات الأساسية
  await prisma.$executeRaw`
    UPDATE "StoreProduct"
    SET "salePrice" = "purchasePrice" + ${margin}
    WHERE "branchId" = ${branchId}
  `;

  // تحديث المتغيرات (Variants)
  await prisma.$executeRaw`
    UPDATE "StoreProductVariant"
    SET "salePrice" = "purchasePrice" + ${margin}
    WHERE "productId" IN (SELECT id FROM "StoreProduct" WHERE "branchId" = ${branchId})
  `;

  revalidateTag("products");
}

/**
 * تحديث أسعار البيع لجميع المنتجات في قسم معين
 */
export async function syncCategoryProductsPrice(categoryId: string) {
  const branches = await prisma.storeBranch.findMany({
    where: { categoryId },
    select: { id: true }
  });

  for (const branch of branches) {
    await syncBranchProductsPrice(branch.id);
  }
}

/**
 * تحديث شامل لجميع أسعار البيع في المتجر (يستخدم عند تغيير الربح العام)
 */
export async function syncAllStoreProductsPrice() {
  const branches = await prisma.storeBranch.findMany({
    select: { id: true }
  });

  for (const branch of branches) {
    await syncBranchProductsPrice(branch.id);
  }
}
