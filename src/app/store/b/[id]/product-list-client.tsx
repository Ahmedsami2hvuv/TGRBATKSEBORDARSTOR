"use client";

import { useState, useEffect } from "react";
import { ProductCardLazy } from "@/components/product-card-lazy";
import { ProductCardSkeleton } from "@/components/product-card-skeleton";

const CACHE_TTL_MS = 3 * 60 * 1000;

type BranchProductsCacheShape = {
  ts: number;
  products: any[];
};

export function ProductListClient({
  branchId,
  productBg,
  productBgOpacity,
}: {
  branchId: string,
  productBg?: string,
  productBgOpacity?: number,
}) {
  const [products, setProducts] = useState<any[]>([]);
  const [visibleCount, setVisibleCount] = useState(8); // نعرض 8 فقط في البداية لسرعة الرندر
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      const cacheKey = `kse_cache_b_${branchId}`;
      const cached = localStorage.getItem(cacheKey);

      if (cached && mounted) {
        try {
          const parsed = JSON.parse(cached) as BranchProductsCacheShape | any[];
          const now = Date.now();
          const parsedProducts = Array.isArray(parsed)
            ? parsed
            : Array.isArray(parsed?.products)
              ? parsed.products
              : [];
          const parsedTs = Array.isArray(parsed) ? 0 : Number(parsed?.ts || 0);
          const isFreshCache = parsedTs > 0 && now - parsedTs <= CACHE_TTL_MS;

          if (isFreshCache && parsedProducts.length > 0) {
            setProducts(parsedProducts);
            setLoading(false);
          }
        } catch (e) {}
      }

      try {
        const res = await fetch(`/api/store/products?branchId=${branchId}`);
        if (!res.ok) throw new Error("Server error");
        const data = await res.json();

        if (mounted && Array.isArray(data)) {
          setProducts(data);
          const payload: BranchProductsCacheShape = { ts: Date.now(), products: data };
          localStorage.setItem(
            cacheKey,
            JSON.stringify(payload),
          );
        }
      } catch (error) {
        console.error("Fetch error", error);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    return () => { mounted = false; };
  }, [branchId]);

  // دالة لزيادة المنتجات المعروضة عند النزول (Infinite Scroll بسيط)
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
        setVisibleCount(prev => Math.min(prev + 8, products.length));
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [products.length]);

  if (loading && products.length === 0) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        {[...Array(6)].map((_, i) => <ProductCardSkeleton key={i} />)}
      </div>
    );
  }

  const displayProducts = products.slice(0, visibleCount);

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        {displayProducts.map((p) => (
          <ProductCardLazy key={p.id} product={p} bgUrl={productBg} bgOpacityPercent={productBgOpacity} />
        ))}
      </div>

      {visibleCount < products.length && (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-4 border-violet-600/20 border-t-violet-600 rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
}
