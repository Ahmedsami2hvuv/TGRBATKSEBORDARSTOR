"use client";

import { useEffect, useState } from "react";
import { ProductCard } from "../product-card";

export function SuggestedProducts({ excludeId }: { excludeId: string }) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSuggested() {
      try {
        const res = await fetch(`/api/store/suggested?exclude=${excludeId}`);
        if (res.ok) {
          const data = await res.json();
          setProducts(data);
        }
      } catch (e) {
        console.error("Error fetching suggested:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchSuggested();
  }, [excludeId]);

  if (loading || products.length === 0) return null;

  return (
    <div className="mt-4 border-t border-slate-100 pt-6 px-4 mb-4">
      <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
        <span className="text-xl">💡</span>
        غالباً يتم شراؤها معاً
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}
