"use client";

import { useState, useEffect, useRef } from "react";
import { ProductCard } from "../../../product-card";

export function ProductListInfinite({ products }: { products: any[] }) {
  const [visibleCount, setVisibleCount] = useState(12);
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Reset when products change
    setVisibleCount(12);
  }, [products]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + 12, products.length));
        }
      },
      { rootMargin: "200px" } // يبدأ بالتحميل قبل الوصول للنهاية بـ 200 بيكسل
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [products.length]);

  if (products.length === 0) {
    return (
      <div className="text-center py-20 bg-slate-50 rounded-3xl text-slate-400 font-bold border border-slate-100">
        لا توجد منتجات متاحة حالياً.
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
        {products.slice(0, visibleCount).map((product: any) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
      
      {visibleCount < products.length && (
        <div ref={observerTarget} className="flex justify-center items-center py-10 w-full mt-4">
           <div className="w-8 h-8 border-4 border-slate-200 border-t-green-500 rounded-full animate-spin"></div>
        </div>
      )}
    </>
  );
}
