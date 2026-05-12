"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

export function StoreSearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [query, setQuery] = useState("");

  // مزامنة الحقل مع الرابط فقط إذا كنا في صفحة البحث
  useEffect(() => {
    if (pathname === "/store/search") {
      setQuery(searchParams.get("q") || "");
    } else {
      setQuery(""); // مسح الحقل عند تصفح الأقسام أو الرئيسية
    }
  }, [searchParams, pathname]);

  // دالة البحث اليدوي
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedQuery = query.trim();

    if (!trimmedQuery) return;

    // التوجه لصفحة البحث فقط عند ضغط Enter أو زر البحث
    router.push(`/store/search?q=${encodeURIComponent(trimmedQuery)}`);
  };

  return (
    <form onSubmit={handleSearch} className="flex-1 max-w-md mx-4">
      <div className="relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          name="store-search"
          placeholder="ابحث عن منتجات، أقسام، أو أفرع..."
          className="w-full pl-10 pr-4 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 border-none focus:ring-2 focus:ring-violet-500 transition-all font-bold text-sm dark:text-white outline-none"
        />
        <button
          type="submit"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-violet-600 transition-colors"
        >
          {query ? "✨" : "🔍"}
        </button>
      </div>
    </form>
  );
}
