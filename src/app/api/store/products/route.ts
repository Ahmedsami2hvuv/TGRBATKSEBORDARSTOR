import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";

// دالة مخزنة لجلب المنتجات بسرعة مع حساب الربح
const getCachedProductsByBranch = unstable_cache(
  async (branchId: string) => {
    const [branch, globalSettings] = await Promise.all([
      prisma.storeBranch.findUnique({
        where: { id: branchId },
        select: {
          profitMargin: true,
          category: { select: { profitMargin: true } }
        }
      }),
      prisma.globalSettings.findUnique({ where: { id: "system" }, select: { profitMargin: true } })
    ]);

    const products = await prisma.storeProduct.findMany({
      where: { branchId, active: true },
      select: {
        id: true,
        name: true,
        purchasePrice: true,
        description: true,
        photoUrls: true,
        hasVariants: true,
        variants: {
          select: {
            id: true,
            name: true,
            purchasePrice: true,
          }
        }
      },
      orderBy: { sequence: "desc" },
    });

    // تحديد مقدار الربح المعتمد (فرع -> قسم -> عام)
    const branchMargin = Number(branch?.profitMargin || 0);
    const categoryMargin = Number(branch?.category?.profitMargin || 0);
    const globalMargin = Number(globalSettings?.profitMargin || 0);

    const activeMargin = branchMargin > 0 ? branchMargin : (categoryMargin > 0 ? categoryMargin : globalMargin);

    return products.map(p => {
      const pPrice = Number(p.purchasePrice || 0);
      return {
        ...p,
        salePrice: pPrice + activeMargin,
        photoUrls: Array.isArray(p.photoUrls) ? p.photoUrls : [],
        variants: p.variants?.map(v => ({
          ...v,
          salePrice: Number(v.purchasePrice || 0) + activeMargin
        }))
      };
    });
  },
  ["store-products-list"],
  { revalidate: 600, tags: ["products"] }
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId");
  const ids = searchParams.get("ids");

  if (!branchId && !ids) {
    return NextResponse.json({ error: "Missing branchId or ids" }, { status: 400 });
  }

  try {
    let products;

    if (branchId && !ids) {
      // استخدام الـ Cache للطلبات العامة للفرع (الأكثر تكراراً)
      products = await getCachedProductsByBranch(branchId);
    } else {
      // جلب مباشر للمعرفات المحددة (مثل المفضلة) لأنها متغيرة جداً
      const where: any = { active: true };
      if (branchId) where.branchId = branchId;
      if (ids) {
        const idArray = ids.split(",").map(id => id.trim()).filter(Boolean);
        if (idArray.length > 0) where.id = { in: idArray };
      }

      products = await prisma.storeProduct.findMany({
        where,
        select: {
          id: true,
          name: true,
          salePrice: true,
          description: true,
          photoUrls: true,
          hasVariants: true,
          variants: {
            select: { id: true, name: true, salePrice: true }
          }
        },
        orderBy: { sequence: "desc" },
      });
    }

    const formattedProducts = products.map(p => ({
      ...p,
      salePrice: Number(p.salePrice),
      photoUrls: Array.isArray(p.photoUrls) ? p.photoUrls : [],
      variants: p.variants?.map(v => ({ ...v, salePrice: Number(v.salePrice) }))
    }));

    return NextResponse.json(formattedProducts);
  } catch (error) {
    console.error("API Store Products Error:", error);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}
