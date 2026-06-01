import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// دالة لجلب المنتجات بسرعة مع حساب الربح مباشرة
async function getCachedProductsByBranch(branchId: string) {
  const products = await prisma.storeProduct.findMany({
    where: { branchId, active: true },
    select: {
      id: true,
      name: true,
      purchasePrice: true,
      salePrice: true,
      description: true,
      photoUrls: true,
      hasVariants: true,
      variants: {
        select: {
          id: true,
          name: true,
          purchasePrice: true,
          salePrice: true,
        }
      }
    },
    orderBy: { sequence: "desc" },
  });

  return products.map(p => {
    return {
      ...p,
      salePrice: Number(p.salePrice),
      photoUrls: Array.isArray(p.photoUrls) ? p.photoUrls : [],
      variants: p.variants?.map(v => ({
        ...v,
        salePrice: Number(v.salePrice)
      }))
    };
  });
}

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
