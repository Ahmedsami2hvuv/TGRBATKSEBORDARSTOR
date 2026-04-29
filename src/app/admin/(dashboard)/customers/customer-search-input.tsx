"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export function CustomerSearchInput({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultValue);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query !== defaultValue) {
        if (query) {
          router.push(`/admin/customers?q=${encodeURIComponent(query)}`);
        } else {
          router.push(`/admin/customers`);
        }
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query, router, defaultValue]);

  return (
    <input
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder="بحث فوري في الزبائن (رقم، منطقة)..."
      className="flex-1 bg-gray-50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-400 outline-none text-right"
      dir="rtl"
    />
  );
}
