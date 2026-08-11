import { prisma } from "@/lib/prisma";
import { SearchContainer } from "./_components/search-container";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
  cat?: string;
  branch?: string;
  min?: string;
  max?: string;
  sort?: string;
}

function safeJson(data: any) {
  return JSON.parse(JSON.stringify(data, (key, value) => {
    if (typeof value === 'bigint') return value.toString();
    if (value && typeof value === 'object' && (value.constructor?.name === 'Decimal' || typeof value.toNumber === 'function')) {
        return Number(value.toString());
    }
    return value;
  }));
}

export default async function StoreSearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const { q, cat, branch, min, max, sort } = params;

  const [categoriesRaw, branchesRaw, settingsRaw] = await Promise.all([
    prisma.storeCategory.findMany({ where: { active: true }, orderBy: { sequence: "asc" } }),
    prisma.storeBranch.findMany({ where: { active: true }, orderBy: { sequence: "asc" } }),
    prisma.globalSettings.findUnique({ where: { id: "system" } }).catch(() => null)
  ]);

  const minPrice = min ? parseFloat(min) : undefined;
  const maxPrice = max ? parseFloat(max) : undefined;

  const initialProductsRaw = (q || cat || branch || min || max)
    ? await prisma.storeProduct.findMany({
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
            !isNaN(minPrice as any) && minPrice !== undefined ? { salePrice: { gte: minPrice } } : {},
            !isNaN(maxPrice as any) && maxPrice !== undefined ? { salePrice: { lte: maxPrice } } : {},
          ]
        },
        include: {
          supplier: true,
          branch: { include: { category: true } },
          variants: { where: { active: true }, orderBy: { sequence: "asc" } }
        },
        orderBy: sort === "price_asc" ? { salePrice: "asc" } :
                 sort === "price_desc" ? { salePrice: "desc" } :
                 { name: "asc" }
      })
    : [];

  const categories = safeJson(categoriesRaw);
  const branches = safeJson(branchesRaw);
  const settings = safeJson(settingsRaw);
  const globalMargin = settings?.profitMargin || 0;

  const initialProducts = safeJson(initialProductsRaw).map((p: any) => {
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
    };
  });

  return (
    <Suspense fallback={<div className="p-10 text-center font-bold">جاري تحميل البحث...</div>}>
      <SearchContainer
        initialProducts={initialProducts}
        categories={categories}
        branches={branches}
      />
    </Suspense>
  );
}
