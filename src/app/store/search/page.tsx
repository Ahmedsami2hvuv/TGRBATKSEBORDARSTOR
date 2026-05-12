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

export default async function StoreSearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const { q, cat, branch, min, max, sort } = params;

  // Initial data fetch for categories and branches (stable data)
  const [categories, branches] = await Promise.all([
    prisma.storeCategory.findMany({ where: { active: true }, orderBy: { sequence: "asc" } }),
    prisma.storeBranch.findMany({ where: { active: true }, orderBy: { sequence: "asc" } }),
  ]);

  // Initial product fetch based on URL params
  const minPrice = min ? parseFloat(min) : undefined;
  const maxPrice = max ? parseFloat(max) : undefined;

  const initialProducts = (q || cat || branch || min || max)
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
          branch: {
            include: {
              category: true
            }
          }
        },
        orderBy: sort === "price_asc" ? { salePrice: "asc" } :
                 sort === "price_desc" ? { salePrice: "desc" } :
                 { name: "asc" }
      })
    : [];

  return (
    <Suspense fallback={<div className="p-10 text-center font-bold">جاري تحميل البحث...</div>}>
      <SearchContainer
        initialProducts={JSON.parse(JSON.stringify(initialProducts))}
        categories={JSON.parse(JSON.stringify(categories))}
        branches={JSON.parse(JSON.stringify(branches))}
      />
    </Suspense>
  );
}
