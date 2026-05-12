"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function StoreSearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const timeoutId = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (query) params.set("q", query);
      else params.delete("q");

      router.replace(`/store/search?${params.toString()}`, { scroll: false });
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, router, searchParams]);

  return (
    <div className="flex-1 max-w-md mx-4">
      <div className="relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث عن منتجات، أقسام، أو أفرع..."
          className="w-full pl-10 pr-4 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 border-none focus:ring-2 focus:ring-violet-500 transition-all font-bold text-sm dark:text-white outline-none"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          {query ? "✨" : "🔍"}
        </span>
      </div>
    </div>
  );
}
