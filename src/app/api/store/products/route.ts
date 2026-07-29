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

import { FALLBACK_STORE_DATA } from "@/data/fallback-store-data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId");
  const ids = searchParams.get("ids");

  if (!branchId && !ids) {
    return NextResponse.json({ error: "Missing branchId or ids" }, { status: 400 });
  }

  try {
    let products: any[] = [];

    if (branchId && !ids) {
      products = await getCachedProductsByBranch(branchId);
    } else {
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

    if (!products || products.length === 0) {
      // Fallback matching
      const allFallbackProducts = FALLBACK_STORE_DATA.flatMap(c => c.branches.flatMap(b => b.products));
      if (branchId) {
        products = allFallbackProducts.filter(p => p.branchId === branchId || p.branchId.includes(branchId));
      } else if (ids) {
        const idArray = ids.split(",").map(id => id.trim());
        products = allFallbackProducts.filter(p => idArray.includes(p.id));
      }
    }

    const formattedProducts = products.map(p => ({
      ...p,
      salePrice: Number(p.salePrice),
      photoUrls: Array.isArray(p.photoUrls) ? p.photoUrls : [],
      variants: p.variants?.map((v: any) => ({ ...v, salePrice: Number(v.salePrice) })) || []
    }));

    return NextResponse.json(formattedProducts);
  } catch (error) {
    console.error("API Store Products Error:", error);
    // Fallback response on error
    const allFallbackProducts = FALLBACK_STORE_DATA.flatMap(c => c.branches.flatMap(b => b.products));
    let fallback = allFallbackProducts;
    if (branchId) {
      fallback = allFallbackProducts.filter(p => p.branchId === branchId);
    }
    return NextResponse.json(fallback);
  }
}
