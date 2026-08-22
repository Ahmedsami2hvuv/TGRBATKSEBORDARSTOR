import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function safeJson(data: any) {
  return JSON.parse(JSON.stringify(data, (key, value) => {
    if (typeof value === 'bigint') return value.toString();
    if (value && typeof value === 'object' && (value.constructor?.name === 'Decimal' || typeof value.toNumber === 'function')) {
        return Number(value.toString());
    }
    return value;
  }));
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const idsParam = searchParams.get("ids");
    
    if (!idsParam) {
      return NextResponse.json([]);
    }

    const ids = idsParam.split(",").filter(Boolean);
    
    if (ids.length === 0) {
      return NextResponse.json([]);
    }

    const settings = await prisma.globalSettings.findUnique({ where: { id: "system" } }).catch(() => null);
    const globalMargin = safeJson(settings)?.profitMargin || 0;

    const productsRaw = await prisma.storeProduct.findMany({
      where: {
        id: { in: ids },
        active: true,
      },
      include: {
        supplier: true,
        branch: {
          include: {
            category: true
          }
        },
        variants: {
          where: { active: true },
          orderBy: { sequence: "asc" }
        }
      }
    });

    const products = safeJson(productsRaw).map((p: any) => {
      const supplierMargin = p.supplier?.profitMargin || 0;
      const branchMargin = p.branch?.profitMargin || 0;
      const categoryMargin = p.branch?.category?.profitMargin || 0;
      const effectiveMargin = supplierMargin || branchMargin || categoryMargin || globalMargin;

      let salePrice = p.salePrice || 0;
      const purchasePrice = p.purchasePrice || 0;

      if (salePrice <= 0 && purchasePrice > 0) {
        const addedMargin = effectiveMargin <= 1 ? (purchasePrice * effectiveMargin) : effectiveMargin;
        salePrice = purchasePrice + addedMargin;
      }

      const variants = (p.variants || []).map((v: any) => {
        let vSalePrice = v.salePrice || 0;
        const vPurchasePrice = v.purchasePrice || 0;
        if (vSalePrice <= 0 && vPurchasePrice > 0) {
          const vAddedMargin = effectiveMargin <= 1 ? (vPurchasePrice * effectiveMargin) : effectiveMargin;
          vSalePrice = vPurchasePrice + vAddedMargin;
        }
        return {
          id: String(v.id),
          name: v.name,
          salePrice: vSalePrice,
          purchasePrice: vPurchasePrice,
        };
      });

      return {
        id: String(p.id),
        name: p.name,
        description: p.description || "",
        salePrice,
        purchasePrice,
        photoUrls: Array.isArray(p.photoUrls) ? p.photoUrls : [],
        hasVariants: !!p.hasVariants,
        variantType: p.variantType || "النوع",
        variants,
        supplierId: p.supplierId || null,
        branch: p.branch,
        category: p.branch?.category,
      };
    });

    return NextResponse.json(products);
  } catch (error) {
    console.error("Favorites API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
