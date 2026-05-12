"use server";

import { prisma } from "@/lib/prisma";

/**
 * دالة للبحث عن المنتجات مع تحويل البيانات لصيغة بسيطة (Plain JSON)
 * لتجنب أخطاء الـ Decimal والـ Date في Next.js Client Components
 */
export async function getSearchResults(params: {
  q?: string;
  cat?: string;
  branch?: string;
  min?: string;
  max?: string;
  sort?: string;
}) {
  const { q, cat, branch, min, max, sort } = params;

  try {
    const minPrice = min ? parseFloat(min) : undefined;
    const maxPrice = max ? parseFloat(max) : undefined;

    const products = await prisma.storeProduct.findMany({
      where: {
        active: true,
        AND: [
          q ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
              { branch: { name: { contains: q, mode: "insensitive" } } },
              { branch: { category: { name: { contains: q, mode: "insensitive" } } } },
            ]
          } : {},
          cat ? { branch: { categoryId: cat } } : {},
          branch ? { branchId: branch } : {},
          minPrice !== undefined && !isNaN(minPrice) ? { salePrice: { gte: minPrice } } : {},
          maxPrice !== undefined && !isNaN(maxPrice) ? { salePrice: { lte: maxPrice } } : {},
        ]
      },
      include: {
        branch: {
          include: {
            category: true
          }
        }
      },
      orderBy: sort === "price_asc" ? { salePrice: "asc" } :
               sort === "price_desc" ? { salePrice: "desc" } :
               { name: "asc" }
    });

    // تحويل البيانات لضمان عدم وجود Decimal Objects تسبب أخطاء في المتصفح
    // استخدام JSON.parse(JSON.stringify) هو أضمن وسيلة للتخلص من كائنات Prisma المعقدة
    const safeProducts = JSON.parse(JSON.stringify(products));

    return { products: safeProducts };
  } catch (error) {
    console.error("Search Action Error:", error);
    return { products: [], error: "حدث خطأ أثناء البحث" };
  }
}
