"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useTransition } from "react";

export function CustomerSearchInput({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultValue);

  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query !== defaultValue) {
        startTransition(() => {
          if (query) {
            router.replace(`/admin/customers?q=${encodeURIComponent(query)}`);
          } else {
            router.replace(`/admin/customers`);
          }
        });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, router, defaultValue]);

  return (
    <div className="flex-1 relative flex items-center">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="بحث فوري في الزبائن (رقم، منطقة)..."
        className="w-full bg-gray-50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-400 outline-none text-right"
        dir="rtl"
      />
      {isPending && (
        <div className="absolute left-3 w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      )}
    </div>
  );
}
