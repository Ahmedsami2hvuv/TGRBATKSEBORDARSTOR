import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { revalidateTag } from "next/cache";

/**
 * جلب هامش الربح المعتمد بناءً على التسلسل الهرمي:
 * المورد -> الفرع -> القسم -> الإعدادات العامة
 */
export async function getEffectiveProfitMargin(branchId: string, supplierId?: string | null) {
  let supplierMargin = 0;
  if (supplierId) {
    const supplier = await prisma.storeSupplier.findUnique({
      where: { id: supplierId },
      select: { profitMargin: true }
    });
    supplierMargin = Number(supplier?.profitMargin || 0);
  }

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

  // الأولوية حسب الترتيب
  const effective = supplierMargin || branchMargin || categoryMargin || globalMargin;
  return effective === -1 ? 0 : effective;
}

/**
 * تحديث أسعار البيع لجميع منتجات فرع معين بناءً على هامش الربح الحالي
 */
export async function syncBranchProductsPrice(branchId: string) {
  const branch = await prisma.storeBranch.findUnique({
    where: { id: branchId },
    include: {
      category: true,
      products: {
        include: { supplier: true, variants: true }
      }
    }
  });

  if (!branch) return;

  const globalSettings = await prisma.globalSettings.findUnique({
    where: { id: "system" },
    select: { profitMargin: true }
  });

  const globalMargin = Number(globalSettings?.profitMargin || 0);
  const branchMargin = Number(branch.profitMargin || 0);
  const categoryMargin = Number(branch.category?.profitMargin || 0);

  for (const product of branch.products) {
    const supplierMargin = Number(product.supplier?.profitMargin || 0);
    const rawEffectiveMargin = supplierMargin || branchMargin || categoryMargin || globalMargin;
    const effectiveMargin = rawEffectiveMargin === -1 ? 0 : rawEffectiveMargin;

    const purchasePrice = Number(product.purchasePrice);
    const addedMargin = effectiveMargin <= 1 ? (purchasePrice * effectiveMargin) : effectiveMargin;
    const newProductSalePrice = purchasePrice + addedMargin;

    await prisma.storeProduct.update({
      where: { id: product.id },
      data: { salePrice: newProductSalePrice }
    });

    for (const variant of product.variants) {
      const vPurchasePrice = Number(variant.purchasePrice);
      const vAddedMargin = effectiveMargin <= 1 ? (vPurchasePrice * effectiveMargin) : effectiveMargin;
      const newVariantSalePrice = vPurchasePrice + vAddedMargin;
      await prisma.storeProductVariant.update({
        where: { id: variant.id },
        data: { salePrice: newVariantSalePrice }
      });
    }
  }

  // @ts-ignore
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
