"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function updateSupplierProductPrice(formData: FormData) {
  try {
    const productId = formData.get("productId") as string;
    const purchasePrice = parseFloat(formData.get("purchasePrice") as string);
    const supplierId = formData.get("supplierId") as string;
    const token = formData.get("token") as string;

    if (!productId || isNaN(purchasePrice) || !supplierId || !token) {
      throw new Error("بيانات غير مكتملة");
    }

    const supplier = await prisma.storeSupplier.findFirst({
      where: { id: supplierId, portalToken: token, active: true },
      select: { id: true, profitMargin: true }
    });

    if (!supplier) throw new Error("غير مصرح لك");

    const profitMargin = Number(supplier.profitMargin) || 0.25;
    const salePrice = purchasePrice + profitMargin;

    // التأكد من أن المنتج ينتمي لهذا المورد
    const product = await prisma.storeProduct.findFirst({
      where: { id: productId, supplierId: supplier.id }
    });

    if (!product) throw new Error("منتج غير مصرح");

    await prisma.storeProduct.update({
      where: { id: productId },
      data: {
        purchasePrice: purchasePrice,
        salePrice: salePrice
      }
    });

    revalidatePath("/supplier");
    return { ok: true };
  } catch (error: any) {
    console.error("Update Price Error:", error);
    return { ok: false, error: error.message };
  }
}
