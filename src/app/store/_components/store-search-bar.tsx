"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

export function StoreSearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const isFirstRender = useRef(true);

  // مزامنة حقل البحث مع الرابط عند التغيير (مثلاً عند الضغط على زر الرجوع)
  useEffect(() => {
    const q = searchParams.get("q") || "";
    if (q !== query) {
      setQuery(q);
    }
  }, [searchParams]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // منع الانتقال التلقائي للبحث إذا كان الحقل فارغاً والمستخدم يتصفح الأقسام
    if (!query && !searchParams.get("q") && pathname !== "/store/search") {
      return;
    }

    // إذا لم يتغير البحث عن الموجود في الرابط فعلياً، لا تفعل شيئاً
    if (query === (searchParams.get("q") || "")) {
      return;
    }

    const timeoutId = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (query) {
        params.set("q", query);
        router.replace(`/store/search?${params.toString()}`, { scroll: false });
      } else if (pathname === "/store/search") {
        // إذا كان المستخدم في صفحة البحث ومسح النص، نقوم بتحديث النتائج لتصبح فارغة
        params.delete("q");
        router.replace(`/store/search?${params.toString()}`, { scroll: false });
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, router, searchParams, pathname]);

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
